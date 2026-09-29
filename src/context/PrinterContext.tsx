import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useModuloActivo } from '@/store/modulosStore';
import { useRestauranteStore } from '@/store/restauranteStore';
import { COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY, readComandaGrandeMayusculas, prepararCopiasComanda } from '@/utils/printerUtils';
import { getPosConfig } from '@/lib/posConfig';
import { describePrinterTarget, type PrinterTarget } from '@/utils/printerTypes';
import {
    agregarDestinoManual,
    parsePrinterTarget,
    quitarManual,
    readStoredManualTargets,
    readStoredPrinterTarget,
    writeStoredManualTargets,
    writeStoredPrinterTarget,
} from '@/utils/printerTargetStorage';

interface PrinterContextType {
    printers: PrinterTarget[];
    /** Impresoras cargadas a mano en este equipo (sobreviven a la búsqueda y al reinicio). */
    manualPrinters: PrinterTarget[];
    selectedPrinter: PrinterTarget | null;
    refreshPrinters: () => Promise<void>;
    printRaw: (data: number[]) => Promise<void>;
    /** Imprime una comanda respetando la cantidad de copias configurada en el equipo. */
    printComanda: (data: number[]) => Promise<void>;
    setSelectedPrinter: (target: PrinterTarget | null) => void;
    /** Suma una impresora a mano. Repetir la misma no la duplica. */
    addManualPrinter: (target: PrinterTarget) => void;
    /** La quita de la lista manual; si era la elegida, el equipo queda sin impresora. */
    removeManualPrinter: (target: PrinterTarget) => void;
    comandaGrandeMayusculas: boolean;
    setComandaGrandeMayusculas: (enabled: boolean) => void;
    /** Alias general del local, usado cuando el pedido no tiene uno propio de sucursal. */
    transferenciaAlias: string | null;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const impresionComandasActiva = useModuloActivo('impresion_comandas');
    const transferenciaAlias = useRestauranteStore((state) => state.restaurante?.transferenciaAlias ?? null);
    const [printers, setPrinters] = useState<PrinterTarget[]>([]);
    const [comandaGrandeMayusculas, setComandaGrandeMayusculasState] = useState(readComandaGrandeMayusculas);

    // Destino guardado en el equipo. `readStoredPrinterTarget` migra el nombre viejo
    // (`tauri_printer_name`) a la clave nueva, así que un equipo ya instalado no pierde su impresora.
    const [selectedPrinter, setSelectedPrinterState] = useState<PrinterTarget | null>(readStoredPrinterTarget);

    // Las cargadas a mano van en su propia clave: una impresora de red se tipea a mano y la
    // búsqueda no la repone, así que no pueden perderse al elegir otra (cocina y barra a la vez).
    const [manualPrinters, setManualPrinters] = useState<PrinterTarget[]>(readStoredManualTargets);

    // Única fuente de la lista: se guarda entera cada vez que cambia, así el almacenamiento no
    // puede quedar desincronizado del estado que ve la UI.
    useEffect(() => {
        writeStoredManualTargets(manualPrinters);
    }, [manualPrinters]);

    const setSelectedPrinter = useCallback((target: PrinterTarget | null) => {
        setSelectedPrinterState(target);
        writeStoredPrinterTarget(target);
    }, []);

    const addManualPrinter = useCallback((target: PrinterTarget) => {
        setManualPrinters((previas) => agregarDestinoManual(previas, target));
    }, []);

    const removeManualPrinter = useCallback((target: PrinterTarget) => {
        // Lista y elección son una sola operación: si se borra la que estaba en uso, el equipo
        // queda sin impresora (y la UI lo muestra) en vez de apuntar a un destino que ya no está.
        const siguiente = quitarManual({ manuales: manualPrinters, seleccionado: selectedPrinter }, target);
        setManualPrinters(siguiente.manuales);
        setSelectedPrinter(siguiente.seleccionado);
    }, [manualPrinters, selectedPrinter, setSelectedPrinter]);

    const setComandaGrandeMayusculas = useCallback((enabled: boolean) => {
        setComandaGrandeMayusculasState(enabled);
        localStorage.setItem(COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY, String(enabled));
    }, []);

    // Obtener lista de destinos desde el backend Rust.
    const refreshPrinters = useCallback(async () => {
        try {
            const printerList = await invoke<PrinterTarget[]>('get_printers');
            // Un destino a medio armar rompería el selector antes de que Rust lo rechace.
            setPrinters(printerList.flatMap((target) => {
                const valido = parsePrinterTarget(target);
                return valido === null ? [] : [valido];
            }));
        } catch (error) {
            console.error('Error al obtener impresoras:', error);
        }
    }, []);

    /**
     * Envía bytes ESC/POS ya formateados al destino elegido. Los estilos por tipo de producto
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
            // El transporte viaja como dato: Rust ya no lo deduce de la forma del nombre.
            await invoke('send_print_job', {
                target: selectedPrinter,
                content: data
            });
        } catch (error) {
            console.error('Error al imprimir:', error);
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`La impresora "${describePrinterTarget(selectedPrinter)}" rechazó el trabajo: ${detail}`);
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
            manualPrinters,
            selectedPrinter,
            refreshPrinters,
            printRaw,
            printComanda,
            setSelectedPrinter,
            addManualPrinter,
            removeManualPrinter,
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
