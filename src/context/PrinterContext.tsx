import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

const STORAGE_KEY = 'tauri_printer_name';

interface PrinterContextType {
    printers: string[];
    selectedPrinter: string | null;
    refreshPrinters: () => Promise<void>;
    printRaw: (data: number[]) => Promise<void>;
    setSelectedPrinter: (name: string) => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [printers, setPrinters] = useState<string[]>([]);

    // Recuperar impresora guardada de localStorage al iniciar
    const [selectedPrinter, setSelectedPrinterState] = useState<string | null>(() => {
        return localStorage.getItem(STORAGE_KEY);
    });

    // Actualizar localStorage cuando cambie la impresora seleccionada
    const setSelectedPrinter = useCallback((name: string) => {
        setSelectedPrinterState(name);
        localStorage.setItem(STORAGE_KEY, name);
    }, []);

    // Obtener lista de impresoras desde el backend Rust
    const refreshPrinters = useCallback(async () => {
        try {
            const printerList = await invoke<string[]>('get_printers');
            setPrinters(printerList);
        } catch (error) {
            console.error('Error al obtener impresoras:', error);
            toast.error('Error al obtener lista de impresoras');
        }
    }, []);

    // Enviar datos raw a la impresora seleccionada
    const printRaw = useCallback(async (data: number[]) => {
        if (!selectedPrinter) {
            toast.error('Seleccione una impresora');
            throw new Error('No hay impresora seleccionada');
        }

        try {
            await invoke('send_print_job', {
                printerName: selectedPrinter,
                content: data
            });
            toast.success('Enviado a impresora');
        } catch (error) {
            console.error('Error al imprimir:', error);
            toast.error(`Error al imprimir: ${error}`);
            throw error;
        }
    }, [selectedPrinter]);

    // Cargar impresoras al montar el componente
    useEffect(() => {
        refreshPrinters();
    }, [refreshPrinters]);

    return (
        <PrinterContext.Provider value={{
            printers,
            selectedPrinter,
            refreshPrinters,
            printRaw,
            setSelectedPrinter
        }}>
            {children}
        </PrinterContext.Provider>
    );
};

export const usePrinter = () => {
    const context = useContext(PrinterContext);
    if (context === undefined) {
        throw new Error('usePrinter must be used within a PrinterProvider');
    }
    return context;
};
