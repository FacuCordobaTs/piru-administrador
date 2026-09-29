package app.piru.printing

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.os.Build
import android.util.Log
import app.tauri.PermissionState
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/** Alias del permiso de Bluetooth en este plugin (`getPermissionState("bluetooth")`). */
private const val ALIAS_BLUETOOTH = "bluetooth"

/**
 * Impresión en Android: TCP, Bluetooth RFCOMM y USB Host.
 *
 * Los tres transportes son APIs del sistema que Rust no puede alcanzar: no hay sockets RFCOMM ni
 * `UsbManager` en la NDK. El contrato con el lado Rust es mínimo y explícito:
 *
 * - `getPrinters` (sin argumentos) responde una **lista** de destinos con el mismo JSON del
 *   contrato (`{"kind":"usb-android","deviceId":0}`, `{"kind":"bluetooth","mac":"…"}`,
 *   `{"kind":"debug-file"}`). La validación de cada item la hace Rust.
 * - `sendPrintJob` recibe `{"target": {…}, "content": [bytes]}` y responde vacío (o rechaza con un
 *   mensaje pensado para que lo lea el usuario final).
 *
 * Los nombres de esos dos métodos son los nombres de los comandos: `PluginHandle` los indexa por
 * `method.name`, así que renombrar uno rompe la llamada sin error de compilación.
 *
 * **Los comandos corren en el hilo de UI de Android** (así los despacha `PluginManager`), así que
 * ningún transporte —sockets, `bulkTransfer`, diálogos— corre ahí: todo pasa por [trabajador].
 */
@TauriPlugin(
    permissions = [
        // `BLUETOOTH_CONNECT` es un permiso *de runtime* desde Android 12 (API 31): sin él,
        // `bondedDevices`, `isEnabled` y `createRfcommSocketToServiceRecord` tiran SecurityException.
        // En API 30 y anteriores el permiso es de instalación y el estado siempre da GRANTED, por eso
        // el chequeo está gateado por versión (`faltaPermisoBluetooth`).
        Permission(strings = [Manifest.permission.BLUETOOTH_CONNECT], alias = ALIAS_BLUETOOTH),
    ]
)
class PrintingPlugin(private val actividad: Activity) : Plugin(actividad) {

    private val usb = UsbHost(actividad)

    /**
     * Un solo hilo para todos los transportes, en el orden en que llegan las llamadas.
     *
     * No se apaga en `onDestroy` a propósito: `PluginManager` no desregistra plugins y el proceso
     * muere con la app, así que apagarlo sólo podría dejar comandos rechazados sin motivo.
     */
    private val trabajador: ExecutorService = Executors.newSingleThreadExecutor { tarea ->
        Thread(tarea, "piru-impresion").apply { isDaemon = true }
    }

    /** Destinos que Android descubre solo: USB Host y Bluetooth emparejado, más el de debug. */
    @Command
    fun getPrinters(invoke: Invoke) {
        enTrabajador(invoke) {
            val destinos = ArrayList<Map<String, Any>>()
            for (deviceId in usb.impresoras()) {
                destinos.add(mapOf("kind" to "usb-android", "deviceId" to deviceId))
            }
            destinos.addAll(bluetoothEmparejado())
            // La impresora virtual de debug no depende de hardware: está siempre.
            destinos.add(mapOf("kind" to "debug-file"))
            invoke.resolveObject(destinos)
        }
    }

    @Command
    fun sendPrintJob(invoke: Invoke) {
        val argumentos = argumentosDe(invoke) ?: return
        val destino = leerDestino(invoke, argumentos) ?: return
        val contenido = leerContenido(invoke, argumentos) ?: return

        if (destino is Destino.Bluetooth && faltaPermisoBluetooth()) {
            // El diálogo del permiso lo muestra la activity: se pide desde el hilo de UI (acá
            // estamos en él) y se vuelve por `trasPedirBluetooth`, que recibe *el mismo* `Invoke`.
            // Los argumentos se releen del propio Invoke, así que no queda estado a medio guardar.
            requestPermissionForAlias(ALIAS_BLUETOOTH, invoke, "trasPedirBluetooth")
            return
        }

        if (destino is Destino.UsbAndroid) {
            imprimirPorUsb(invoke, destino, contenido)
            return
        }

        imprimir(invoke, destino, contenido)
    }

    /** Vuelta del diálogo de `BLUETOOTH_CONNECT`. Corre en el hilo de UI. */
    @PermissionCallback
    private fun trasPedirBluetooth(invoke: Invoke) {
        val argumentos = argumentosDe(invoke) ?: return
        val destino = leerDestino(invoke, argumentos) ?: return
        val contenido = leerContenido(invoke, argumentos) ?: return

        if (faltaPermisoBluetooth()) {
            // Android no da un mensaje útil acá: el usuario tiene que ir a los ajustes si dijo "no
            // permitir" dos veces, y eso no se puede detectar de forma confiable.
            invoke.reject(
                "Sin el permiso de Bluetooth la tablet no puede ver ni usar la impresora. " +
                    "Se concede con \"Permitir\" en el diálogo; si no aparece más, hay que darlo en " +
                    "Ajustes > Aplicaciones > Piru > Permisos > Dispositivos cercanos."
            )
            return
        }

        imprimir(invoke, destino, contenido)
    }

    private fun imprimir(invoke: Invoke, destino: Destino, contenido: ByteArray) {
        enTrabajador(invoke) {
            try {
                enviar(destino, contenido)
                invoke.resolve()
            } catch (e: Exception) {
                Log.w(TAG, "No se pudo imprimir a $destino", e)
                invoke.reject(explicar(destino, e))
            }
        }
    }

    /**
     * USB se resuelve aparte porque necesita el diálogo del sistema: el permiso llega por callback,
     * no se puede esperar dentro del hilo de trabajo sin colgar el puente.
     */
    private fun imprimirPorUsb(invoke: Invoke, destino: Destino.UsbAndroid, contenido: ByteArray) {
        val dispositivo = usb.buscar(destino.deviceId)
        if (dispositivo == null) {
            invoke.reject(
                "Android no ve ningún dispositivo USB con el id ${destino.deviceId}. " +
                    "Revisá que la impresora esté encendida y conectada a la tablet."
            )
            return
        }

        if (!usb.tienePermiso(dispositivo)) {
            usb.pedirPermiso(dispositivo) { concedido ->
                if (!concedido) {
                    invoke.reject(
                        "No se autorizó el uso de la impresora USB (dispositivo ${destino.deviceId}). " +
                            "Android pide aceptar el diálogo cada vez que el dispositivo se conecta."
                    )
                    return@pedirPermiso
                }
                escribirUsb(invoke, dispositivo, contenido)
            }
            return
        }

        escribirUsb(invoke, dispositivo, contenido)
    }

    private fun escribirUsb(invoke: Invoke, dispositivo: android.hardware.usb.UsbDevice, contenido: ByteArray) {
        enTrabajador(invoke) {
            try {
                usb.enviar(dispositivo, contenido)
                invoke.resolve()
            } catch (e: Exception) {
                Log.w(TAG, "No se pudo imprimir por USB al dispositivo ${dispositivo.deviceId}", e)
                invoke.reject(explicar(Destino.UsbAndroid(dispositivo.deviceId), e))
            }
        }
    }

    /** Único lugar con I/O de verdad. Corre en [trabajador], nunca en el hilo de UI. */
    private fun enviar(destino: Destino, contenido: ByteArray) {
        when (destino) {
            is Destino.Tcp -> enviarTcp(destino.host, destino.puerto, contenido)

            is Destino.Bluetooth -> {
                val adaptador = adaptadorBluetooth()
                    ?: throw IOException("Esta tablet no tiene Bluetooth")
                if (!adaptador.isEnabled) {
                    throw IOException("El Bluetooth de la tablet está apagado")
                }
                enviarBluetooth(adaptador, destino.mac, contenido)
            }

            is Destino.DebugFile -> guardarDebug(actividad, contenido)

            is Destino.UsbAndroid ->
                // El envío por USB se resuelve en `imprimirPorUsb`, con el permiso del sistema.
                throw IllegalStateException("El envío por USB se resuelve aparte")

            is Destino.Spooler -> throw IOException(mensajeDeEscritorio("una impresora instalada en Windows"))
            is Destino.Serial -> throw IOException(mensajeDeEscritorio("el puerto serie ${destino.puerto}"))
        }
    }

    /**
     * El destino existe en el contrato y la UI lo ofrece, pero es de Windows: sin este mensaje el
     * usuario ve "falló la impresión" y no tiene forma de saber que eligió un transporte que la
     * tablet no tiene.
     */
    private fun mensajeDeEscritorio(que: String): String =
        "Este equipo está configurado con $que, que sólo existe en Windows. " +
            "En la tablet elegí Red (TCP/IP), Bluetooth o USB en Ajustes > Impresión."

    private fun explicar(destino: Destino, error: Exception): String {
        val detalle = error.message ?: error.toString()
        return when (destino) {
            is Destino.Tcp -> "No se pudo imprimir en ${destino.host}:${destino.puerto}: $detalle"
            is Destino.Bluetooth ->
                "No se pudo imprimir por Bluetooth en ${destino.mac}: $detalle. " +
                    "Revisá que la impresora esté encendida, emparejada y cerca de la tablet."
            is Destino.UsbAndroid -> "No se pudo imprimir por USB (dispositivo ${destino.deviceId}): $detalle"
            is Destino.DebugFile -> "No se pudo guardar el ticket de debug: $detalle"
            is Destino.Spooler, is Destino.Serial -> detalle
        }
    }

    /**
     * En Android 12+ el permiso de Bluetooth se pide en runtime. En versiones anteriores el estado
     * que informa la plataforma es DENIED para un permiso que no existe (Android no lo conoce), y
     * consultarlo haría que la impresión por Bluetooth fallara siempre: por eso el chequeo está
     * gateado por versión.
     */
    private fun faltaPermisoBluetooth(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState(ALIAS_BLUETOOTH) != PermissionState.GRANTED

    private fun adaptadorBluetooth(): BluetoothAdapter? =
        (actividad.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    /**
     * Dispositivos Bluetooth ya emparejados con la tablet.
     *
     * Leer la lista exige `BLUETOOTH_CONNECT` en Android 12+, y el descubrimiento es pasivo: no se
     * pide el permiso acá, sólo se omite la lista. La MAC se puede cargar a mano desde la UI, y el
     * permiso se pide al imprimir (que es cuando el usuario ya decidió usarlo).
     */
    private fun bluetoothEmparejado(): List<Map<String, Any>> {
        if (faltaPermisoBluetooth()) return emptyList()
        val adaptador = adaptadorBluetooth() ?: return emptyList()
        return try {
            if (!adaptador.isEnabled) {
                emptyList()
            } else {
                adaptador.bondedDevices.orEmpty().map { mapOf("kind" to "bluetooth", "mac" to it.address) }
            }
        } catch (e: SecurityException) {
            // El permiso se puede revocar con la app abierta: eso no puede romper el
            // descubrimiento entero (USB y debug siguen sirviendo).
            Log.w(TAG, "Sin permiso de Bluetooth: no se listan los dispositivos emparejados", e)
            emptyList()
        }
    }

    private fun argumentosDe(invoke: Invoke): JSObject? = try {
        invoke.getArgs()
    } catch (e: Exception) {
        invoke.reject("La llamada de impresión llegó mal formada: ${e.message ?: e.toString()}")
        null
    }

    private fun leerDestino(invoke: Invoke, argumentos: JSObject): Destino? = try {
        Destino.desdeJson(argumentos.getJSONObject("target"))
    } catch (e: Exception) {
        // Un `kind` desconocido o un campo faltante: se rechaza acá en vez de imprimir en otro lado.
        invoke.reject("El destino de impresión llegó mal formado: ${e.message ?: e.toString()}")
        null
    }

    private fun leerContenido(invoke: Invoke, argumentos: JSObject): ByteArray? = try {
        val arreglo = argumentos.getJSONArray("content")
        val bytes = ByteArray(arreglo.length())
        for (i in bytes.indices) {
            bytes[i] = arreglo.getInt(i).toByte()
        }
        if (bytes.isEmpty()) {
            invoke.reject("El trabajo de impresión llegó vacío")
            null
        } else {
            bytes
        }
    } catch (e: Exception) {
        invoke.reject("El contenido del ticket llegó mal formado: ${e.message ?: e.toString()}")
        null
    }

    private fun enTrabajador(invoke: Invoke, cuerpo: () -> Unit) {
        try {
            trabajador.execute {
                try {
                    cuerpo()
                } catch (e: Exception) {
                    // Red de seguridad: el invoke tiene que contestar siempre, incluso si algo se
                    // rompió fuera del try/catch de `imprimir`.
                    Log.e(TAG, "Error inesperado en la impresión", e)
                    invoke.reject("Error inesperado en la impresión: ${e.message ?: e.toString()}")
                }
            }
        } catch (e: RejectedExecutionException) {
            invoke.reject("La impresión se está apagando: reintentá en un momento")
        }
    }
}
