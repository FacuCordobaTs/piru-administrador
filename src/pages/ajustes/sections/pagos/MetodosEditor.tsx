import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { useMetodosPago } from '../../hooks/useMetodosPago'
import type { PagosEditorId } from './types'

export function MetodosEditor({
  metodos,
  mpOk,
  cucuruOk,
  taloOk,
  irA,
}: {
  metodos: ReturnType<typeof useMetodosPago>
  mpOk: boolean
  cucuruOk: boolean
  taloOk: boolean
  irA: (id: PagosEditorId) => void
}) {
  const { config, setMetodo, alias, setAlias, proveedor, setProveedor } = metodos
  const [aliasDraft, setAliasDraft] = useState(alias)
  useEffect(() => setAliasDraft(alias), [alias])

  return (
    <div className="space-y-2">
      {/* Mercado Pago: requiere integración conectada */}
      {mpOk ? (
        <>
          <MetodoFila
            titulo="Mercado Pago"
            descripcion="El cliente paga con dinero en cuenta desde la app."
            checked={config.checkout}
            onToggle={(v) => setMetodo('checkout', v)}
          />
          <MetodoFila
            titulo="Tarjetas (Mercado Pago)"
            descripcion="Formulario embebido: paga con tarjeta sin salir del menú."
            checked={config.bricks}
            onToggle={(v) => setMetodo('bricks', v)}
          />
        </>
      ) : (
        <RequiereConectar texto="Requiere conectar Mercado Pago" onClick={() => irA('mercadopago')} />
      )}

      {/* Transferencia automática: requiere Cucuru o Talo */}
      {cucuruOk || taloOk ? (
        <div>
          <MetodoFila
            titulo="Transferencia automática"
            descripcion="Se acredita sola vía tu billetera conectada."
            checked={config.tfAuto}
            onToggle={(v) => setMetodo('tfAuto', v)}
          />
          {config.tfAuto && cucuruOk && taloOk && (
            <div className="flex items-center gap-3 py-2 pl-1">
              <Label className="text-[13px] font-normal text-muted-foreground">Proveedor</Label>
              <select
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value as 'cucuru' | 'talo')}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="cucuru">Cucuru</option>
                <option value="talo">Talo</option>
              </select>
            </div>
          )}
        </div>
      ) : (
        <RequiereConectar texto="Requiere conectar Cucuru o Talo" onClick={() => irA('cucuru')} />
      )}

      {/* Transferencia manual + alias solo si está activa */}
      <div>
        <MetodoFila
          titulo="Transferencia manual"
          descripcion="Mostrás tu alias/CBU y verificás el pago a mano."
          checked={config.tfManual}
          onToggle={(v) => setMetodo('tfManual', v)}
        />
        {config.tfManual && (
          <div className="pb-2 pl-1">
            <Input
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              onBlur={() => setAlias(aliasDraft)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="Tu alias o CBU"
              className="h-11 font-mono"
            />
          </div>
        )}
      </div>

      <MetodoFila
        titulo="Efectivo"
        descripcion="El cliente elige pagar en efectivo; cobrás en caja."
        checked={config.efectivo}
        onToggle={(v) => setMetodo('efectivo', v)}
      />
    </div>
  )
}

function MetodoFila({
  titulo,
  descripcion,
  checked,
  onToggle,
}: {
  titulo: string
  descripcion: string
  checked: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-[13px] font-normal text-muted-foreground">{descripcion}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}

/** Fila muerta reemplazada: link que salta a la integración a conectar. */
function RequiereConectar({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-2 py-3 text-left">
      <span className="text-sm font-normal text-muted-foreground">{texto}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
    </button>
  )
}
