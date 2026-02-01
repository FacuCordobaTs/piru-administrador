import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Definimos los tipos para qz-tray ya que no tiene tipos oficiales de TS por defecto importados asi
declare global {
    interface Window {
        qz: any;
    }
}

interface QZContextType {
    isConnected: boolean;
    findPrinters: () => Promise<string[]>;
    print: (printerName: string | null, data: any[]) => Promise<void>;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    defaultPrinter: string | null;
    setDefaultPrinter: (printer: string) => void;
}

const QZContext = createContext<QZContextType | undefined>(undefined);

export const QZProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [defaultPrinter, setDefaultPrinter] = useState<string | null>(() => {
        return localStorage.getItem('qz_default_printer');
    });

    useEffect(() => {
        if (defaultPrinter) {
            localStorage.setItem('qz_default_printer', defaultPrinter);
        }
    }, [defaultPrinter]);

    const connect = async () => {
        if (!window.qz) {
            console.error('QZ Tray script not loaded');
            return;
        }

        try {
            if (!window.qz.websocket.isActive()) {
                // Configure security BEFORE connecting to avoid permission popups
                window.qz.security.setCertificatePromise(function (_resolve: (cert: string) => void, _reject: (err: any) => void) {
                    _resolve(`-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZwalXoEMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDEzMTE5MDIwOVoXDTQ2MDEzMTE5MDIwOVowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDK
vPA7hG6+ym/JhPZ9jDBToQ58FIMt/vyzixTmk0v5QF/EOkg3f7cR3y/gC6es/iso
wrfRfosBZUI4SlDYSQgWz9D/iC4Bi9sRgE+zr9AUTqlII4tTgCu7vJ8/Q71uEmIS
RXPj0FG/Aqt2Dg39hyKMaEWm0CaJ+otebWOQHHYUqxmysWmdT74rTue4ndCXYZU8
PNwQY1ZjUW8N2AwJVy+N7pTfajPpVCCSXFZ0qGKc3F5CuogsgoXHvW3RfvHgGWFP
uWTflDozUd2WvXnTIeeGFA1LlGFJopOTCZeq059G5z2Mx+jePbs540UN21mXi933
+jHout8vKJKXWoIQnWnDAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBRmzM2mzKPUZZ/fayF00KEFhM46MjANBgkq
hkiG9w0BAQsFAAOCAQEAMv3J4MJYViQtzq1UqxByfhyjg+x3y3jP17u2m2ptcGwX
am7NX2UTRzNedOqzBaXE4yZTYpnapNGmop8tJWbDs2i3fv6AAZ9oWBua3jumhKCS
AdsXcADhpGyGcfYtyvAydK5XB93JZ1RoAqw4zbF8CT24V5zLWiOyOy7RO5LEq40k
wsIHfIYI5u7sKx/b26D/u95e8ensQZQy9pdwFbbzgFsWlhHMSBMfUs4hqI7xU/sl
svvblr6m5HkXJ74FhEWmxOQvd12CZ2jhFwIgIuPlTGPmnJVCkSXfeVbW4Dsf8/Lg
wt5TtMJj9X9CluIdwvjCpbf0T9pbI9WIBAF/AkiUIw==
-----END CERTIFICATE-----`);
                });

                window.qz.security.setSignaturePromise(function (_resolve: (sig: string) => void, _reject: (err: any) => void) {
                    return function (toSign: string) {
                        fetch('https://api.piru.app/qz/sign', {
                            method: 'POST',
                            body: toSign,
                            headers: { 'Content-Type': 'text/plain' }
                        })
                            .then(response => response.text())
                            .then(signature => _resolve(signature))
                            .catch(err => _reject(err));
                    };
                });

                await window.qz.websocket.connect();
                setIsConnected(true);
                console.log('Connected to QZ Tray');
            } else {
                setIsConnected(true);
            }
        } catch (err) {
            console.error('Error connecting to QZ Tray:', err);
            setIsConnected(false);
            // No mostramos toast de error al iniciar para no molestar si no lo usan, 
            // pero si fallara en una acción explícita sí se mostraría.
        }
    };

    const disconnect = async () => {
        if (window.qz && window.qz.websocket.isActive()) {
            try {
                await window.qz.websocket.disconnect();
                setIsConnected(false);
                console.log('Disconnected from QZ Tray');
            } catch (err) {
                console.error('Error disconnecting QZ Tray:', err);
            }
        }
    };

    useEffect(() => {
        connect();

        return () => {
            // Opcional: desconectar al desmontar, pero en una SPA usualmente queremos mantener la conexión
            // disconnect();
        };
    }, []);

    const findPrinters = async (): Promise<string[]> => {
        if (!isConnected) {
            await connect();
        }

        try {
            if (!window.qz || !window.qz.websocket.isActive()) {
                throw new Error('No hay conexión con QZ Tray');
            }
            const printers = await window.qz.printers.find();
            return printers;
        } catch (err) {
            console.error('Error finding printers:', err);
            toast.error('Error al buscar impresoras. Verifique que QZ Tray esté ejecutándose.');
            return [];
        }
    };

    const print = async (printerName: string | null, data: any[]) => {
        const targetPrinter = printerName || defaultPrinter;

        if (!targetPrinter) {
            toast.error('No hay impresora seleccionada');
            throw new Error('No printer selected');
        }

        if (!isConnected) {
            await connect();
        }

        try {
            if (!window.qz || !window.qz.websocket.isActive()) {
                throw new Error('No hay conexión con QZ Tray');
            }

            const config = window.qz.configs.create(targetPrinter);
            await window.qz.print(config, data);
            toast.success('Impresión enviada correctamente');
        } catch (err) {
            console.error('Error printing:', err);
            toast.error('Error al imprimir. Verifique la impresora y QZ Tray.');
            throw err;
        }
    };

    return (
        <QZContext.Provider value={{
            isConnected,
            findPrinters,
            print,
            connect,
            disconnect,
            defaultPrinter,
            setDefaultPrinter
        }}>
            {children}
        </QZContext.Provider>
    );
};

export const useQZ = () => {
    const context = useContext(QZContext);
    if (context === undefined) {
        throw new Error('useQZ must be used within a QZProvider');
    }
    return context;
};
