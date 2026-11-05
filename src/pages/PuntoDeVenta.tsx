import { useState } from 'react'
import { CalendarClock, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PaginaModulo } from '@/components/PaginaModulo'
import { PosConfigForm } from '@/components/PosConfigDialog'
import { SucursalesLista } from '@/pages/ajustes/components/SucursalesLista'
import { useSucursales } from '@/pages/ajustes/hooks/useSucursales'
import { useModuloActivo } from '@/store/modulosStore'

/**
 * Configuración del punto de venta: la del dispositivo y los eventos que
 * atienden con el mismo POS. La operación diaria sigue en Inicio.
 */
export default function PuntoDeVenta() {
  const [eventosOpen, setEventosOpen] = useState(false)
  const { sucursales, recargar } = useSucursales()
  const cierreTurnoActivo = useModuloActivo('cierre_turno_manual')
  const eventos = sucursales.filter((sucursal) => sucursal.soloPos)
  const eventoActivo = eventos.some((evento) => evento.activo)

  return (
    <PaginaModulo
      titulo="Punto de venta"
      descripcion="Elegí qué datos se cargan al anotar un pedido en este dispositivo y administrá los eventos que venden con el POS."
      modulo="pos"
      ancho="max-w-3xl"
    >
      <div className="space-y-10">
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">Configuración de este dispositivo</h2>
            <p className="text-sm text-muted-foreground">
              Las opciones se guardan en esta computadora o celular, no en la cuenta del local.
            </p>
          </header>
          <div className="rounded-2xl border border-border/70 bg-background p-5">
            <PosConfigForm enPagina onSaved={() => undefined} />
          </div>
        </section>

        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">Eventos con POS</h2>
            <p className="text-sm text-muted-foreground">
              Tomá e imprimí pedidos fuera del local sin mezclar la tienda. En la computadora del
              evento se elige su sede desde Cambiar sucursal.
            </p>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Store className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {eventos.length === 0
                    ? 'Todavía no hay eventos'
                    : eventoActivo
                      ? 'El POS atiende en el evento; la tienda sigue en el local'
                      : 'Eventos creados, ninguno activo'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {eventos.length === 0
                    ? 'Creá uno para vender fuera del local.'
                    : `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'} configurados.`}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setEventosOpen(true)}>
              {eventos.length ? 'Administrar' : 'Crear evento'}
            </Button>
          </div>
        </section>

        {cierreTurnoActivo && (
          <section className="space-y-3">
            <header className="space-y-1">
              <h2 className="text-lg font-medium text-foreground">Cierre de turno</h2>
              <p className="text-sm text-muted-foreground">
                Al cerrar la caja desde Inicio ves lo que entró por cada medio de pago.
              </p>
            </header>
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-5 text-sm text-muted-foreground">
              <CalendarClock className="size-5 shrink-0 text-brand" />
              El cierre se hace desde la lista de pedidos, en los tres puntos del día.
            </div>
          </section>
        )}
      </div>

      <Dialog open={eventosOpen} onOpenChange={setEventosOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eventos con POS</DialogTitle>
            <DialogDescription>
              Cada evento es una sede que sólo existe para el punto de venta. No cambia la tienda
              del local.
            </DialogDescription>
          </DialogHeader>
          <SucursalesLista sucursales={eventos} onChanged={recargar} soloPos />
        </DialogContent>
      </Dialog>
    </PaginaModulo>
  )
}
