//! Puente Rust del plugin de impresión de Android.
//!
//! Los transportes —TCP, Bluetooth RFCOMM y USB Host— viven en Kotlin
//! (`android/src/main/java/app/piru/printing/`), porque ninguna de esas APIs es alcanzable desde
//! Rust: la NDK no tiene sockets RFCOMM ni `UsbManager`, y `serialport` no sirve en Android (no hay
//! `/dev/tty*` accesible sin root). Este crate es sólo el puente: registra la clase Kotlin y traduce
//! las llamadas a `PluginHandle::run_mobile_plugin`.
//!
//! El plugin no conoce el contrato de destinos a propósito: `PrinterTarget` es del binario
//! (`src/printer_target.rs`, congelado) y viaja como JSON opaco. Por eso `send_print_job` es
//! genérico sobre el tipo de destino y `get_printers` devuelve `serde_json::Value` sin validar: la
//! validación la hace el binario, que es el único que conoce el contrato.
//!
//! Se compila sólo en Android: la dependencia está gateada por target en el `Cargo.toml` de la app
//! y el `#![cfg]` de abajo hace que, fuera de Android, el crate quede vacío (y que cualquier uso
//! accidental falle al compilar en vez de mentir en runtime).

#![cfg(target_os = "android")]

use serde::Serialize;
use tauri::plugin::{mobile::PluginInvokeError, Builder, PluginHandle, TauriPlugin};
use tauri::{Manager, Runtime};

/// Comandos del plugin Kotlin. Tienen que coincidir **literalmente** con el nombre de los métodos
/// anotados con `@Command` en `PrintingPlugin.kt`: `PluginHandle.indexMethods()` los indexa por
/// `method.name`, así que esto no es una tabla de strings que se pueda renombrar de un lado.
const COMANDO_DESCUBRIR: &str = "getPrinters";
const COMANDO_IMPRIMIR: &str = "sendPrintJob";

/// Nombre del plugin en el `PluginManager` de Kotlin (`Builder::new("printing")`).
const NOMBRE_PLUGIN: &str = "printing";

/// Paquete y clase Kotlin. `register_android_plugin` arma el nombre JNI como
/// `paquete.reemplazando('.', '/') + "/" + clase`, así que el primero es un paquete (no una clase) y
/// el segundo el nombre simple de la clase.
const PAQUETE_KOTLIN: &str = "app.piru.printing";
const CLASE_KOTLIN: &str = "PrintingPlugin";

/// Handle al plugin Kotlin, registrado como estado de la app por el hook `setup`.
///
/// El binario lo recibe con `State<'_, Printers<Wry>>` en los comandos: `PluginHandle` no se puede
/// construir fuera del `setup` de un plugin (campos privados, sin `new()` ni
/// `app.plugin_handle("nombre")`), así que el estado es la única vía.
pub struct Printers<R: Runtime> {
    handle: PluginHandle<R>,
}

impl<R: Runtime> Printers<R> {
    /// Pide al plugin el descubrimiento de Android: impresoras USB Host y dispositivos Bluetooth
    /// emparejados (más el destino de debug). Devuelve el JSON crudo: validarlo contra el contrato
    /// es tarea del binario.
    pub fn get_printers(&self) -> Result<Vec<serde_json::Value>, String> {
        self.handle
            .run_mobile_plugin::<Vec<serde_json::Value>>(COMANDO_DESCUBRIR, serde_json::json!({}))
            .map_err(|e| describir(e, "descubrir las impresoras"))
    }

    /// Manda el ticket crudo (ESC/POS). `target` se serializa tal cual el contrato, así que el JSON
    /// que recibe Kotlin es el mismo que ve el frontend (`{"kind":"tcp","host":…}`).
    ///
    /// El contenido va como arreglo de números, igual que el `number[]` que manda el frontend: un
    /// `Vec<u8>` serializado por serde es una secuencia de enteros, sin base64 que decodificar.
    pub fn send_print_job<T: Serialize>(&self, target: &T, content: &[u8]) -> Result<(), String> {
        #[derive(Serialize)]
        struct Payload<'a, T: Serialize> {
            target: &'a T,
            content: &'a [u8],
        }

        self.handle
            .run_mobile_plugin::<()>(COMANDO_IMPRIMIR, Payload { target, content })
            .map_err(|e| describir(e, "imprimir"))
    }
}

/// Registra el plugin de Android. Se llama desde el binario en `run()`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new(NOMBRE_PLUGIN)
        .setup(|app, api| {
            let handle = api.register_android_plugin(PAQUETE_KOTLIN, CLASE_KOTLIN)?;
            app.manage(Printers { handle });
            Ok(())
        })
        .build()
}

/// Traduce el error del puente. Lo que importa —y lo único que el usuario puede accionar— es el
/// mensaje que mandó Kotlin (`InvokeRejected`): dice si faltó el permiso de Bluetooth, si no se
/// aceptó el diálogo de USB, si la impresora no está emparejada. El resto son fallas del puente.
fn describir(error: PluginInvokeError, accion: &str) -> String {
    match error {
        PluginInvokeError::InvokeRejected(rechazo) => rechazo
            .message
            .unwrap_or_else(|| format!("Android no pudo {} y no explicó por qué", accion)),
        otro => format!(
            "No se pudo {}: falla del puente con Android: {}",
            accion, otro
        ),
    }
}
