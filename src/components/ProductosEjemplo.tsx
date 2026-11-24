import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError, productosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { usePlanTiendaStore } from '@/store/planTiendaStore'
import { ConfirmDialog } from '@/pages/ajustes/components/ConfirmDialog'

/**
 * Productos de ejemplo de la tienda nueva (`producto.esEjemplo`, sembrados por las preguntas
 * iniciales). Se ven en la carta y en la tienda como cualquier producto, pero el panel los marca
 * siempre igual —la etiqueta y el aviso de acá— y se quitan todos juntos sin tocar los del dueño.
 */

/** Etiqueta que acompaña a un producto de ejemplo en cualquier lista del panel. */
export function EtiquetaEjemplo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground',
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      Ejemplo
    </span>
  )
}

/** Cuántos productos de ejemplo siguen activos en la carta. */
function useCantidadEjemplos() {
  return useRestauranteStore((s) => s.productos.filter((p) => p.esEjemplo && p.activo).length)
}

/**
 * Aviso de que la carta tiene productos de ejemplo, con la opción de quitarlos. `enCarta` es la
 * variante de la pantalla Productos (sin el link a la carta, porque ya está ahí).
 */
export function AvisoProductosEjemplo({ enCarta = false, className }: { enCarta?: boolean; className?: string }) {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const fetchRestaurante = useRestauranteStore((s) => s.fetchData)
  const recargarPasos = usePlanTiendaStore((s) => s.cargar)
  const cantidad = useCantidadEjemplos()
  const [confirmando, setConfirmando] = useState(false)

  if (cantidad === 0) return null

  const quitar = async () => {
    if (!token) return
    try {
      const res = await productosApi.quitarEjemplos(token)
      await Promise.all([fetchRestaurante(), recargarPasos(true)])
      toast.success('Quitamos los productos de ejemplo', {
        description: res.desactivados > 0
          ? `${res.desactivados} ya estaban en un pedido: quedaron desactivados para conservar el historial.`
          : 'Tus productos quedaron como estaban.',
      })
    } catch (error) {
      toast.error('No pudimos quitar los ejemplos', {
        description: error instanceof ApiError ? error.message : 'Revisá tu conexión e intentá de nuevo.',
      })
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <FlaskConical className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-foreground">
          {cantidad === 1 ? 'Tenés 1 producto de ejemplo' : `Tenés ${cantidad} productos de ejemplo`}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Están marcados con <EtiquetaEjemplo className="mx-0.5 align-[1px]" /> y se ven en tu tienda. Mirá cómo están armados, creá los tuyos y quitalos cuando quieras.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {!enCarta && (
          <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/productos')}>
            Ver en la carta
          </Button>
        )}
        <Button size="sm" variant={enCarta ? 'outline' : 'ghost'} onClick={() => setConfirmando(true)}>
          Quitar ejemplos
        </Button>
      </div>
      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="¿Quitar los productos de ejemplo?"
        descripcion="Se borran de la carta y de tu tienda. Los productos que creaste vos quedan como están."
        confirmLabel="Quitar ejemplos"
        destructivo
        onConfirm={quitar}
      />
    </div>
  )
}
