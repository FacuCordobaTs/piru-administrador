import { useEffect, useMemo, useState, type ComponentType, type PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDatosEjemplo } from '@/store/datosEjemploStore'
import { ListaPedidos } from '@/components/guia/escenas/ListaPedidos'
import { ProductoOpciones } from '@/components/guia/escenas/ProductoOpciones'
import { CajaTurno } from '@/components/guia/escenas/CajaTurno'
import { PedidoWhatsapp } from '@/components/guia/escenas/PedidoWhatsapp'
import { ComandaTicket } from '@/components/guia/escenas/ComandaTicket'
import { PosAnotar } from '@/components/guia/escenas/PosAnotar'
import { MesasMozo } from '@/components/guia/escenas/MesasMozo'
import { MenuLateral } from '@/components/recorrido/escenas/MenuLateral'
import { DatosEjemplo } from '@/components/recorrido/escenas/DatosEjemplo'
import '@/components/recorrido/recorrido.css'

type Paso = {
  id: string
  etiqueta: string
  titulo: string
  texto: string
  donde?: string
  Escena: ComponentType<{ siempreActiva?: boolean }>
}

/**
 * Último tramo del claim: el dueño ya reclamó y configuró lo que faltaba; acá aprende a manejar el
 * panel con las mismas escenas de la guía, armado según lo que activó (impresión, POS, mesas).
 * Repite lo que explican el recorrido del panel (components/recorrido/pasos.ts) y la guía: si cambia
 * el nombre de una pantalla, cambian los tres.
 */
export function AprenderPanel({
  local,
  impresion,
  pos,
  mesas,
  trialDias,
  precio,
  pagando,
  onPagar,
  onTerminar,
}: {
  local: string
  impresion: boolean
  pos: boolean
  mesas: boolean
  trialDias: number | null
  precio: string | null
  pagando: boolean
  onPagar: () => void
  onTerminar: () => void
}) {
  const hayEjemplo = useDatosEjemplo((s) => s.estado?.hay ?? false)
  const cargarEjemplo = useDatosEjemplo((s) => s.cargar)
  useEffect(() => { void cargarEjemplo() }, [cargarEjemplo])

  const pasos = useMemo<Paso[]>(() => {
    const lista: Paso[] = [
      {
        id: 'inicio',
        etiqueta: 'Inicio',
        titulo: 'Inicio: donde entran los pedidos',
        texto: 'Es la pantalla del servicio. Cada pedido nuevo aparece a la izquierda y te llega al WhatsApp. Lo tocás, lo leés como una comanda y, cuando sale, lo despachás.',
        donde: 'Inicio',
        Escena: ListaPedidos,
      },
      {
        id: 'menu',
        etiqueta: 'Moverte',
        titulo: 'Todo está en el menú de la izquierda',
        texto: 'Inicio, Menú, Clientes, Estadísticas y Configuración. En el celular, el menú se abre con el botón de arriba. La Guía explica cada pantalla con ejemplos.',
        donde: 'Menú lateral',
        Escena: MenuLateral,
      },
      {
        id: 'carta',
        etiqueta: 'Tu carta',
        titulo: 'Cambiá precios y productos vos mismo',
        texto: 'Fotos, precios, variantes y extras. Si algo se terminó, lo pausás. Lo que cambiás se ve al instante en tu tienda.',
        donde: 'Menú',
        Escena: ProductoOpciones,
      },
    ]
    if (impresion) {
      lista.push({
        id: 'impresion',
        etiqueta: 'Comandas',
        titulo: 'Las comandas salen solas',
        texto: 'Con la app de escritorio abierta en la compu de la impresora, cada pedido aceptado se imprime una sola vez. Si hace falta otra copia, «Reimprimir» en el detalle del pedido.',
        donde: 'App de escritorio → Ajustes → Impresión',
        Escena: ComandaTicket,
      })
    }
    if (pos) {
      lista.push({
        id: 'pos',
        etiqueta: 'Mostrador',
        titulo: 'Anotá los pedidos del mostrador y el teléfono',
        texto: 'En el Punto de Venta buscás el producto, lo tocás y elegís cómo pagó. Queda junto con los pedidos de la tienda, y sigue andando sin internet.',
        donde: 'Punto de venta',
        Escena: PosAnotar,
      })
    }
    if (mesas) {
      lista.push({
        id: 'mesas',
        etiqueta: 'Mesas',
        titulo: 'El salón de un vistazo',
        texto: 'Abrís la cuenta de cada mesa, los mozos piden desde su celular y a la cocina llega sólo lo nuevo. El plano lo acomodás a tu salón real.',
        donde: 'Mesas',
        Escena: MesasMozo,
      })
    }
    lista.push({
      id: 'caja',
      etiqueta: 'Caja',
      titulo: 'Cuánto vendiste, sin planillas',
      texto: 'La caja del día separa cómo te pagaron y de dónde vino cada pedido. Estadísticas suma lo cobrado del mes y te muestra lo más pedido.',
      donde: 'Inicio → Caja, y Estadísticas',
      Escena: CajaTurno,
    })
    if (hayEjemplo) {
      lista.push({
        id: 'ejemplo',
        etiqueta: 'Ejemplos',
        titulo: 'Borrá los datos de ejemplo cuando quieras',
        texto: 'Para que no veas todo vacío hay clientes y pedidos marcados con EJEMPLO. Se borran con «Borrar datos de ejemplo», arriba del panel: tu carta y tu configuración no se tocan.',
        Escena: DatosEjemplo,
      })
    }
    lista.push({
      id: 'listo',
      etiqueta: 'Listo',
      titulo: `${local} ya puede recibir pedidos`,
      texto: 'Empezá por Inicio: ahí entran los pedidos. Si te queda una duda, la Guía explica cada pantalla y por WhatsApp tenés a una persona del equipo.',
      Escena: PedidoWhatsapp,
    })
    return lista
  }, [impresion, pos, mesas, hayEjemplo, local])

  const [i, setI] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [toque, setToque] = useState<number | null>(null)
  const paso = pasos[Math.min(i, pasos.length - 1)]
  const ultimo = i >= pasos.length - 1
  const ir = (j: number) => {
    if (j < 0 || j >= pasos.length || j === i) return
    setDir(j > i ? 1 : -1)
    setI(j)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const empezarToque = (e: PointerEvent) => { if (e.pointerType !== 'mouse') setToque(e.clientX) }
  const terminarToque = (e: PointerEvent) => {
    if (toque === null) return
    const dx = e.clientX - toque
    setToque(null)
    if (dx < -50) ir(i + 1)
    else if (dx > 50) ir(i - 1)
  }

  return (
    <div className="rp-caja animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-center text-xs font-semibold text-[#FF7A00]">Aprendé tu panel · {i + 1} de {pasos.length}</p>
      <div
        className="escenario relative mt-4 overflow-hidden rounded-[24px] px-3 py-5 ring-1 ring-black/[0.04]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={empezarToque}
        onPointerUp={terminarToque}
        onPointerCancel={() => setToque(null)}
      >
        <div key={paso.id} className="rp-escena">
          <paso.Escena siempreActiva />
        </div>
        <span className="absolute bottom-1.5 right-3 text-[10px] font-medium text-[#80776e]">Datos de ejemplo</span>
      </div>

      <div key={paso.id} data-dir={dir} className="rp-texto mt-6 text-foreground" aria-live="polite">
        <span className="inline-flex rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-[#E66E00]">{paso.etiqueta}</span>
        <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.12] tracking-tight">{paso.titulo}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{paso.texto}</p>
        {paso.donde && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-[#FF7A00]" />
            <span>Lo encontrás en <strong className="font-semibold text-foreground">{paso.donde}</strong></span>
          </p>
        )}
        {ultimo && (
          <div className="mt-5 rounded-2xl bg-white p-4 text-sm dark:bg-zinc-900">
            <p className="font-semibold">
              {trialDias != null ? `Tenés ${trialDias} ${trialDias === 1 ? 'día' : 'días'} de prueba incluidos` : 'Empezás con tus días de prueba'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Después sigue la cuota fija{precio ? ` de ${precio}/mes` : ''}. La activás cuando quieras desde Suscripción.
            </p>
            {precio && (
              <button
                type="button"
                onClick={onPagar}
                disabled={pagando}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FF7A00] hover:text-[#E66E00] disabled:opacity-50"
              >
                {pagando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Activar ahora
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        {pasos.map((p, j) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Paso ${j + 1}: ${p.etiqueta}`}
            aria-current={j === i ? 'step' : undefined}
            onClick={() => ir(j)}
            className="relative h-6 flex-1"
          >
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <span
                key={j === i ? `actual-${i}` : 'fijo'}
                className={cn('block h-full rounded-full bg-[#FF7A00]', j < i ? 'w-full' : j === i ? 'rp-progreso w-full' : 'w-0')}
              />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        {i > 0 && (
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => ir(i - 1)}
            className="h-14 w-14 shrink-0 rounded-2xl bg-zinc-100 text-muted-foreground hover:text-foreground dark:bg-zinc-900 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => (ultimo ? onTerminar() : ir(i + 1))}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF7A00] text-[15px] font-semibold text-white transition-all hover:bg-[#E66E00] active:scale-[0.985]"
        >
          {ultimo ? 'Entrar a mi panel' : 'Siguiente'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {!ultimo ? (
        <button type="button" onClick={onTerminar} className="mt-2.5 h-11 w-full rounded-2xl text-[14px] font-medium text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900">
          Ya lo conozco, entrar al panel
        </button>
      ) : (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> La Guía queda en el menú, arriba de Configuración.
        </p>
      )}
    </div>
  )
}
