import { Input } from '@/components/ui/input'
import type { PackRecarga } from '@/lib/api'

const fmtARS = (value: number | string) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(Number(value))

export function CheckoutSuscripcionOpciones({
  habilitarPack, packs, packId, onPackId, totalSuscripcion,
  telefonoCuenta, usarOtroTelefono, onUsarOtroTelefono, otroTelefono, onOtroTelefono,
}: {
  habilitarPack: boolean
  packs: PackRecarga[]
  packId: number | null
  onPackId: (id: number | null) => void
  totalSuscripcion: number
  telefonoCuenta: string | null | undefined
  usarOtroTelefono: boolean
  onUsarOtroTelefono: (value: boolean) => void
  otroTelefono: string
  onOtroTelefono: (value: string) => void
}) {
  const pack = packs.find((item) => item.id === packId)
  const total = totalSuscripcion + Number(pack?.precio ?? 0)
  return <div className="mt-7 space-y-7 border-t border-border pt-6 text-left">
    {habilitarPack && <section>
      <p className="text-sm font-medium">¿Querés sumar avisos a este mismo pago?</p>
      <p className="mt-1 text-xs text-muted-foreground">El pack se acredita junto con tu suscripción cuando Mercado Pago confirma el único cobro.</p>
      <div className="mt-3 grid gap-2">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
          <span><input className="mr-2" type="radio" name="pack-suscripcion" checked={packId == null} onChange={() => onPackId(null)} />Sin pack</span>
          <span className="text-muted-foreground">{fmtARS(0)}</span>
        </label>
        {packs.map((item) => <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
          <span><input className="mr-2" type="radio" name="pack-suscripcion" checked={packId === item.id} onChange={() => onPackId(item.id)} />{item.cantidad.toLocaleString('es-AR')} avisos</span>
          <span className="font-medium">+ {fmtARS(item.precio)}</span>
        </label>)}
      </div>
      {pack && <p className="mt-3 text-sm font-medium">Total del único pago: {fmtARS(total)}</p>}
    </section>}

    <TelefonoPagoOpciones
      telefonoCuenta={telefonoCuenta}
      usarOtroTelefono={usarOtroTelefono}
      onUsarOtroTelefono={onUsarOtroTelefono}
      otroTelefono={otroTelefono}
      onOtroTelefono={onOtroTelefono}
    />
  </div>
}

export function TelefonoPagoOpciones({
  telefonoCuenta,
  usarOtroTelefono,
  onUsarOtroTelefono,
  otroTelefono,
  onOtroTelefono,
  radioName = 'telefono-pago',
}: {
  telefonoCuenta: string | null | undefined
  usarOtroTelefono: boolean
  onUsarOtroTelefono: (value: boolean) => void
  otroTelefono: string
  onOtroTelefono: (value: string) => void
  radioName?: string
}) {
  return <section>
    <p className="text-sm font-medium">¿Dónde querés recibir el link de pago?</p>
    <div className="mt-3 space-y-2 text-sm">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="radio" name={radioName} checked={!usarOtroTelefono} disabled={!telefonoCuenta} onChange={() => onUsarOtroTelefono(false)} />
        Mi número asociado {telefonoCuenta ? <strong className="font-medium">({telefonoCuenta})</strong> : '(sin número cargado)'}
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="radio" name={radioName} checked={usarOtroTelefono} onChange={() => onUsarOtroTelefono(true)} />
        Otro número
      </label>
    </div>
    {usarOtroTelefono && <Input className="mt-3" type="tel" inputMode="tel" value={otroTelefono} onChange={(event) => onOtroTelefono(event.target.value)} placeholder="Ej. 5491123456789" autoComplete="tel" />}
    <p className="mt-2 text-xs text-muted-foreground">El número alternativo se usa sólo para este link y no cambia los datos de tu cuenta.</p>
  </section>
}
