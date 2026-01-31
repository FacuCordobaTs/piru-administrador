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
