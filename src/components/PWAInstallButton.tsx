import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, PlusSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, installPWA, isIOS, isStandalone } = usePWAInstall();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  if (isStandalone) {
    return null; // Already installed or running in standalone mode
  }

  if (isInstallable) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={installPWA}
        className="gap-2 border-orange-200 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-500"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIOSPrompt(true)}
          className="gap-2 border-orange-200 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-500"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
          <span className="sm:hidden">Instalar</span>
        </Button>

        <Dialog open={showIOSPrompt} onOpenChange={setShowIOSPrompt}>
          <DialogContent className="max-w-sm rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Instalar App en iOS
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Instalá Piru Admin en tu iPhone o iPad para abrir los pedidos directamente sin Safari.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-6">
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
            </div>
            <Button className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setShowIOSPrompt(false)}>
              Entendido
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
