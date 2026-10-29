import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../src/components/ui/button'
import { TiendaPersonalizacion } from '../src/components/TiendaPersonalizacion'
import { restauranteApi } from '../src/lib/api'
import { leerTiendaConfig, validarTiendaConfig } from '../src/lib/tiendaConfig'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore, type RestauranteData } from '../src/store/restauranteStore'
import { AjusteInput } from '../src/pages/ajustes/components/AjusteInput'
import { useAjuste } from '../src/pages/ajustes/hooks/useAjuste'
import type { Marca } from '../src/lib/tiendaPresets'
import { ColorField, LogoField } from '../src/pages/ajustes/sections/general/campos'
import { ModoColorField } from '../src/pages/ajustes/sections/General'

/**
 * Sólo para la suite: reproduce la sección Tienda que vivía en Ajustes, ahora en Páginas.
 * El editor real de Páginas se prueba en `sitios/`; acá se conserva la cobertura del editor
 * compartido (guardado, fotos, colores de marca y validación) contra la API del panel.
 */
export default function TiendaHarness() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  if (!restaurante) return null
  return <EditorTienda key={restaurante.id} restaurante={restaurante} />
}

function EditorTienda({ restaurante }: { restaurante: RestauranteData }) {
  const productos = useRestauranteStore((s) => s.productos)
  const [config, setConfig] = useState(() => leerTiendaConfig(restaurante.tienda))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const error = validarTiendaConfig(config)
  const primario = useAjuste('colorPrimario'), secundario = useAjuste('colorSecundario'), unico = useAjuste('usarColorUnico')
  const marca: Marca = {
    colorPrimario: restaurante.colorPrimario || '#FF7A00',
    colorSecundario: restaurante.colorSecundario || '#FFFFFF',
    usarColorUnico: !!restaurante.usarColorUnico,
  }
  const guardarMarca = (m: Partial<Marca>) => {
    if (m.colorPrimario) void primario.guardar(m.colorPrimario)
    if (m.colorSecundario) void secundario.guardar(m.colorSecundario)
    if (m.usarColorUnico !== undefined) void unico.guardar(m.usarColorUnico)
  }
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
      <summary className="cursor-pointer text-sm font-medium">Link, logos y colores exactos</summary>
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
    <p className="text-sm text-muted-foreground">Elegí entre las opciones y mirá cómo queda. Los colores de marca se guardan al elegirlos{primario.status === 'saving' || secundario.status === 'saving' || unico.status === 'saving' ? ' (guardando…)' : ''}; el resto, con «Guardar personalización».</p>
    <TiendaPersonalizacion productos={productos} value={config} disabled={guardando} nombre={restaurante.nombre} marca={marca} onMarca={guardarMarca} onChange={v => { setConfig(v); setGuardado(false) }} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 border-t pt-5">
      <Button disabled={guardando || !!error} onClick={() => void guardar()}>{guardando && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar personalización</Button>
      <span role="status" className="text-sm text-muted-foreground">{guardado ? 'Personalización guardada' : ''}</span>
      {restaurante.baseTienda && <a href={restaurante.baseTienda} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Ver tienda</a>}
    </div>
  </section>
}
