import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useModuloActivo } from '@/store/modulosStore';
import { useRestauranteStore } from '@/store/restauranteStore';
import { COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY, readComandaGrandeMayusculas, prepararCopiasComanda } from '@/utils/printerUtils';
import { getPosConfig } from '@/lib/posConfig';

const STORAGE_KEY = 'tauri_printer_name';

interface PrinterContextType {
    printers: string[];
    selectedPrinter: string | null;
    refreshPrinters: () => Promise<void>;
    printRaw: (data: number[]) => Promise<void>;
    /** Imprime una comanda respetando la cantidad de copias configurada en el equipo. */
    printComanda: (data: number[]) => Promise<void>;
    setSelectedPrinter: (name: string) => void;
    comandaGrandeMayusculas: boolean;
    setComandaGrandeMayusculas: (enabled: boolean) => void;
    /** Alias general del local, usado cuando el pedido no tiene uno propio de sucursal. */
    transferenciaAlias: string | null;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const impresionComandasActiva = useModuloActivo('impresion_comandas');
    const transferenciaAlias = useRestauranteStore((state) => state.restaurante?.transferenciaAlias ?? null);
    const [printers, setPrinters] = useState<string[]>([]);
    const [comandaGrandeMayusculas, setComandaGrandeMayusculasState] = useState(readComandaGrandeMayusculas);

    // Recuperar impresora guardada de localStorage al iniciar
    const [selectedPrinter, setSelectedPrinterState] = useState<string | null>(() => {
        return localStorage.getItem(STORAGE_KEY);
    });

    // Actualizar localStorage cuando cambie la impresora seleccionada
    const setSelectedPrinter = useCallback((name: string) => {
        setSelectedPrinterState(name);
        localStorage.setItem(STORAGE_KEY, name);
    }, []);

    const setComandaGrandeMayusculas = useCallback((enabled: boolean) => {
        setComandaGrandeMayusculasState(enabled);
        localStorage.setItem(COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY, String(enabled));
    }, []);

    // Obtener lista de impresoras desde el backend Rust
    const refreshPrinters = useCallback(async () => {
        try {
            const printerList = await invoke<string[]>('get_printers');
            setPrinters(printerList);
        } catch (error) {
            console.error('Error al obtener impresoras:', error);
        }
    }, []);

    /**
     * Envía bytes ESC/POS ya formateados. Los estilos por tipo de producto
     * (incluido el destaque de bebidas) se resuelven antes en `printerUtils`.
     */
    const printRaw = useCallback(async (data: number[]) => {
        if (!impresionComandasActiva) {
            throw new Error('Activá el módulo Impresión de comandas para imprimir');
        }
        if (!selectedPrinter) {
            throw new Error('No hay impresora seleccionada');
        }
        if (data.length === 0) {
            throw new Error('La comanda está vacía');
        }
        const invalidByteIndex = data.findIndex((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255);
        if (invalidByteIndex !== -1) {
            throw new Error(`La comanda contiene un byte inválido en la posición ${invalidByteIndex}`);
        }

        try {
            await invoke('send_print_job', {
                printerName: selectedPrinter,
                content: data
            });
        } catch (error) {
            console.error('Error al imprimir:', error);
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`La impresora "${selectedPrinter}" rechazó el trabajo: ${detail}`);
        }
    }, [impresionComandasActiva, selectedPrinter]);

    const printComanda = useCallback(async (data: number[]) => {
        // Leer al imprimir evita una preferencia obsoleta en operaciones pendientes.
        // Mantener estable el callback evita volver a disparar efectos de autoimpresión
        // sólo por cambiar la cantidad de copias.
        const copias = getPosConfig().imprimirComandaDosVeces ? 2 : 1;
        await printRaw(prepararCopiasComanda(data, copias));
    }, [printRaw]);

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
            printComanda,
            setSelectedPrinter,
            comandaGrandeMayusculas,
            setComandaGrandeMayusculas,
            transferenciaAlias,
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
