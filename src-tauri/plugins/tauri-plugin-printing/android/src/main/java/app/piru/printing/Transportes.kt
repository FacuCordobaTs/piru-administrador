package app.piru.printing

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.util.Log
import java.io.Closeable
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

internal const val TAG = "PiruPrinting"

/** Nombre del archivo de la impresora virtual de debug (el mismo de escritorio). */
const val NOMBRE_ARCHIVO_DEBUG = "ticket_debug.bin"

/** Timeout de conexión TCP. Sin esto, una IP equivocada espera el reintento del stack (~20 s) y,
 *  como los trabajos van serializados, arrastra a las comandas que vienen detrás. */
private const val TCP_CONNECT_TIMEOUT_MS = 5_000

/** Techo para una conexión entera (conectar + escribir + cerrar). */
private const val TCP_TOTAL_TIMEOUT_MS: Long = 20_000

/** `BluetoothSocket.connect()` no tiene timeout propio: contra una impresora apagada el stack hace
 *  *paging* durante decenas de segundos. */
private const val BLUETOOTH_CONNECT_TIMEOUT_MS: Long = 15_000

/** UUID del perfil SPP (puerto serie sobre RFCOMM): es el que escuchan las térmicas Bluetooth. */
private val UUID_SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

/**
 * Vigilante de operaciones bloqueantes.
 *
 * Java no expone un timeout de escritura en `Socket` (`setSoTimeout` sólo afecta a las lecturas) y
 * `BluetoothSocket.connect()` no tiene timeout. La única forma de acotar una llamada que ya está
 * bloqueada es cerrar el socket desde otro hilo: eso la desbloquea con una excepción. Es el mismo
 * caso que cubre el camino de escritorio con `set_write_timeout` para TCP.
 */
internal object Temporizador {
    private val planificador = Executors.newSingleThreadScheduledExecutor(
        ThreadFactory { tarea -> Thread(tarea, "piru-impresion-vigilante").apply { isDaemon = true } }
    )

    fun programar(millis: Long, accion: () -> Unit): ScheduledFuture<*> =
        planificador.schedule({ accion() }, millis, TimeUnit.MILLISECONDS)
}

/**
 * Impresora de red (RAW/JetDirect, puerto 9100 típico). Es el transporte que hace que una tablet
 * imprima por "Ethernet": mismo camino que el de escritorio, pero con sockets de Java.
 */
fun enviarTcp(host: String, puerto: Int, contenido: ByteArray) {
    val socket = Socket()
    try {
        socket.connect(InetSocketAddress(host, puerto), TCP_CONNECT_TIMEOUT_MS)

        // Si la impresora acepta la conexión y después deja de leer, `write` se queda esperando
        // para siempre: el vigilante cierra el socket y eso lo desbloquea.
        val vigilante = Temporizador.programar(TCP_TOTAL_TIMEOUT_MS) { cerrarSilencioso(socket) }
        try {
            val salida = socket.getOutputStream()
            salida.write(contenido)
            salida.flush()
        } finally {
            vigilante.cancel(false)
        }
    } finally {
        // Cierre ordenado: el kernel manda lo que quedó en el buffer antes del FIN, igual que en el
        // camino de escritorio (por eso no hace falta esperar nada más).
        cerrarSilencioso(socket)
    }
}

/**
 * Impresora Bluetooth por RFCOMM/SPP. El aparato tiene que estar **emparejado** en los ajustes de
 * Android: el emparejamiento tiene PIN y no se puede hacer desde la app.
 *
 * Requiere `BLUETOOTH_CONNECT` en Android 12+ (lo pide `PrintingPlugin` antes de llegar acá): sin
 * él, `getRemoteDevice`/`connect` tiran `SecurityException`.
 */
fun enviarBluetooth(adaptador: BluetoothAdapter, mac: String, contenido: ByteArray) {
    val dispositivo = try {
        adaptador.getRemoteDevice(mac)
    } catch (e: IllegalArgumentException) {
        throw IllegalArgumentException("La MAC '$mac' no es válida (se espera AA:BB:CC:DD:EE:FF)", e)
    }

    val socket = try {
        dispositivo.createRfcommSocketToServiceRecord(UUID_SPP)
    } catch (e: SecurityException) {
        throw SecurityException("Android no dio permiso para usar la impresora Bluetooth $mac", e)
    }

    try {
        val vigilante = Temporizador.programar(BLUETOOTH_CONNECT_TIMEOUT_MS) { cerrarSilencioso(socket) }
        try {
            socket.connect()
        } finally {
            vigilante.cancel(false)
        }

        val salida = socket.outputStream
        salida.write(contenido)
        salida.flush()
    } finally {
        cerrarSilencioso(socket)
    }
}

/**
 * Impresora virtual de debug: guarda el ticket en un archivo en vez de imprimirlo.
 *
 * En Android no hay "directorio de trabajo", así que la ruta relativa `ticket_debug.bin` del camino
 * de escritorio no existe: el archivo va a `filesDir`, el directorio privado de la app, y la ruta
 * queda en logcat para poder sacarlo con `adb`.
 */
fun guardarDebug(actividad: Activity, contenido: ByteArray) {
    val archivo = File(actividad.filesDir, NOMBRE_ARCHIVO_DEBUG)
    archivo.outputStream().use { salida -> salida.write(contenido) }
    Log.i(TAG, "Ticket de debug guardado en ${archivo.absolutePath}")
}

internal fun cerrarSilencioso(cerrable: Closeable) {
    try {
        cerrable.close()
    } catch (_: Exception) {
        // Cerrar es el último paso (o el desbloqueo del vigilante): si falla, ya no hay nada que
        // hacer y taparlo evita que un error de cierre opaque el error real de la impresión.
    }
}
