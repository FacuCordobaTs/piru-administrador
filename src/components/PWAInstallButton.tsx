import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, PlusSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, installPWA, isIOS, isStandalone } = usePWAInstall();
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  // If the app is already running independently, hide the button
  if (isStandalone) {
    return null; 
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      installPWA();
    } else {
      setShowManualPrompt(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        className="gap-2 border-orange-200 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-500"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </Button>

      <Dialog open={showManualPrompt} onOpenChange={setShowManualPrompt}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {isIOS ? 'Instalar App en iOS' : 'Instalar App'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {isIOS 
                ? 'Instalá Piru Admin en tu dispositivo para abrir los pedidos directamente sin Safari.' 
                : 'Piru Admin se puede instalar en tu dispositivo para usarla como aplicación nativa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-6">
            {isIOS ? (
              <>
                <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="h-10 w-10 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-600 shrink-0">
                    <Share className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    1. Tocá Compartir en la barra de navegación de Safari.
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="h-10 w-10 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-600 shrink-0">
                    <PlusSquare className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
                  </div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    2. Seleccioná "Agregar a inicio".
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <p className="mb-2">Para instalar manualmente:</p>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Abre el menú principal de tu navegador (los 3 puntos arriba a la derecha en Chrome).</li>
                  <li>Toca <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</li>
                </ol>
              </div>
            )}
          </div>
          <Button className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setShowManualPrompt(false)}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
