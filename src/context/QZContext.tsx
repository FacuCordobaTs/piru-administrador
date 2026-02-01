import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

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

    // Recuperar impresora guardada al iniciar
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

        if (window.qz.websocket.isActive()) {
            setIsConnected(true);
            return;
        }

        try {
            // --- CONFIGURACIÓN DE SEGURIDAD ---

            // 1. Certificado (Público)
            window.qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
                resolve(`-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUJ20M7YBS/0OkbIbwxH1tzNzsCigwDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNjAyMDEyMTE1MDRaFw0yNzAy
MDEyMTE1MDRaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDpRbFwvH+tCaQC01hdQIeupgoD70YN0ZIOMA8Yf9vi
MCFgZPrzuPiY5p85UM3h2Ufu/n01qs7f5L6mRyv6kuv/TYR7ZJFj64tvrfl4QsPY
epNUw4TfsxHyyUklWIQp9PzvOhVz01j/OceO4/qfu9ZHwJFpCzdkNVEd2m/QdtuJ
NQ3V1izboisrTAfQdQZgaa+zD+WNwikBlspK385Qoxh3EBGIVn4kcCJjTWa0XUTi
5TaNtDZu+uXZG+wHrSwSgR6mx41KWFvWWtWyRfMDoOiYL4hXbuZ/FOqamujhM2w/
8n8xe/30MHnTQcjEG5vgh6IpSfVAU7Lmp5Fk56WW5CJdAgMBAAGjUzBRMB0GA1Ud
DgQWBBSL76/F9tJJ4IRSK9QFEa4xaoaBCzAfBgNVHSMEGDAWgBSL76/F9tJJ4IRS
K9QFEa4xaoaBCzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAc
Kdgp73HXtydJPhFh/cLWnqIVtiLjsTz6mb9h0QjECfgLANxH+hKjqvfj5X6fEss6
UIBqlKH87xxc2lP3bG09x80Ow5NN5pKJVDHbofc2KbE9s1ILz2WexeH7AwxYGydD
mN2BsCHLcUtS6uVGGv1LdoWBcyeSs1C5Q81215rLx7SG7M99qsjRIRAVFxnIw8+x
H3UU1x9oq+JubB+fKNIqlKH9LzqZClvRxNk+QAM0XgI+SF0xWzWFjBAxqyz7tnZL
ozgsxjjJlkIgN7rRGwSPC/W9hbmdJNJdF+EL9ADxCacQ+hXvpE+8WboSxX5PJljU
4rxHQukQL8M9w4xK10BZ
-----END CERTIFICATE-----`);
            });

            // 2. Firma (Privada - via Backend)
            // SOLUCIÓN: Devolvemos una función (resolve, reject), no una promesa directa.
            // Esto evita el error "Promise resolver is not a function"
            window.qz.security.setSignaturePromise((toSign: string) => {
                return function (resolve: any, reject: any) {
                    fetch('https://api.piru.app/qz/sign', {
                        method: 'POST',
                        body: toSign, // QZ envía esto limpio, está bien
                        headers: { 'Content-Type': 'text/plain' }
                    })
                        .then(response => {
                            if (!response.ok) throw new Error(response.statusText);
                            return response.text();
                        })
                        .then(signature => {
                            // ✅ LA SOLUCIÓN: Limpiamos la firma recibida
                            console.log("Firma recibida:", signature);
                            resolve(signature.trim());
                        })
                        .catch(error => reject(error));
                };
            });

            // Configurar callback de desconexión
            window.qz.websocket.setClosedCallbacks(() => {
                setIsConnected(false);
            });

            // Conectar
            await window.qz.websocket.connect({
                retries: 3,
                delay: 1
            });

            setIsConnected(true);
            console.log('Connected to QZ Tray');

        } catch (err) {
            console.error('Error connecting to QZ Tray:', err);
            setIsConnected(false);
        }
    };

    const disconnect = async () => {
        if (window.qz && window.qz.websocket.isActive()) {
            try {
                await window.qz.websocket.disconnect();
                setIsConnected(false);
            } catch (err) {
                console.error('Error disconnecting:', err);
            }
        }
    };

    useEffect(() => {
        connect();
    }, []);

    const findPrinters = async (): Promise<string[]> => {
        if (!isConnected) {
            try {
                // Intentar conectar silenciosamente
                await connect();
            } catch (e) { return [] }
        }

        try {
            if (!window.qz || !window.qz.websocket.isActive()) {
                return [];
            }
            const printers = await window.qz.printers.find();
            return printers;
        } catch (err) {
            console.error('Error finding printers:', err);
            // Si el error es de firma, mostrarlo
            if (err instanceof Error && err.message.includes('Sign')) {
                toast.error('Error de firma digital. Verifica el backend.');
            }
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
            toast.success('Comanda enviada a cocina');
        } catch (err) {
            console.error('Error printing:', err);
            toast.error('Error al imprimir.');
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