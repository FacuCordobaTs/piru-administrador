import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TiendaPersonalizacion } from '@/components/TiendaPersonalizacion'
import { restauranteApi } from '@/lib/api'
import { leerTiendaConfig, validarTiendaConfig } from '@/lib/tiendaConfig'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type RestauranteData } from '@/store/restauranteStore'
import { AjusteInput } from '../components/AjusteInput'
import { ColorField, LogoField } from './general/campos'
import { ModoColorField } from './General'

export default function Tienda() {
  const restaurante = useRestauranteStore(s => s.restaurante)
  if (!restaurante) return null
  return <EditorTienda key={restaurante.id} restaurante={restaurante} />
}

function EditorTienda({ restaurante }: { restaurante: RestauranteData }) {
  const [config, setConfig] = useState(() => leerTiendaConfig(restaurante.tienda))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const error = validarTiendaConfig(config)
  const guardar = async () => {
    const token = useAuthStore.getState().token
    if (!token || error) return
    setGuardando(true)
    try {
      const respuesta = await restauranteApi.update(token, { tienda: config }) as { data: RestauranteData }
      const tienda = respuesta.data.tienda ?? null
      useRestauranteStore.getState().setLocal({ tienda })
      setConfig(leerTiendaConfig(tienda))
      setGuardado(true)
    } catch (e) {
      toast.error('No se pudo guardar la personalización', { description: e instanceof Error ? e.message : 'Reintentá en un momento.' })
    } finally { setGuardando(false) }
  }
  return <section className="space-y-7">
    <header className="space-y-1">
      <h2 className="text-lg font-medium">Tienda</h2>
      <p className="text-sm text-muted-foreground">Tu link, tu marca y el diseño que ven tus clientes al comprar o pedir en grupo.</p>
    </header>
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">Link, colores de marca y logos</summary>
      <div className="mt-5 space-y-5">
        <p className="text-xs text-muted-foreground">Estos datos se guardan al salir de cada campo; los logos, al subirlos.</p>
        <AjusteInput campo="username" label="Alias de tu link" prefix="piru.app/" mono transform={v => v.toLowerCase().replace(/[^a-z0-9-]/g, '')} validate={v => v.length < 3 ? 'Usá al menos 3 caracteres' : null} />
        <ModoColorField />
        <ColorField campo="colorPrimario" label="Color primario (botones y detalles)" fallback="#FF7A00" />
        {!restaurante.usarColorUnico && <ColorField campo="colorSecundario" label="Color secundario (acentos)" fallback="#FFFFFF" />}
        <div className="grid gap-5 sm:grid-cols-2">
          <LogoField which="image" campoLocal="imagenUrl" label="Logo sobre fondo oscuro" current={restaurante.imagenUrl} dark />
          <LogoField which="imageLight" campoLocal="imagenLightUrl" label="Logo sobre fondo claro" current={restaurante.imagenLightUrl} />
        </div>
      </div>
    </details>
    <p className="text-sm text-muted-foreground">Al terminar de editar el diseño y el contenido, guardá la personalización para publicarla en tu tienda.</p>
    <TiendaPersonalizacion value={config} disabled={guardando} onChange={v => { setConfig(v); setGuardado(false) }} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 border-t pt-5">
      <Button disabled={guardando || !!error} onClick={() => void guardar()}>{guardando && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar personalización</Button>
      <span role="status" className="text-sm text-muted-foreground">{guardado ? 'Personalización guardada' : ''}</span>
      {restaurante.baseTienda && <a href={restaurante.baseTienda} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Ver tienda</a>}
    </div>
  </section>
}
