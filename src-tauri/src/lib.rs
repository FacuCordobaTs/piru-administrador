#[cfg(desktop)]
use std::fs::File;
#[cfg(desktop)]
use std::io::Write;
#[cfg(windows)]
use std::ptr::null_mut;
use std::sync::{Mutex, MutexGuard};
#[cfg(desktop)]
use std::time::Duration;
#[cfg(windows)]
use widestring::U16CString;
use tauri::State;

/// Contrato de transportes de impresión (espejo de `src/utils/printerTypes.ts`). El transporte ya
/// no se deduce de la forma del nombre: viaja explícito en cada llamada. El camino móvil está
/// esqueleteado (compila, delega a un stub) y lo completa el plugin Kotlin en la ola siguiente,
/// ver `docs/PRINTING_AND_DESKTOP.md`.
mod printer_target;

use printer_target::PrinterTarget;

/// Baud con el que se descubren los puertos serie. Es el 9600 fijo que tenía el código viejo para
/// cualquier `COM*` y el mismo que asume `migrateLegacyPrinterName()` en el frontend: las
/// impresoras ya configuradas siguen imprimiendo igual. Un destino `serial` explícito trae su
/// propio `baud` y no pasa por acá.
#[cfg(desktop)]
const DISCOVERED_SERIAL_BAUD: u32 = 9600;

/// Timeout de lectura/escritura del puerto serie, el que ya tenía el camino `COM*`.
#[cfg(desktop)]
const SERIAL_TIMEOUT: Duration = Duration::from_millis(2000);

/// Timeout de conexión TCP. Es obligatorio: sin él, una IP equivocada espera el reintento del
/// stack (~20 s) y, como los trabajos van serializados, arrastra también a las comandas que
/// vienen detrás.
#[cfg(desktop)]
const TCP_CONNECT_TIMEOUT: Duration = Duration::from_secs(3);

/// Timeout de escritura TCP: una impresora que acepta la conexión y después deja de leer dejaría
/// el `write_all` bloqueado para siempre. Un ticket entero en una LAN tarda milisegundos.
#[cfg(desktop)]
const TCP_WRITE_TIMEOUT: Duration = Duration::from_secs(5);

/// Canal RFCOMM por defecto. El contrato (`PrinterTarget::Bluetooth`) sólo trae la MAC, así que
/// se usa el canal donde escuchan las térmicas SPP típicas. La alternativa —resolver el servicio
/// por SDP con `serviceClassId`— no es alcanzable desde `windows-sys`: el crate trae
/// `RFCOMM_PROTOCOL_UUID16` pero no el UUID de 128 bits `RFCOMM_PROTOCOL_UUID`.
#[cfg(windows)]
const RFCOMM_CHANNEL: u32 = 1;

/// Timeout para establecer el canal RFCOMM: contra una impresora apagada el stack hace *paging*
/// durante decenas de segundos. Se conecta en modo no bloqueante y se acota con `select`.
#[cfg(windows)]
const BLUETOOTH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Serializa todos los trabajos de impresión: dos comandas que lleguen "al mismo tiempo"
/// (ej. varios pedidos creados juntos) no deben pelear por el mismo puerto serial/impresora.
/// Sin esto, abrir el mismo puerto COM dos veces en simultáneo falla para una de las dos
/// y esa comanda se pierde silenciosamente.
struct PrintQueue(Mutex<()>);

impl PrintQueue {
    /// Toma el turno de impresión. Si el mutex quedó "envenenado" por un panic previo (no debería
    /// pasar, pero por las dudas) lo recuperamos en vez de tirar todos los próximos prints para
    /// siempre.
    ///
    /// En móvil las llamadas al plugin Kotlin van **siempre** por acá, incluido `get_printers`, que
    /// en desktop no lo necesita. El motivo no es la impresora sino `tauri`: en 2.10.2 el
    /// `handle_android_plugin_response` que contesta una llamada al plugin espera
    /// `PENDING_PLUGIN_CALLS` y, del otro lado, `run_command` la toma para insertar la llamada; si
    /// hay dos llamadas en vuelo, la respuesta de una puede quedar esperando ese lock mientras la
    /// otra lo tiene tomado esperando a la UI (que es la que entrega la respuesta). El síntoma es
    /// que la app se cuelga en la primera impresión. Ya está arreglado en 2.11.5 (suelta el lock
    /// antes de llamar al handler), pero no podemos actualizar: serializar las llamadas en un solo
    /// turno elimina la carrera sin tocar la versión de `tauri`.
    fn turno(&self) -> MutexGuard<'_, ()> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{GetLastError, BOOL, FALSE, HANDLE},
    Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_DEFAULTSW, PRINTER_ENUM_LOCAL,
        PRINTER_INFO_2W,
    },
};

/// Devuelve los destinos que se pueden descubrir solos: los puertos serie del sistema, las
/// impresoras instaladas y la impresora virtual de debug. TCP y Bluetooth se cargan a mano desde
/// la UI porque no hay forma de enumerarlos sin sondear la red.
///
/// Android devuelve lo mismo pero desde el plugin Kotlin (USB Host + Bluetooth emparejado), y la
/// llamada toma el turno de impresión: ver [`PrintQueue::turno`].
#[tauri::command]
#[cfg(target_os = "android")]
fn get_printers(
    print_queue: State<'_, PrintQueue>,
    printers: State<'_, tauri_plugin_printing::Printers<tauri::Wry>>,
) -> Vec<PrinterTarget> {
    let _turno = print_queue.turno();

    let destinos = match printers.get_printers() {
        Ok(destinos) => destinos,
        Err(error) => {
            // El descubrimiento no puede romper la pantalla de ajustes: si el plugin falla, la
            // lista va vacía y el usuario igual puede cargar un destino a mano. El motivo queda en
            // el log (y en logcat) para poder diagnosticarlo.
            log::warn!("No se pudieron descubrir impresoras en Android: {error}");
            return Vec::new();
        }
    };

    destinos
        .into_iter()
        // El plugin entrega JSON del contrato sin tiparlo (no puede depender de `printer_target`),
        // así que la validación la hace acá Rust, que es el dueño del contrato. Un destino que no
        // se entiende se descarta en vez de tirar abajo toda la lista.
        .filter_map(|destino| match serde_json::from_value::<PrinterTarget>(destino) {
            Ok(target) => Some(target),
            Err(error) => {
                log::warn!("Destino de impresión desconocido devuelto por Android: {error}");
                None
            }
        })
        .collect()
}

#[tauri::command]
#[cfg(desktop)]
fn get_printers() -> Vec<PrinterTarget> {
    let mut list = Vec::new();

    // 1. Agregar los Puertos COM (Acá van a aparecer las térmicas Bluetooth expuestas como
    //    serial y los adaptadores USB-a-serie).
    list.extend(serial_targets());

    // 2. Las impresoras instaladas en el sistema (spooler de Windows).
    #[cfg(windows)]
    list.extend(
        get_printers_windows()
            .into_iter()
            .map(|name| PrinterTarget::Spooler { name }),
    );

    // 3. La impresora virtual de debug, que deja el ticket en un archivo en vez de imprimirlo.
    list.push(PrinterTarget::DebugFile);

    list
}

/// iOS: no tiene ninguno de los transportes de este archivo (ni `serialport` —que sólo compila en
/// desktop— ni el plugin Kotlin, que es de Android). La lista va vacía a propósito: es preferible
/// que el usuario no vea destinos a que vea destinos que no pueden funcionar.
#[tauri::command]
#[cfg(all(mobile, not(target_os = "android")))]
fn get_printers() -> Vec<PrinterTarget> {
    Vec::new()
}

/// Puertos serie del sistema. Todos con el baud histórico (ver `DISCOVERED_SERIAL_BAUD`): cambiarlo
/// acá rompería las impresoras que el usuario ya tenía andando.
#[cfg(desktop)]
fn serial_targets() -> Vec<PrinterTarget> {
    serialport::available_ports()
        .unwrap_or_default()
        .into_iter()
        .map(|port| PrinterTarget::Serial {
            port: port.port_name,
            baud: DISCOVERED_SERIAL_BAUD,
        })
        .collect()
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

/// Envía bytes raw (ESC/POS) al destino indicado.
///
/// El transporte no se adivina: lo dice `target`. Antes se deducía de la forma del nombre
/// (`COM*` → serie a 9600, el nombre mágico → archivo, cualquier otra cosa → spooler), lo que
/// hacía imposible imprimir por red sin instalar la impresora o por Bluetooth sin emparejarla.
///
/// Android: todo el transporte lo implementa el plugin Kotlin, y la llamada pasa por el turno de
/// impresión como cualquier otra (ver [`PrintQueue::turno`]).
#[tauri::command]
#[cfg(target_os = "android")]
fn send_print_job(
    target: PrinterTarget,
    content: Vec<u8>,
    print_queue: State<'_, PrintQueue>,
    printers: State<'_, tauri_plugin_printing::Printers<tauri::Wry>>,
) -> Result<(), String> {
    let _turno = print_queue.turno();
    printers.send_print_job(&target, &content)
}

#[tauri::command]
#[cfg(desktop)]
fn send_print_job(
    target: PrinterTarget,
    content: Vec<u8>,
    print_queue: State<'_, PrintQueue>,
) -> Result<(), String> {
    // Un solo trabajo de impresión a la vez. Si el mutex quedó "envenenado" por un panic
    // previo (no debería pasar, pero por las dudas) lo recuperamos en vez de tirar todos
    // los próximos prints para siempre.
    let _guard = print_queue.turno();
    send_print_job_desktop(&target, &content)
}

/// iOS: mismo caso que `get_printers` — no hay transporte posible, así que se falla con un mensaje
/// claro en vez de intentar algo que no existe.
#[tauri::command]
#[cfg(all(mobile, not(target_os = "android")))]
fn send_print_job(
    target: PrinterTarget,
    _content: Vec<u8>,
    print_queue: State<'_, PrintQueue>,
) -> Result<(), String> {
    let _turno = print_queue.turno();
    // Ni siquiera `DebugFile` se puede resolver acá: `ticket_debug.bin` es una ruta relativa al
    // directorio de trabajo y en un dispositivo móvil no hay uno escribible.
    Err(format!(
        "Impresión todavía no implementada en esta plataforma ({:?})",
        target
    ))
}

#[cfg(desktop)]
fn send_print_job_desktop(target: &PrinterTarget, content: &[u8]) -> Result<(), String> {
    match target {
        // Spooler Win32 con datatype RAW: el camino de siempre, sin cambios.
        PrinterTarget::Spooler { name } => {
            #[cfg(windows)]
            {
                send_print_job_windows(name, content)
            }
            #[cfg(not(windows))]
            {
                Err(format!(
                    "'{}' es una impresora del spooler de Windows: en esta plataforma no hay spooler",
                    name
                ))
            }
        }

        PrinterTarget::Serial { port, baud } => send_serial(port, *baud, content),

        PrinterTarget::Tcp { host, port } => send_tcp(host, *port, content),

        // En Windows el BT ya se puede usar como COM emparejado (`Serial`); esto es el atajo
        // nativo, sin emparejar ni instalar nada.
        PrinterTarget::Bluetooth { mac } => {
            #[cfg(windows)]
            {
                bluetooth::send_job(mac, content)
            }
            #[cfg(not(windows))]
            {
                Err(format!(
                    "Bluetooth nativo sólo está implementado en Windows: en esta plataforma la \
                     impresora se usa como puerto serie (destino {})",
                    mac
                ))
            }
        }

        // USB Host sólo existe en Android: desde el escritorio este destino no es alcanzable.
        PrinterTarget::UsbAndroid { .. } => {
            Err("El transporte USB Host sólo está disponible en Android".to_string())
        }

        PrinterTarget::DebugFile => save_debug_file(content),
    }
}

/// Impresora virtual de debug: guarda el ticket en `ticket_debug.bin`, al lado del ejecutable.
/// Es el comportamiento que tenía el nombre mágico "GUARDAR EN ARCHIVO (DEBUG)".
#[cfg(desktop)]
fn save_debug_file(content: &[u8]) -> Result<(), String> {
    let path = "ticket_debug.bin";
    match File::create(path) {
        Ok(mut file) => {
            if let Err(e) = file.write_all(content) {
                return Err(format!("Error escribiendo archivo: {}", e));
            }
            println!("Ticket guardado exitosamente en: {}", path);
            Ok(())
        }
        Err(e) => Err(format!("No se pudo crear el archivo: {}", e)),
    }
}

/// Puerto serie (COM en Windows, `/dev/tty*` en Linux): térmicas Bluetooth expuestas como SPP y
/// adaptadores USB-a-serie. Único cambio respecto del camino viejo: el baud viene del destino en
/// vez de estar fijo en 9600.
#[cfg(desktop)]
fn send_serial(port_name: &str, baud: u32, content: &[u8]) -> Result<(), String> {
    let mut port = serialport::new(port_name, baud)
        .timeout(SERIAL_TIMEOUT)
        .open()
        .map_err(|e| format!("Error abriendo puerto serial {} ({} baudios): {}", port_name, baud, e))?;

    port.write_all(content)
        .map_err(|e| format!("Error escribiendo en puerto serial: {}", e))
}

/// Impresora de red por el puerto raw (9100 en las térmicas). No necesita el spooler: se conecta,
/// escribe los bytes y cierra. Es lo que permite imprimir en red desde Windows sin instalar la
/// impresora.
#[cfg(desktop)]
fn send_tcp(host: &str, port: u16, content: &[u8]) -> Result<(), String> {
    use std::net::{TcpStream, ToSocketAddrs};

    // Resolver primero y conectar después: así el timeout cubre la conexión y no se pierde en la
    // resolución de nombres.
    let address = (host, port)
        .to_socket_addrs()
        .map_err(|e| format!("No se pudo resolver {}:{}: {}", host, port, e))?
        .next()
        .ok_or_else(|| format!("{}:{} no resolvió a ninguna dirección", host, port))?;

    let mut stream = TcpStream::connect_timeout(&address, TCP_CONNECT_TIMEOUT)
        .map_err(|e| format!("No se pudo conectar con {}:{}: {}", host, port, e))?;

    stream
        .set_write_timeout(Some(TCP_WRITE_TIMEOUT))
        .map_err(|e| format!("No se pudo configurar el timeout de escritura: {}", e))?;

    // Al salir de la función el stream se cierra solo; el cierre es ordenado (el kernel manda lo
    // que quedó en el buffer antes del FIN), así que no hace falta un `flush` explícito.
    stream
        .write_all(content)
        .map_err(|e| format!("Error escribiendo en la impresora de red {}:{}: {}", host, port, e))
}

/// Lo único verificable de TCP sin impresora física: que los bytes salgan y que el timeout acote
/// de verdad la espera. Lo segundo importa tanto como lo primero: sin timeout, una IP equivocada
/// deja la comanda colgada y detrás de ella todas las demás (los trabajos van serializados).
#[cfg(all(test, desktop))]
mod tcp_tests {
    use super::{send_tcp, TCP_CONNECT_TIMEOUT};
    use std::io::Read;
    use std::net::TcpListener;
    use std::time::{Duration, Instant};

    /// La impresora de mentira: escucha, recibe todo hasta el cierre y devuelve lo que llegó.
    #[test]
    fn entrega_los_bytes_raw_y_cierra_la_conexion() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("no se pudo escuchar en loopback");
        let port = listener.local_addr().unwrap().port();

        let impresora = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("no llegó ninguna conexión");
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .expect("no se pudo configurar el timeout de lectura");
            let mut recibido = Vec::new();
            // Termina con el FIN del otro lado: es también la prueba de que el cierre ordenado
            // alcanza y no hace falta un `flush` explícito.
            stream
                .read_to_end(&mut recibido)
                .expect("no se pudo leer lo que mandó la impresora");
            recibido
        });

        // Bytes con los que arranca un ticket real (init + texto + corte) y con un 0x00 adentro,
        // que es lo que rompería cualquier camino que trate el contenido como texto.
        let content: &[u8] = b"\x1b@Comanda 42\x1dV\x00";
        send_tcp("127.0.0.1", port, content).expect("send_tcp falló contra un listener de loopback");

        assert_eq!(impresora.join().unwrap(), content);
    }

    /// Puerto cerrado: tiene que fallar rápido y con el mensaje de conexión, no con el de timeout.
    #[test]
    fn rechaza_un_puerto_cerrado_sin_agotar_el_timeout() {
        // Se toma un puerto libre y se suelta: nadie escucha ahí.
        let port = TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();

        let inicio = Instant::now();
        let error = send_tcp("127.0.0.1", port, b"x").expect_err("un puerto cerrado no es un error");
        let transcurrido = inicio.elapsed();

        assert!(
            error.contains("No se pudo conectar"),
            "error inesperado: {}",
            error
        );
        assert!(
            transcurrido < TCP_CONNECT_TIMEOUT,
            "tardó {:?} en rechazar un puerto cerrado",
            transcurrido
        );
    }

    /// IP que no contesta (TEST-NET-1, RFC 5737: reservada para documentación, nunca ruteable).
    /// Es el caso que motivó el timeout: si esto no vuelve, la UI queda colgada para siempre.
    #[test]
    fn el_timeout_acota_la_espera_contra_una_ip_que_no_contesta() {
        let inicio = Instant::now();
        let error = send_tcp("192.0.2.1", 9100, b"x")
            .expect_err("no hay ninguna impresora en la red de documentación");
        let transcurrido = inicio.elapsed();

        assert!(
            error.contains("192.0.2.1:9100"),
            "error inesperado: {}",
            error
        );
        // Margen sobre el timeout: el veredicto del stack puede demorar un poco más que el
        // `select`/`connect_timeout`, pero nunca los ~20 s del reintento por defecto.
        assert!(
            transcurrido < TCP_CONNECT_TIMEOUT + Duration::from_secs(5),
            "tardó {:?}: el timeout no está acotando la espera",
            transcurrido
        );
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
            return Err(format!(
                "No se pudo abrir la impresora '{}'. Error: {}",
                printer_name, error
            ));
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
            return Err(format!(
                "No se pudo iniciar el documento de impresión. Error: {}",
                error
            ));
        }

        let start_page_result: BOOL = StartPagePrinter(printer_handle);
        if start_page_result == FALSE {
            let error = GetLastError();
            EndDocPrinter(printer_handle);
            ClosePrinter(printer_handle);
            return Err(format!(
                "No se pudo iniciar la página de impresión. Error: {}",
                error
            ));
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
            return Err(format!(
                "Error al escribir en la impresora. Error: {}",
                error
            ));
        }

        // Cerrar todo
        EndPagePrinter(printer_handle);
        EndDocPrinter(printer_handle);
        ClosePrinter(printer_handle);
    }

    Ok(())
}

/// Bluetooth RFCOMM nativo de Windows (`AF_BTH`/`BTHPROTO_RFCOMM`). En un módulo aparte porque es
/// Windows puro —Winsock y la API de Bluetooth— y el resto del archivo no necesita saber qué es
/// un `SOCKET`.
///
/// En Windows el Bluetooth ya funciona vía `Serial` (la impresora emparejada aparece como COM),
/// así que éste es el atajo: imprime contra la MAC sin emparejarla como puerto.
///
/// Es el transporte más frágil de todos y no está probado contra hardware. Dos cosas quedan sin
/// verificar a propósito, y son las primeras a mirar si no imprime:
///
/// - el orden de bytes de la MAC en `btAddr`: se usa el de `BLUETOOTH_ADDRESS.ullLong`, con el
///   primer octeto en el byte más significativo (`AA:BB:CC:DD:EE:FF` → `0xAABBCCDDEEFF`);
/// - el largo que espera `connect`: `size_of::<SOCKADDR_BTH>()`, que da 30 por el `packed(1)`.
#[cfg(windows)]
mod bluetooth {
    use windows_sys::Win32::Devices::Bluetooth::{AF_BTH, BTHPROTO_RFCOMM, SOCKADDR_BTH};
    use windows_sys::Win32::Networking::WinSock::{
        closesocket, connect, getsockopt, ioctlsocket, select, send, shutdown, FD_SET, FIONBIO,
        INVALID_SOCKET, SD_SEND, SOCK_STREAM, SOCKADDR, SOCKET, SOCKET_ERROR, SO_ERROR, SOL_SOCKET,
        TIMEVAL, WSACleanup, WSADATA, WSAEWOULDBLOCK, WSAGetLastError, WSASocketW, WSAStartup,
    };

    use super::{BLUETOOTH_CONNECT_TIMEOUT, RFCOMM_CHANNEL};

    /// Conecta al canal RFCOMM de `mac` y escribe `content`. Todo lo que puede salir mal sale como
    /// `Err` con el código de Winsock: es lo único que el usuario va a poder ver si no imprime.
    pub(super) fn send_job(mac: &str, content: &[u8]) -> Result<(), String> {
        let bt_addr = parse_mac(mac)?;

        // Sin Winsock inicializada `WSASocketW` falla. `WSAStartup` es por referencias: el guard
        // devuelve la que pide, así que da igual si el proceso ya la tenía inicializada.
        let _winsock = WinsockSession::start()?;

        unsafe {
            let handle = WSASocketW(
                AF_BTH as i32,
                SOCK_STREAM,
                BTHPROTO_RFCOMM as i32,
                std::ptr::null(),
                0,
                0,
            );
            if handle == INVALID_SOCKET {
                return Err(format!(
                    "No se pudo crear el socket Bluetooth (error {})",
                    WSAGetLastError()
                ));
            }
            // El socket se cierra en cualquier salida, incluidas las que van con `?`.
            let socket = CloseSocket(handle);

            // `SOCKADDR_BTH` es `#[repr(C, packed(1))]`, así que no se puede tomar referencia a
            // ninguno de sus campos (E0793): los valores se pasan por locales, como acá.
            let address = SOCKADDR_BTH {
                addressFamily: AF_BTH,
                btAddr: bt_addr,
                serviceClassId: windows_sys::core::GUID::from_u128(0),
                port: RFCOMM_CHANNEL,
            };

            let mut nonblocking: u32 = 1;
            if ioctlsocket(socket.0, FIONBIO, &mut nonblocking) != 0 {
                return Err(format!(
                    "No se pudo poner el socket Bluetooth en modo no bloqueante (error {})",
                    WSAGetLastError()
                ));
            }

            let connected = connect(
                socket.0,
                &address as *const SOCKADDR_BTH as *const SOCKADDR,
                std::mem::size_of::<SOCKADDR_BTH>() as i32,
            );

            if connected == SOCKET_ERROR {
                let error = WSAGetLastError();
                // Lo esperado en modo no bloqueante: la conexión sigue en curso.
                if error != WSAEWOULDBLOCK {
                    return Err(connect_error(mac, error));
                }
                wait_until_writable(socket.0, mac)?;
            }

            // De vuelta a bloqueante para escribir: así `send` no devuelve `WSAEWOULDBLOCK`.
            let mut blocking: u32 = 0;
            if ioctlsocket(socket.0, FIONBIO, &mut blocking) != 0 {
                return Err(format!(
                    "No se pudo restaurar el modo bloqueante del socket Bluetooth (error {})",
                    WSAGetLastError()
                ));
            }

            send_all(socket.0, content, mac)?;

            // Corta el envío: la impresora ve el fin de los datos y no espera más.
            shutdown(socket.0, SD_SEND);
        }

        Ok(())
    }

    /// `AA:BB:CC:DD:EE:FF` → el `u64` de `SOCKADDR_BTH::btAddr`. Se aceptan `:` y `-` como
    /// separadores (los dos formatos que se ven en las etiquetas de las térmicas).
    fn parse_mac(mac: &str) -> Result<u64, String> {
        let hex: String = mac.chars().filter(|c| *c != ':' && *c != '-').collect();
        if hex.len() != 12 {
            return Err(format!(
                "MAC de Bluetooth inválida '{}': se esperaban 6 octetos",
                mac
            ));
        }
        u64::from_str_radix(&hex, 16)
            .map_err(|_| format!("MAC de Bluetooth inválida '{}': no es hexadecimal", mac))
    }

    /// Espera a que el `connect` no bloqueante se resuelva, con techo de tiempo.
    ///
    /// Que el socket quede "escribible" no alcanza: el error de conexión también lo deja así, por
    /// eso el veredicto lo da `SO_ERROR`.
    fn wait_until_writable(socket: SOCKET, mac: &str) -> Result<(), String> {
        unsafe {
            let mut write_set: FD_SET = std::mem::zeroed();
            write_set.fd_count = 1;
            write_set.fd_array[0] = socket;

            let mut timeout = TIMEVAL {
                tv_sec: BLUETOOTH_CONNECT_TIMEOUT.as_secs() as i32,
                tv_usec: 0,
            };

            // `nfds` se ignora en Windows; el timeout es el único techo que tiene este camino.
            let ready = select(
                0,
                std::ptr::null_mut(),
                &mut write_set,
                std::ptr::null_mut(),
                &mut timeout,
            );

            if ready == 0 {
                return Err(format!(
                    "Se agotó el tiempo ({} s) esperando la conexión con la impresora Bluetooth {}",
                    BLUETOOTH_CONNECT_TIMEOUT.as_secs(),
                    mac
                ));
            }
            if ready == SOCKET_ERROR {
                return Err(format!(
                    "Error esperando la conexión con la impresora Bluetooth {} (error {})",
                    mac,
                    WSAGetLastError()
                ));
            }

            let mut so_error: i32 = 0;
            let mut length = std::mem::size_of::<i32>() as i32;
            if getsockopt(
                socket,
                SOL_SOCKET,
                SO_ERROR,
                &mut so_error as *mut i32 as *mut u8,
                &mut length,
            ) != 0
            {
                return Err(format!(
                    "No se pudo leer el estado del socket Bluetooth (error {})",
                    WSAGetLastError()
                ));
            }
            if so_error != 0 {
                return Err(connect_error(mac, so_error));
            }
        }

        Ok(())
    }

    fn send_all(socket: SOCKET, content: &[u8], mac: &str) -> Result<(), String> {
        let mut sent = 0;

        while sent < content.len() {
            let written = unsafe {
                send(
                    socket,
                    content[sent..].as_ptr(),
                    (content.len() - sent) as i32,
                    0,
                )
            };

            if written <= 0 {
                return Err(format!(
                    "Error escribiendo en la impresora Bluetooth {} después de {} bytes (error {})",
                    mac,
                    sent,
                    unsafe { WSAGetLastError() }
                ));
            }

            sent += written as usize;
        }

        Ok(())
    }

    fn connect_error(mac: &str, code: i32) -> String {
        format!(
            "No se pudo conectar con la impresora Bluetooth {} (error {}). Verificá que esté \
             encendida, al alcance y con el canal RFCOMM {} abierto",
            mac, code, RFCOMM_CHANNEL
        )
    }

    /// Cierra el socket pase lo que pase: un `?` en el medio del camino no debe filtrar handles.
    struct CloseSocket(SOCKET);

    impl Drop for CloseSocket {
        fn drop(&mut self) {
            unsafe {
                closesocket(self.0);
            }
        }
    }

    /// Winsock tiene que estar inicializada para `WSASocketW`; si nadie lo hizo en el proceso,
    /// esta es la llamada que lo hace. El `Drop` devuelve la referencia que pidió `WSAStartup`.
    struct WinsockSession;

    impl WinsockSession {
        fn start() -> Result<Self, String> {
            /// `MAKEWORD(2, 2)`: la versión 2.2 de Winsock. `windows-sys` no trae el macro.
            const WINSOCK_VERSION_2_2: u16 = 0x0202;

            unsafe {
                let mut data: WSADATA = std::mem::zeroed();
                let error = WSAStartup(WINSOCK_VERSION_2_2, &mut data);
                if error != 0 {
                    return Err(format!("No se pudo inicializar Winsock (error {})", error));
                }
            }

            Ok(WinsockSession)
        }
    }

    impl Drop for WinsockSession {
        fn drop(&mut self) {
            unsafe {
                WSACleanup();
            }
        }
    }

    /// El parseo de la MAC es lo único del camino Bluetooth que se puede verificar sin hardware, y
    /// es donde un error no daría un mensaje claro: `connect` simplemente no encontraría la
    /// impresora.
    #[cfg(test)]
    mod tests {
        use super::parse_mac;

        #[test]
        fn parsea_la_mac_en_los_dos_formatos_de_las_etiquetas() {
            assert_eq!(parse_mac("AA:BB:CC:DD:EE:FF").unwrap(), 0xAABB_CCDD_EEFF);
            assert_eq!(parse_mac("aa-bb-cc-dd-ee-ff").unwrap(), 0xAABB_CCDD_EEFF);
        }

        #[test]
        fn rechaza_lo_que_no_es_una_mac() {
            for mac in ["", "AA:BB:CC:DD:EE", "AA:BB:CC:DD:EE:FF:00", "ZZ:BB:CC:DD:EE:FF"] {
                assert!(parse_mac(mac).is_err(), "debería rechazar {:?}", mac);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .manage(PrintQueue(Mutex::new(())));

    // `tauri-plugin-updater` no existe en Android: la dependencia está gateada en `Cargo.toml` y
    // el registro acá. `tauri-build` emite `desktop` para todo lo que no sea Android/iOS. Se
    // reasigna con `let` (en vez de una variable `mut` con `#[cfg]` adentro) para que en móvil no
    // quede un `mut` sin usar.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    // Los transportes de Android (TCP, Bluetooth y USB Host) viven en el plugin Kotlin. El
    // `setup` del plugin es el único lugar donde se puede construir el `PluginHandle`, y deja el
    // handle en el estado de la app, que es de donde lo toman los dos comandos.
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_printing::init());

    builder
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
        .invoke_handler(tauri::generate_handler![get_printers, send_print_job])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
