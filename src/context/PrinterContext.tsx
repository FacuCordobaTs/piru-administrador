import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'tauri_printer_name';

/** Impresoras virtuales conocidas que NO son comanderas térmicas reales. */
export const VIRTUAL_PRINTER_NAMES = [
    'onenote',
    'microsoft print to pdf',
    'microsoft xps document writer',
    'fax',
    'send to onenote',
    'xps',
];

/** Devuelve true si el nombre de impresora parece ser virtual (no una comandera real). */
export const isVirtualPrinter = (name: string): boolean => {
    const lower = name.toLowerCase();
    return VIRTUAL_PRINTER_NAMES.some(vp => lower.includes(vp));
};

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

    // Ref para tener siempre la lista actual de impresoras en los callbacks
    const printersRef = useRef<string[]>([]);
    printersRef.current = printers;

    // Actualizar localStorage cuando cambie la impresora seleccionada
    const setSelectedPrinter = useCallback((name: string) => {
        setSelectedPrinterState(name);
        localStorage.setItem(STORAGE_KEY, name);
    }, []);

    // Obtener lista de impresoras desde el backend Rust (interno, devuelve la lista)
    const fetchPrinterList = useCallback(async (): Promise<string[]> => {
        try {
            const printerList = await invoke<string[]>('get_printers');
            setPrinters(printerList);
            return printerList;
        } catch (error) {
            console.error('Error al obtener impresoras:', error);
            return [] as string[];
        }
    }, []);

    const refreshPrinters = useCallback(async () => {
        await fetchPrinterList();
    }, [fetchPrinterList]);

    const printChainRef = useRef<Promise<void>>(Promise.resolve());

    /** Bytes ESC/POS (p. ej. `commandsToBytes(formatComanda(...))`). Ejecutados en serie mediante printChainRef. */
    const printRaw = useCallback((data: number[]) => {
        if (!selectedPrinter) {
            return Promise.reject(new Error('No hay impresora seleccionada'));
        }

        // Validar que la impresora seleccionada siga existiendo en la lista actual
        if (printersRef.current.length > 0 && !printersRef.current.includes(selectedPrinter)) {
            console.warn(
                `Impresora "${selectedPrinter}" ya no existe en el sistema. Descartando selección.`
            );
            setSelectedPrinterState(null);
            localStorage.removeItem(STORAGE_KEY);
            return Promise.reject(
                new Error(
                    `La impresora "${selectedPrinter}" ya no está disponible en el sistema. ` +
                    'Seleccioná una impresora válida en Configuración > Hardware.'
                )
            );
        }

        printChainRef.current = printChainRef.current
            .then(() => invoke<void>('send_print_job', {
                printerName: selectedPrinter,
                content: data
            }))
            .catch(error => {
                console.error('Error al imprimir:', error);
                throw error;
            });

        return printChainRef.current;
    }, [selectedPrinter]);

    // Cargar impresoras al montar el componente y validar la guardada
    useEffect(() => {
        (async () => {
            const printerList = await fetchPrinterList();
            if (!printerList || printerList.length === 0) return;

            // Validar que la impresora guardada exista en la lista real
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && printerList.length > 0 && !printerList.includes(saved)) {
                console.warn(
                    `Impresora guardada "${saved}" no existe en el sistema. Descartando.`
                );
                setSelectedPrinterState(null);
                localStorage.removeItem(STORAGE_KEY);
            }
        })();
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
