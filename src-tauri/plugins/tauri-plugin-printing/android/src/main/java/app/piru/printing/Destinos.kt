package app.piru.printing

import org.json.JSONObject

/**
 * Espejo Kotlin de `PrinterTarget` (Rust: `admin/src-tauri/src/printer_target.rs`, contrato
 * congelado, y TS: `admin/src/utils/printerTypes.ts`). El JSON que llega es el mismo que ve el
 * frontend: `kind` elige el transporte y el resto de los campos son los de ese transporte.
 *
 * Un `kind` desconocido o un campo que falta se rechaza con una excepción, no con un default
 * silencioso: es preferible que el usuario lea "destino desconocido" a que el ticket salga por otra
 * impresora.
 *
 * `Spooler` y `Serial` existen en la UI (son destinos válidos en Windows) pero en Android no tienen
 * implementación posible: se modelan igual para poder rechazarlos con un mensaje que se entienda.
 */
sealed class Destino {
    data class Spooler(val nombre: String) : Destino()
    data class Serial(val puerto: String, val baudios: Int) : Destino()
    data class Tcp(val host: String, val puerto: Int) : Destino()
    data class Bluetooth(val mac: String) : Destino()
    data class UsbAndroid(val deviceId: Int) : Destino()
    object DebugFile : Destino()

    companion object {
        fun desdeJson(json: JSONObject): Destino = when (val kind = json.getString("kind")) {
            "spooler" -> Spooler(json.getString("name"))
            "serial" -> Serial(json.getString("port"), json.getInt("baud"))
            "tcp" -> Tcp(json.getString("host"), json.getInt("port"))
            "bluetooth" -> Bluetooth(json.getString("mac"))
            // El contrato usa `deviceId` (camelCase) porque el frontend lo emite así.
            "usb-android" -> UsbAndroid(json.getInt("deviceId"))
            "debug-file" -> DebugFile
            else -> throw IllegalArgumentException("Tipo de destino desconocido: '$kind'")
        }
    }
}
