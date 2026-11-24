import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { useMetodosPago } from '../../hooks/useMetodosPago'

/**
 * Los medios de pago que el local puede prender o apagar en su tienda. Sólo lista lo que ya se
 * puede ofrecer: un medio online aparece recién cuando su proveedor está conectado. Activar o
 * conectar un proveedor vive en una sola parte, "Conexiones" (Monetizacion.tsx).
 */
export function MetodosHabilitados({
  metodos,
  mpOk,
  cucuruOk,
  taloOk,
}: {
  metodos: ReturnType<typeof useMetodosPago>
  mpOk: boolean
  cucuruOk: boolean
  taloOk: boolean
}) {
  const { config, setMetodo, alias, setAlias, proveedor, setProveedor } = metodos
  // `null` mientras no se edita: el campo muestra el alias guardado.
  const [aliasDraft, setAliasDraft] = useState<string | null>(null)

  return (
    <div className="divide-y divide-border/50">
      {mpOk && (
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
      )}

      {(cucuruOk || taloOk) && (
        <MetodoFila
          titulo="Transferencia automática"
          descripcion="Se acredita sola vía tu billetera conectada."
          checked={config.tfAuto}
          onToggle={(v) => setMetodo('tfAuto', v)}
        >
          {config.tfAuto && cucuruOk && taloOk && (
            <div className="flex items-center gap-3 pb-3">
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
        </MetodoFila>
      )}

      <MetodoFila
        titulo="Transferencia"
        descripcion="Mostrás tu alias o CBU y verificás el pago a mano."
        checked={config.tfManual}
        onToggle={(v) => setMetodo('tfManual', v)}
      >
        {config.tfManual && (
          <div className="pb-3">
            <Input
              value={aliasDraft ?? alias}
              onChange={(e) => setAliasDraft(e.target.value)}
              onBlur={() => {
                if (aliasDraft !== null) setAlias(aliasDraft)
                setAliasDraft(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              placeholder="Tu alias o CBU"
              aria-label="Alias o CBU"
              className="h-11 font-mono"
            />
          </div>
        )}
      </MetodoFila>

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
  children,
}: {
  titulo: string
  descripcion: string
  checked: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          <p className="text-[13px] font-normal text-muted-foreground">{descripcion}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onToggle} aria-label={titulo} />
      </div>
      {children}
    </div>
  )
}
