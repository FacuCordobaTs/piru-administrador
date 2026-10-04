import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { miMarketerApi, type MiMarketer } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function Marketer() {
  const token = useAuthStore(s => s.token)
  const [vinculo, setVinculo] = useState<MiMarketer | null>(null)
  const [cargando, setCargando] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    if (!token) return
    setCargando(true)
    try { setVinculo(await miMarketerApi.get(token)); setError('') }
    catch { setError('No se pudo cargar tu marketer. Volvé a intentar.') }
    finally { setCargando(false) }
  }, [token])
  useEffect(() => { void cargar() }, [cargar])
  const buscar = async () => {
    if (!token) return
    setOcupado(true)
    try { const p = await miMarketerApi.buscar(token, codigo.trim()); setNombre(p.nombre) }
    catch { toast.error('No encontramos ese código'); setNombre('') }
    finally { setOcupado(false) }
  }
  const darAcceso = async () => {
    if (!token || !nombre) return
    if (vinculo && !window.confirm(`¿Reemplazar a ${vinculo.marketer.nombre} por ${nombre}? El marketer anterior pierde el acceso.`)) return
    setOcupado(true)
    try { await miMarketerApi.darAcceso(token, codigo.trim(), !!vinculo); setCodigo(''); setNombre(''); await cargar(); toast.success('Acceso otorgado') }
    catch { toast.error('No se pudo dar acceso. Volvé a intentar.') }
    finally { setOcupado(false) }
  }
  const quitar = async () => {
    if (!token || !vinculo || !window.confirm(`¿Quitarle el acceso a ${vinculo.marketer.nombre}?`)) return
    setOcupado(true)
    try { await miMarketerApi.quitar(token); setVinculo(null); toast.success('Acceso revocado') }
    catch { toast.error('No se pudo quitar el acceso. Volvé a intentar.') }
    finally { setOcupado(false) }
  }
  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">Tu marketer</h2><p className="mt-2 text-sm text-muted-foreground">Dale acceso para que trabaje con tus clientes y campañas desde su propia app.</p></div>
    {cargando ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : error ? <div role="alert">{error} <Button variant="outline" onClick={() => void cargar()}>Reintentar</Button></div> : <>
      {vinculo && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><strong>{vinculo.marketer.nombre}</strong><p className="text-sm text-muted-foreground">Tiene acceso desde el {new Date(vinculo.desde).toLocaleDateString('es-AR')}</p></div><Button variant="outline" disabled={ocupado} onClick={() => void quitar()}>Quitar acceso</Button></div>}
      <div className="space-y-3"><label htmlFor="codigo-marketer" className="text-sm font-medium">{vinculo ? 'Código de otro marketer' : 'Código de tu marketer'}</label><div className="flex gap-2"><Input id="codigo-marketer" value={codigo} maxLength={32} onChange={e => { setCodigo(e.target.value.toUpperCase()); setNombre('') }} /><Button variant="outline" disabled={ocupado || !codigo.trim()} onClick={() => void buscar()}>Buscar</Button></div>{nombre && <div className="flex items-center justify-between gap-3"><strong>{nombre}</strong><Button disabled={ocupado} onClick={() => void darAcceso()}>{vinculo ? 'Reemplazar marketer' : 'Dar acceso'}</Button></div>}</div>
    </>}
    <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm"><p><strong>Puede:</strong> ver tus clientes, crear campañas, links y cupones, configurar los puntos, programar mensajes de recompra desde tu WhatsApp y ver tus estadísticas.</p><p><strong>No puede:</strong> tocar tus cobros, tu suscripción, tu menú y tus precios, tus pedidos ni tu configuración.</p><p>Los mensajes los manda el local desde el celular o la compu donde tiene su WhatsApp. Tu marketer también puede mandarlos si tiene ese WhatsApp vinculado.</p><p>Piru le paga a tu marketer una parte de tu suscripción. Tu precio no cambia.</p></div>
  </div>
}
