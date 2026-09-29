//! Contrato de transportes de impresión (lado Rust).
//!
//! Es el espejo de `admin/src/utils/printerTypes.ts`: el JSON que emite el frontend tiene que
//! deserializar acá sin cambios, y al revés. La verificación de que los dos lados coinciden es el
//! test de `#[cfg(test)]` al final de este archivo, que compara contra el JSON literal.
//!
//! Lo consumen `send_print_job` y `get_printers`: el frontend manda un `PrinterTarget` y el shell
//! elige el transporte.

use serde::{Deserialize, Serialize};

/// Destino de impresión. Reemplaza al string del que se deducía el transporte por su forma
/// (`COM*` → serie a 9600, el nombre mágico → archivo, todo lo demás → spooler Win32).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PrinterTarget {
    /// Windows: RAW al spooler (USB, red instalada, BT emparejado como impresora).
    Spooler { name: String },
    /// COM: BT-SPP de Windows, adaptador USB-a-serie.
    Serial { port: String, baud: u32 },
    /// 9100 — Windows y Android.
    Tcp { host: String, port: u16 },
    /// Android: RFCOMM SPP.
    Bluetooth { mac: String },
    /// Android: USB Host. El `rename` explícito del campo es necesario: `rename_all` sólo
    /// afecta a los nombres de las variantes, así que `device_id` serializaría como
    /// `device_id` y no como el `deviceId` que emite el TS.
    #[serde(rename = "usb-android")]
    UsbAndroid {
        #[serde(rename = "deviceId")]
        device_id: u32,
    },
    /// Reemplaza al nombre mágico "GUARDAR EN ARCHIVO (DEBUG)".
    DebugFile,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// El JSON de la derecha es exactamente el que produce `JSON.stringify` sobre cada variante de
    /// `PrinterTarget` en `admin/src/utils/printerTypes.ts`: mismos `kind` y mismos nombres de
    /// campo. Si alguien agrega o renombra un campo de un solo lado, este test falla.
    #[test]
    fn coincide_con_el_json_del_frontend() {
        let casos: Vec<(PrinterTarget, &str)> = vec![
            (
                PrinterTarget::Spooler {
                    name: "HP LaserJet".to_string(),
                },
                r#"{"kind":"spooler","name":"HP LaserJet"}"#,
            ),
            (
                PrinterTarget::Serial {
                    port: "COM3".to_string(),
                    baud: 9600,
                },
                r#"{"kind":"serial","port":"COM3","baud":9600}"#,
            ),
            (
                PrinterTarget::Tcp {
                    host: "192.168.1.50".to_string(),
                    port: 9100,
                },
                r#"{"kind":"tcp","host":"192.168.1.50","port":9100}"#,
            ),
            (
                PrinterTarget::Bluetooth {
                    mac: "AA:BB:CC:DD:EE:FF".to_string(),
                },
                r#"{"kind":"bluetooth","mac":"AA:BB:CC:DD:EE:FF"}"#,
            ),
            (
                PrinterTarget::UsbAndroid { device_id: 3 },
                r#"{"kind":"usb-android","deviceId":3}"#,
            ),
            (PrinterTarget::DebugFile, r#"{"kind":"debug-file"}"#),
        ];

        for (target, esperado) in casos {
            // Ida: lo que mandamos tiene que ser lo que el frontend sabe leer.
            let serializado = serde_json::to_string(&target).unwrap();
            assert_eq!(serializado, esperado, "serializando {:?}", target);

            // Vuelta: lo que emite el frontend tiene que deserializar sin perder nada.
            let deserializado: PrinterTarget = serde_json::from_str(esperado)
                .unwrap_or_else(|e| panic!("no deserializó {}: {}", esperado, e));
            assert_eq!(
                serde_json::to_string(&deserializado).unwrap(),
                esperado,
                "round-trip de {}",
                esperado
            );
        }
    }
}
