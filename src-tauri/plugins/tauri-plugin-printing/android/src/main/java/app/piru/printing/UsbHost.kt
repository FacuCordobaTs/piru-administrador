package app.piru.printing

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean

/** Lo que puede tardar el usuario en contestar el diálogo de permiso de USB. */
private const val PERMISO_USB_TIMEOUT_MS = 120_000L

/** Timeout de cada transferencia al endpoint. Una térmica que no lee se corta, no cuelga la cola. */
private const val BULK_TIMEOUT_MS = 5_000

/** 4 KiB por transferencia: entra en cualquier buffer del driver y no arma listas enormes. */
private const val TAMANO_BLOQUE = 4_096

/**
 * Impresora por USB Host.
 *
 * A diferencia del spooler de Windows, esto **no es desatendido**: Android pide autorización por
 * cada dispositivo USB la primera vez y otra vez cada vez que el dispositivo se reconecta (el
 * diálogo se puede marcar como permanente, pero no está garantizado). Por eso el flujo es
 * asincrónico —`pedirPermiso` recibe un callback— y los errores lo explican: un "no se pudo
 * imprimir" sin esa aclaración manda al usuario a buscar el problema en la impresora.
 *
 * El receptor del permiso decide con `hasPermission`, que es la única verdad, y no con el extra
 * `EXTRA_PERMISSION_GRANTED` del broadcast: así un broadcast falso no puede hacer que imprimamos ni
 * que dejemos de imprimir.
 */
class UsbHost(private val actividad: Activity) {

    private val gestor: UsbManager? = actividad.getSystemService(Context.USB_SERVICE) as? UsbManager

    /** Impresoras conectadas: los dispositivos con una interfaz de clase 7 (printer). */
    fun impresoras(): List<Int> {
        val gestor = gestor ?: return emptyList()
        return try {
            gestor.deviceList.values
                .filter { interfazDeImpresora(it) != null }
                .map { it.deviceId }
                .sorted()
        } catch (e: Exception) {
            // `deviceList` no pide permiso, pero un driver roto puede tirar: el descubrimiento no
            // puede romper la pantalla de ajustes entera.
            Log.w(TAG, "No se pudo enumerar los dispositivos USB", e)
            emptyList()
        }
    }

    fun buscar(deviceId: Int): UsbDevice? =
        gestor?.deviceList?.values?.firstOrNull { it.deviceId == deviceId }

    fun tienePermiso(dispositivo: UsbDevice): Boolean = gestor?.hasPermission(dispositivo) == true

    /** Pide el permiso del sistema para un dispositivo. El callback corre en el hilo de UI. */
    fun pedirPermiso(dispositivo: UsbDevice, alResultar: (Boolean) -> Unit) {
        val gestor = gestor
        if (gestor == null) {
            alResultar(false)
            return
        }
        DialogoDePermiso(gestor, dispositivo, alResultar).pedir()
    }

    /** Manda los bytes por el endpoint BULK OUT de la interfaz de impresora. Bloqueante. */
    fun enviar(dispositivo: UsbDevice, contenido: ByteArray) {
        val gestor = gestor ?: throw IOException("Esta tablet no tiene USB Host")
        if (!gestor.hasPermission(dispositivo)) {
            // Puede pasar si el usuario desconectó el cable: Android borra el permiso del
            // dispositivo al desconectarlo.
            throw SecurityException("Android no autorizó el dispositivo USB ${dispositivo.deviceId}")
        }

        val interfaz = interfazDeImpresora(dispositivo) ?: dispositivo.getInterface(0)
        val salida = endpointDeSalida(interfaz)
            ?: throw IOException(
                "El dispositivo USB ${dispositivo.deviceId} no tiene un endpoint de salida (BULK OUT): no parece una impresora"
            )
        val conexion = gestor.openDevice(dispositivo)
            ?: throw IOException("Android no pudo abrir el dispositivo USB ${dispositivo.deviceId}")

        try {
            // force = true: si el kernel tiene tomada la interfaz (algunos adaptadores USB-a-serie),
            // se la saca. Sin esto, claimInterface falla y no hay forma de imprimir.
            if (!conexion.claimInterface(interfaz, true)) {
                throw IOException(
                    "Android no pudo quedarse con la interfaz USB de la impresora (¿la está usando otro programa?)"
                )
            }
            try {
                var enviados = 0
                while (enviados < contenido.size) {
                    val bloque = minOf(TAMANO_BLOQUE, contenido.size - enviados)
                    val escritos = conexion.bulkTransfer(salida, contenido, enviados, bloque, BULK_TIMEOUT_MS)
                    if (escritos <= 0) {
                        throw IOException(
                            "La impresora USB cortó la transferencia después de $enviados de ${contenido.size} bytes"
                        )
                    }
                    enviados += escritos
                }
            } finally {
                conexion.releaseInterface(interfaz)
            }
        } finally {
            conexion.close()
        }
    }

    private fun interfazDeImpresora(dispositivo: UsbDevice): UsbInterface? {
        for (i in 0 until dispositivo.interfaceCount) {
            val interfaz = dispositivo.getInterface(i)
            if (interfaz.interfaceClass == UsbConstants.USB_CLASS_PRINTER) return interfaz
        }
        return null
    }

    private fun endpointDeSalida(interfaz: UsbInterface): UsbEndpoint? {
        for (i in 0 until interfaz.endpointCount) {
            val endpoint = interfaz.getEndpoint(i)
            if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                endpoint.direction == UsbConstants.USB_DIR_OUT
            ) {
                return endpoint
            }
        }
        return null
    }

    /**
     * Un diálogo de permiso. El receptor se registra una sola vez por pedido y se da de baja al
     * terminar: si quedara registrado, el próximo diálogo llamaría dos veces al callback (y el
     * segundo `reject` ya no tendría a quién contestarle).
     */
    private inner class DialogoDePermiso(
        private val gestor: UsbManager,
        private val dispositivo: UsbDevice,
        private val alResultar: (Boolean) -> Unit,
    ) : BroadcastReceiver() {

        private val terminado = AtomicBoolean(false)
        private val accion = "${actividad.packageName}.USB_PERMISSION"

        fun pedir() {
            val filtro = IntentFilter(accion)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 14+ exige declarar si el receptor está exportado. No exportado alcanza: el
                // broadcast lo manda el propio sistema (UID de sistema, exento del chequeo) a través
                // de un PendingIntent nuestro.
                actividad.registerReceiver(this, filtro, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                actividad.registerReceiver(this, filtro)
            }

            // FLAG_MUTABLE: el sistema completa el Intent con EXTRA_PERMISSION_GRANTED antes de
            // mandarlo; con FLAG_IMMUTABLE no podría. La bandera sólo existe desde API 31.
            val banderas = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val pendiente = PendingIntent.getBroadcast(
                actividad,
                0,
                Intent(accion).setPackage(actividad.packageName),
                banderas,
            )

            gestor.requestPermission(dispositivo, pendiente)

            // Red de seguridad: si el diálogo no vuelve (el sistema no manda el broadcast, el
            // usuario lo cancela de una forma rara), la llamada del puente no respondería nunca y la
            // cola de impresión quedaría tomada para siempre. Se consulta `hasPermission` porque el
            // permiso puede estar concedido aunque el broadcast se haya perdido.
            Temporizador.programar(PERMISO_USB_TIMEOUT_MS) { terminar() }
        }

        override fun onReceive(contexto: Context, intent: Intent) {
            if (intent.action != accion) return
            terminar()
        }

        private fun terminar() {
            if (!terminado.compareAndSet(false, true)) return
            try {
                actividad.unregisterReceiver(this)
            } catch (_: IllegalArgumentException) {
                // Ya estaba dado de baja (o la activity murió): no es un error.
            }
            alResultar(gestor.hasPermission(dispositivo))
        }
    }
}
