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

            // 🔴 SOLUCIÓN CRÍTICA: Forzar el uso de SHA512 en el frontend
            // Esto alinea el algoritmo con el que usa tu backend (Bun/Node crypto)
            window.qz.security.setSignatureAlgorithm("SHA512");

            // 1. Certificado (Público)
            window.qz.security.setCertificatePromise((resolve: (cert: string) => void, reject: (err: any) => void) => {
                fetch('https://api.piru.app/qz/certificate')
                    .then(response => {
                        if (!response.ok) throw new Error(response.statusText);
                        return response.text();
                    })
                    .then(cert => {
                        // Resolvemos con el certificado exacto que tiene el servidor
                        resolve(cert);
                    })
                    .catch(error => {
                        console.error("Error obteniendo certificado:", error);
                        reject(error);
                    });
            });

            // Configurar callback de desconexión
            window.qz.websocket.setClosedCallbacks(() => {
                setIsConnected(false);
            });

            setIsConnected(true);
            console.log('Connected to QZ Tray (Modo Local)');

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