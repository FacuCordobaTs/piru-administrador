use std::fs::File;
use std::io::Write;
#[cfg(windows)]
use std::ptr::null_mut;
#[cfg(windows)]
use widestring::U16CString;

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{GetLastError, BOOL, FALSE, HANDLE},
    Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW,
        StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_DEFAULTSW,
        PRINTER_ENUM_LOCAL, PRINTER_INFO_2W,
    },
};

/// Devuelve una lista con los nombres de las impresoras instaladas en el sistema
#[tauri::command]
fn get_printers() -> Vec<String> {
    #[cfg(windows)]
    {
        let mut list = get_printers_windows();
        // AGREGAMOS ESTO: Una impresora virtual para tus pruebas
        list.push("GUARDAR EN ARCHIVO (DEBUG)".to_string());
        list
    }
    #[cfg(not(windows))]
    {
        vec!["GUARDAR EN ARCHIVO (DEBUG)".to_string()]
    }
}

#[cfg(windows)]
fn get_printers_windows() -> Vec<String> {
    let mut printers = Vec::new();
    let mut bytes_needed: u32 = 0;
    let mut num_printers: u32 = 0;

    // Primera llamada para obtener el tamaño del buffer necesario
    unsafe {
        EnumPrintersW(
            PRINTER_ENUM_LOCAL,
            null_mut(),
            2,
            null_mut(),
            0,
            &mut bytes_needed,
            &mut num_printers,
        );
    }

    if bytes_needed == 0 {
        return printers;
    }

    // Crear buffer y obtener la información de las impresoras
    let mut buffer: Vec<u8> = vec![0; bytes_needed as usize];

    unsafe {
        let result = EnumPrintersW(
            PRINTER_ENUM_LOCAL,
            null_mut(),
            2,
            buffer.as_mut_ptr(),
            bytes_needed,
            &mut bytes_needed,
            &mut num_printers,
        );

        if result != FALSE && num_printers > 0 {
            let printer_info = buffer.as_ptr() as *const PRINTER_INFO_2W;
            for i in 0..num_printers as isize {
                let info = &*printer_info.offset(i);
                if !info.pPrinterName.is_null() {
                    // Leer el string wide terminado en null
                    let mut len = 0;
                    while *info.pPrinterName.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(info.pPrinterName, len);
                    if let Ok(name) = String::from_utf16(slice) {
                        printers.push(name);
                    }
                }
            }
        }
    }

    printers
}

/// Envía bytes raw (ESC/POS) directamente a la impresora especificada
#[tauri::command]
fn send_print_job(printer_name: String, content: Vec<u8>) -> Result<(), String> {
    // 1. LOGICA DE DEBUG: Si es nuestra impresora virtual, guardamos en disco
    if printer_name == "GUARDAR EN ARCHIVO (DEBUG)" {
        let path = "ticket_debug.bin";
        match File::create(path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(&content) {
                    return Err(format!("Error escribiendo archivo: {}", e));
                }
                println!("Ticket guardado exitosamente en: {}", path);
                return Ok(());
            },
            Err(e) => return Err(format!("No se pudo crear el archivo: {}", e)),
        }
    }

    // 2. LOGICA NORMAL (WINDOWS):
    #[cfg(windows)]
    {
        send_print_job_windows(&printer_name, &content)
    }
    #[cfg(not(windows))]
    {
        Err("Impresión real solo soportada en Windows".to_string())
    }
}

#[cfg(windows)]
fn send_print_job_windows(printer_name: &str, content: &[u8]) -> Result<(), String> {
    let printer_name_wide = U16CString::from_str(printer_name)
        .map_err(|_| "Nombre de impresora inválido".to_string())?;
    
    let mut printer_handle: HANDLE = std::ptr::null_mut();

    // Abrir la impresora
    unsafe {
        let mut defaults = PRINTER_DEFAULTSW {
            pDatatype: null_mut(),
            pDevMode: null_mut(),
            DesiredAccess: 0,
        };
        
        let result: BOOL = OpenPrinterW(
            printer_name_wide.as_ptr() as *mut _,
            &mut printer_handle,
            &mut defaults,
        );

        if result == FALSE {
            let error = GetLastError();
            return Err(format!("No se pudo abrir la impresora '{}'. Error: {}", printer_name, error));
        }
    }

    // Crear el documento de impresión
    let doc_name_wide = U16CString::from_str("Tauri RAW Print").unwrap();
    let data_type_wide = U16CString::from_str("RAW").unwrap();
    
    let doc_info = DOC_INFO_1W {
        pDocName: doc_name_wide.as_ptr() as *mut _,
        pOutputFile: null_mut(),
        pDatatype: data_type_wide.as_ptr() as *mut _,
    };

    unsafe {
        let job_id = StartDocPrinterW(printer_handle, 1, &doc_info as *const DOC_INFO_1W);
        if job_id == 0 {
            let error = GetLastError();
            ClosePrinter(printer_handle);
            return Err(format!("No se pudo iniciar el documento de impresión. Error: {}", error));
        }

        let start_page_result: BOOL = StartPagePrinter(printer_handle);
        if start_page_result == FALSE {
            let error = GetLastError();
            EndDocPrinter(printer_handle);
            ClosePrinter(printer_handle);
            return Err(format!("No se pudo iniciar la página de impresión. Error: {}", error));
        }

        // Escribir los bytes raw
        let mut bytes_written: u32 = 0;
        let write_result: BOOL = WritePrinter(
            printer_handle,
            content.as_ptr() as *const _,
            content.len() as u32,
            &mut bytes_written,
        );

        if write_result == FALSE {
            let error = GetLastError();
            EndPagePrinter(printer_handle);
            EndDocPrinter(printer_handle);
            ClosePrinter(printer_handle);
            return Err(format!("Error al escribir en la impresora. Error: {}", error));
        }

        // Cerrar todo
        EndPagePrinter(printer_handle);
        EndDocPrinter(printer_handle);
        ClosePrinter(printer_handle);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_printers, send_print_job])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}