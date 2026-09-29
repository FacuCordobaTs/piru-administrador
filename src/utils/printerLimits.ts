/**
 * Topes de los campos numéricos de un `PrinterTarget`.
 *
 * Los tres viajan a Rust con un tipo fijo: `serial.baud` y `usb-android.deviceId` son `u32` y
 * `tcp.port` es `u16`. Un número que no entre en ese tipo no lo rechaza la UI, lo rechaza
 * `serde` al deserializar, y el usuario ve un error crudo de IPC en vez de un mensaje que
 * entienda. Por eso los topes viven acá y los usan los dos lados: el formulario (que los explica
 * antes de guardar) y la validación de lo guardado (que descarta lo que Rust no podría leer).
 */

/** `tcp.port` es `u16`. */
export const LIMITE_U16 = 65_535

/** `serial.baud` y `usb-android.deviceId` son `u32`. */
export const LIMITE_U32 = 4_294_967_295

/**
 * Tope de baudios del formulario.
 *
 * El `u32` puro también lo aceptaría Rust, así que el límite no es de tipos sino práctico: 921600
 * es la última velocidad estándar del stack serie (Windows la acepta en el DCB y Linux la tiene
 * como `B921600`), y por encima no hay ninguna tasa real que un puerto pueda abrir. Las térmicas
 * usan 9600, 19200, 38400, 57600 o 115200, así que el tope no les queda cerca: sólo frena el
 * número tipeado de más, que antes moría en la deserialización.
 */
export const BAUD_MAXIMO = 921_600
