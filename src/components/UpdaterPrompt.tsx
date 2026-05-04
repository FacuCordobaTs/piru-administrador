import { useState, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
// Acá importarías tus componentes de Shadcn: Dialog, Button, etc.

export default function UpdaterPrompt() {
    const [update, setUpdate] = useState<Update | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const foundUpdate = await check();
                if (foundUpdate) {
                    // Si hay actualización, guardamos los datos para mostrar el modal
                    setUpdate(foundUpdate);
                }
            } catch (error) {
                console.error("Error buscando actualizaciones:", error);
            }
        };

        // Solo buscamos actualizaciones si estamos en el entorno de Tauri (escritorio)
        if ((window as any).__TAURI_INTERNALS__) {
            checkForUpdates();
        }
    }, []);

    const handleUpdate = async () => {
        if (!update) return;
        setIsUpdating(true);

        const toastId = toast.loading('Descargando actualización... Por favor, no cierres la aplicación.');

        try {
            // Descarga e instala el .msi en segundo plano
            await update.downloadAndInstall();

            toast.success('Actualización instalada. Reiniciando...', { id: toastId });

            // Reinicia la app para aplicar los cambios
            await relaunch();
        } catch (error) {
            console.error(error);
            toast.error('Hubo un error al instalar la actualización.', { id: toastId });
            setIsUpdating(false);
        }
    };

    if (!update) return null;

    // Reemplazá esto con tu AlertDialog o Dialog de Shadcn
    return (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-card border border-border shadow-lg rounded-lg max-w-sm">
            <h3 className="font-semibold text-foreground mb-2">¡Nueva versión disponible!</h3>
            <p className="text-sm text-muted-foreground mb-4">
                La versión {update.version} está lista para instalarse.
                {update.body && <span className="block mt-1 italic">{update.body}</span>}
            </p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={() => setUpdate(null)}
                    disabled={isUpdating}
                    className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md"
                >
                    Más tarde
                </button>
                <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md"
                >
                    {isUpdating ? 'Actualizando...' : 'Actualizar ahora'}
                </button>
            </div>
        </div>
    );
}