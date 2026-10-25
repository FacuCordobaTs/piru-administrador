import { useEffect, useId, useState } from 'react'
import { ArrowLeftRight, Beer, Coffee, Croissant, Fish, Flame, Hamburger, IceCreamCone, Pizza, Salad, Store, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TiendaConfig } from '@/lib/tiendaConfig'
import {
  AMBIENTES, BASES, GENERICO, HOJA_TIPOGRAFIAS, PLANTILLAS, RUBROS, TIPOGRAFIAS,
  ambienteDe, aplicarRubro, coloresAmbiente, esMarcaInicial, rubroDe, tipografiaDe,
  type Marca, type Rubro,
} from '@/lib/tiendaPresets'
import { FotosTienda } from './tienda/Fotos'
import { Decision, Muestra, Opcion } from './tienda/Opciones'
import { ElegirCinta, ElegirHistoria, ElegirTexto } from './tienda/Textos'
import { estiloTienda } from './tienda/estilo'
import { MiniPlantilla, VistaPrevia } from './tienda/VistaPrevia'

export type ProductoDestacable = {
  id: number; nombre: string; activo?: boolean | null; soloCanjePuntos?: boolean; eventoSucursalId?: number | null
}

const ICONOS = { Hamburger, Pizza, Coffee, Utensils, Salad, Flame, IceCreamCone, Fish, Beer, Croissant, Store }
const MARCA_INICIAL: Marca = { colorPrimario: '#FF7A00', colorSecundario: '#FFFFFF', usarColorUnico: true }
const elegibles = (productos: ProductoDestacable[]) => productos.filter(p => p.activo !== false && !p.soloCanjePuntos && !p.eventoSucursalId)

/** Carga una vez las letras del catálogo (y la propia, si hay) para mostrar cada opción con su fuente. */
function useHojasDeFuentes(propias: (string | undefined)[]) {
  const clave = propias.filter(Boolean).join('|')
  useEffect(() => {
    const hojas = [HOJA_TIPOGRAFIAS, ...clave.split('|').filter(Boolean).filter(f => !TIPOGRAFIAS.some(t => t.titulos === f || t.cuerpo === f))
      .map(f => `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}&display=swap`)]
    const nuevas = hojas.filter(h => !document.head.querySelector(`link[data-fuente-editor="${CSS.escape(h)}"]`)).map(h => {
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: h })
      link.dataset.fuenteEditor = h
      document.head.appendChild(link)
      return link
    })
    return () => nuevas.forEach(l => l.remove())
  }, [clave])
}

/** El editor de la tienda, igual en el alta y en Ajustes. Se arma por decisiones: cada una ofrece opciones
 * pensadas para el rubro y escribe los mismos campos del contrato, que siguen editables a mano.
 * Con `onMarca`, también propone y reparte los colores de marca del local. */
export function TiendaPersonalizacion({ value, onChange, productos = [], disabled = false, nombre, marca, onMarca, modo = 'ajustes' }: {
  value: TiendaConfig; onChange: (v: TiendaConfig) => void; productos?: ProductoDestacable[]; disabled?: boolean
  nombre?: string; marca?: Marca; onMarca?: (m: Partial<Marca>) => void; modo?: 'ajustes' | 'alta'
}) {
  const id = useId()
  const colores = marca ?? MARCA_INICIAL
  const [rubroId, setRubroId] = useState<string | undefined>(() => rubroDe(value)?.id)
  const rubro: Rubro | undefined = RUBROS.find(r => r.id === rubroId)
  const patch = (p: Partial<TiendaConfig>) => onChange({ ...value, ...p })
  useHojasDeFuentes([value.fuentes?.titulos, value.fuentes?.cuerpo])

  const ambiente = ambienteDe(value, colores.colorPrimario)
  const tipografia = !value.fuentes?.titulos && !value.fuentes?.cuerpo && !value.fuentes?.cssUrl ? 'diseno' : tipografiaDe(value)?.id
  const plato = elegibles(productos).find(p => p.id === value.productoDestacadoId)?.nombre
  const nombreLocal = nombre?.trim() || 'Tu local'

  /** Cambiar el color primario mueve también el fondo teñido, si es el elegido. */
  const cambiarMarca = (m: Partial<Marca>) => {
    onMarca?.(m)
    if (m.colorPrimario && ambiente === 'tinte') patch({ colores: coloresAmbiente(AMBIENTES.find(a => a.id === 'tinte')!, m.colorPrimario) })
  }
  const elegirRubro = (r: Rubro) => {
    setRubroId(r.id)
    // Un local recién creado todavía tiene el naranja de Piru: el rubro le propone su primera paleta.
    const paleta = onMarca && esMarcaInicial(colores) ? r.paletas[0] : undefined
    if (paleta) onMarca!({ colorPrimario: paleta.primario, colorSecundario: paleta.secundario, usarColorUnico: false })
    onChange(aplicarRubro(value, r, paleta?.primario ?? colores.colorPrimario, nombre))
  }

  const paletas = rubro?.paletas ?? RUBROS.map(r => r.paletas[0])
  const textos = rubro ?? { frases: GENERICO.frases, bajadas: GENERICO.bajadas, cinta: GENERICO.cinta, historias: GENERICO.historias }

  const detalles = <>
    <Decision titulo="Fotos del local" detalle="La portada y hasta 8 fotos para la galería. JPG, PNG o WebP, hasta 5 MB. Sin fotos, esas partes no aparecen.">
      <FotosTienda value={value} patch={patch} />
    </Decision>
    <Decision titulo="La historia de tu local" detalle="Aparece al pie de la carta. Elegí una propuesta y retocala con lo tuyo.">
      <ElegirHistoria opciones={rubro ? [...rubro.historias, ...GENERICO.historias] : GENERICO.historias} nombre={nombre} valor={value.historia} onCambiar={historia => patch({ historia })} />
    </Decision>
    <Decision titulo="Contacto" detalle="Se muestra al pie de la tienda. El número que recibe los pedidos se configura por separado.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor={`${id}-instagram`} className="text-sm font-medium">Instagram</label>
          <Input id={`${id}-instagram`} maxLength={60} placeholder="@tulocal" value={value.instagram ?? ''} onChange={e => patch({ instagram: e.target.value || undefined })} /></div>
        <div className="space-y-2"><label htmlFor={`${id}-whatsapp`} className="text-sm font-medium">WhatsApp de contacto de la tienda</label>
          <Input id={`${id}-whatsapp`} maxLength={30} placeholder="5491112345678" value={value.whatsapp ?? ''} onChange={e => patch({ whatsapp: e.target.value || undefined })} /></div>
      </div>
    </Decision>
    <Avanzado value={value} patch={patch} />
  </>

  return <div className="@container min-w-0">
    <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_300px] @3xl:gap-10">
      <fieldset disabled={disabled} className="min-w-0 space-y-7 disabled:opacity-60">
        <Decision titulo="¿Qué tipo de local es?" detalle="Elegí el más parecido y armamos todo: diseño, letra, colores y textos. Después cambiás lo que quieras; lo que escribas vos no se pisa.">
          <div role="radiogroup" aria-label="Tipo de local" className="grid grid-cols-2 gap-2 @md:grid-cols-3 @xl:grid-cols-4">
            {RUBROS.map(r => {
              const Icono = ICONOS[r.icono]
              return <Opcion key={r.id} nombre={`${id}-rubro`} etiqueta={r.nombre} elegida={rubroId === r.id} onElegir={() => elegirRubro(r)} className="!flex-row items-center gap-2.5 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: r.paletas[0].primario, color: '#fff' }}><Icono className="size-[18px]" /></span>
                <span className="min-w-0 pr-5 text-sm font-medium leading-tight">{r.nombre}</span>
              </Opcion>
            })}
            <Opcion nombre={`${id}-rubro`} etiqueta="Otro" elegida={rubroId === 'otro'} onElegir={() => setRubroId('otro')} className="!flex-row items-center gap-2.5 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><Store className="size-[18px]" /></span>
              <span className="text-sm font-medium">Otro</span>
            </Opcion>
          </div>
        </Decision>

        <details className="rounded-2xl border bg-muted/30 p-3 @3xl:hidden">
          <summary className="cursor-pointer text-sm font-medium">Ver cómo queda tu tienda</summary>
          <div className="pt-4"><VistaPrevia config={value} marca={colores} nombre={nombreLocal} plato={plato} /></div>
        </details>

        <Decision titulo="Diseño" detalle="La forma de toda la tienda. Al cambiarlo se conserva todo lo demás.">
          <div role="radiogroup" aria-label="Plantilla de la tienda" className="grid gap-2 @md:grid-cols-3">
            {PLANTILLAS.map(p => <Opcion key={p.id} nombre={`${id}-plantilla`} etiqueta={p.nombre} elegida={(value.plantilla ?? 'artesanal') === p.id} onElegir={() => patch({ plantilla: p.id })}>
              <MiniPlantilla id={p.id} config={value} marca={colores} />
              <span className="px-1 pt-2.5 text-sm font-semibold">{p.nombre}</span>
              <span className="px-1 pb-1 pt-0.5 text-xs leading-snug text-muted-foreground">{p.detalle}</span>
            </Opcion>)}
          </div>
        </Decision>

        {onMarca && <Decision titulo="Colores de tu marca" detalle={rubro ? `Combinaciones pensadas para ${rubro.nombre.toLowerCase()}. Se usan en botones, sellos y detalles.` : 'Se usan en botones, sellos y detalles.'}>
          <div role="radiogroup" aria-label="Colores de marca" className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            {paletas.map(p => {
              const elegida = colores.colorPrimario.toLowerCase() === p.primario.toLowerCase() && (colores.usarColorUnico || colores.colorSecundario.toLowerCase() === p.secundario.toLowerCase())
              return <Opcion key={p.nombre} nombre={`${id}-paleta`} etiqueta={p.nombre} elegida={elegida} onElegir={() => cambiarMarca({ colorPrimario: p.primario, colorSecundario: p.secundario, usarColorUnico: false })} className="p-2.5">
                <span aria-hidden className="flex h-12 overflow-hidden rounded-lg"><span className="flex-[2]" style={{ background: p.primario }} /><span className="flex-1" style={{ background: p.secundario }} /></span>
                <span className="pt-2 text-[13px] font-medium leading-tight">{p.nombre}</span>
              </Opcion>
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Cantidad de colores" className="inline-flex rounded-full border p-1">
              {[{ unico: false, texto: 'Dos colores' }, { unico: true, texto: 'Un solo color' }].map(o => <label key={o.texto} className={`flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${colores.usarColorUnico === o.unico ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>
                <input type="radio" name={`${id}-reparto`} checked={colores.usarColorUnico === o.unico} onChange={() => cambiarMarca({ usarColorUnico: o.unico })} className="sr-only" />
                <span className="flex -space-x-1"><Muestra color={colores.colorPrimario} className="size-3.5" />{!o.unico && <Muestra color={colores.colorSecundario} className="size-3.5" />}</span>{o.texto}
              </label>)}
            </div>
            {!colores.usarColorUnico && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => cambiarMarca({ colorPrimario: colores.colorSecundario, colorSecundario: colores.colorPrimario })}>
              <ArrowLeftRight className="mr-1.5 size-3.5" />Intercambiar
            </Button>}
          </div>
          <p className="text-xs text-muted-foreground">{colores.usarColorUnico ? 'Todo con tu color principal.' : `El primero pinta lo principal (${{ moderna: 'la portada entera', artesanal: 'el toldo y los botones', elegante: 'el nombre y los botones' }[value.plantilla ?? 'artesanal']}); el segundo, ${{ moderna: 'la cinta y los sellos', artesanal: 'el lazo de bienvenida y los sellos', elegante: 'los marcos y la firma' }[value.plantilla ?? 'artesanal']}.`}</p>
        </Decision>}

        <Decision titulo="Fondo" detalle="El ambiente de la tienda. Los botones y detalles siguen con tus colores.">
          <div role="radiogroup" aria-label="Fondo de la tienda" className="grid grid-cols-2 gap-2 @md:grid-cols-4">
            {AMBIENTES.map(a => {
              const c = coloresAmbiente(a, colores.colorPrimario)
              const e = estiloTienda({ ...value, colores: c }, colores)
              return <Opcion key={a.id} nombre={`${id}-fondo`} etiqueta={a.nombre} elegida={ambiente === a.id} onElegir={() => patch({ colores: c })} className="p-2">
                <span aria-hidden className="relative block h-16 overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background: e.fondo }}>
                  <span className="absolute bottom-2 left-2 right-6 h-6 rounded-md" style={{ background: e.superficie }} />
                  <span className="absolute left-3.5 top-2.5 h-1.5 w-8 rounded-full" style={{ background: e.texto }} />
                  <Muestra color={e.primario} className="absolute right-2 top-2 size-3.5" />
                </span>
                <span className="px-0.5 pt-2 text-[13px] font-medium leading-tight">{a.nombre}</span>
                <span className="px-0.5 text-[11px] leading-tight text-muted-foreground">{a.detalle}</span>
              </Opcion>
            })}
          </div>
          {!ambiente && <p className="text-xs text-muted-foreground">Ahora usás una paleta propia (en Opciones avanzadas). Elegí un fondo para volver a una de estas.</p>}
        </Decision>

        <Decision titulo="Tipografía" detalle="La letra de los títulos y de los textos.">
          <div role="radiogroup" aria-label="Tipografía" className="grid grid-cols-2 gap-2 @xl:grid-cols-3">
            {[{ id: 'diseno', nombre: 'La del diseño', detalle: 'La que trae la plantilla', titulos: BASES[value.plantilla ?? 'artesanal'].titulos, cuerpo: BASES[value.plantilla ?? 'artesanal'].cuerpo, peso: BASES[value.plantilla ?? 'artesanal'].peso }, ...TIPOGRAFIAS].map(t =>
              <Opcion key={t.id} nombre={`${id}-letra`} etiqueta={t.nombre} elegida={tipografia === t.id} onElegir={() => patch({ fuentes: t.id === 'diseno' ? undefined : { titulos: t.titulos, cuerpo: t.cuerpo, pesoTitulos: t.peso } })} className="p-3">
                <span aria-hidden className="block truncate pr-5 text-[24px] leading-tight" style={{ fontFamily: `'${t.titulos}', serif`, fontWeight: t.peso }}>{nombreLocal}</span>
                <span aria-hidden className="mt-0.5 block truncate text-xs text-muted-foreground" style={{ fontFamily: `'${t.cuerpo}', sans-serif` }}>Pedí online, directo de la cocina</span>
                <span className="mt-2 text-[13px] font-medium leading-tight">{t.nombre}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{t.detalle}</span>
              </Opcion>)}
          </div>
        </Decision>

        <Decision titulo="Cómo te presentás" detalle="La frase grande de la portada y una descripción corta debajo.">
          <ElegirTexto etiqueta="Frase de tu local" propuestas="Frases propuestas" opciones={textos.frases} valor={value.frase} onCambiar={frase => patch({ frase })} max={90} />
          <ElegirTexto etiqueta="Descripción breve" propuestas="Descripciones propuestas" opciones={textos.bajadas} valor={value.bajada} onCambiar={bajada => patch({ bajada })} max={220} largo />
        </Decision>

        <Decision titulo="Lo que te hace especial" detalle="Frases cortas que resumen tu local. Elegí hasta 10.">
          <ElegirCinta opciones={textos.cinta} valor={value.cinta} onCambiar={cinta => patch({ cinta })} />
        </Decision>

        <Decision titulo="Tu plato recomendado" detalle="Va en la portada, bien grande. Si no elegís uno, no aparece ningún destacado.">
          <SelectorProductoDestacado productos={productos} value={value.productoDestacadoId} onChange={productoDestacadoId => patch({ productoDestacadoId })} className="" />
        </Decision>

        {modo === 'alta'
          ? <details className="rounded-2xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">Fotos, historia y contacto (opcional)</summary>
            <div className="mt-6 space-y-7">{detalles}</div>
          </details>
          : detalles}

        <Button type="button" variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => { setRubroId(undefined); onChange({}) }}>Quitar personalización y usar el diseño predeterminado</Button>
      </fieldset>

      <aside className="hidden @3xl:block">
        <div className="sticky top-6 space-y-3">
          <VistaPrevia config={value} marca={colores} nombre={nombreLocal} plato={plato} />
          <p className="text-center text-xs text-muted-foreground">Vista previa aproximada de la portada</p>
        </div>
      </aside>
    </div>
  </div>
}

/** Para quien ya tiene su paleta y sus fuentes: los valores exactos, que pisan las decisiones de arriba. */
function Avanzado({ value, patch }: { value: TiendaConfig; patch: (p: Partial<TiendaConfig>) => void }) {
  const id = useId()
  const texto = (clave: string, label: string, valor: string | undefined, cambiar: (s: string | undefined) => void, max: number, placeholder?: string) =>
    <div className="space-y-2">
      <label htmlFor={`${id}-${clave}`} className="text-sm font-medium">{label}</label>
      <Input id={`${id}-${clave}`} value={valor ?? ''} maxLength={max} placeholder={placeholder} onChange={e => cambiar(e.target.value || undefined)} />
    </div>
  return <details className="rounded-2xl border p-4">
    <summary className="cursor-pointer text-sm font-medium">Paleta y tipografías personalizadas (opcional)</summary>
    <div className="mt-5 space-y-5">
      <p className="text-sm text-muted-foreground">Valores exactos para una marca con manual propio. Reemplazan al fondo y la tipografía elegidos arriba; vacíos, se usa lo elegido.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['fondo', 'superficie', 'texto', 'acento'] as const).map(key => <div key={key} className="flex items-end gap-2">
          <input type="color" aria-label={`Selector del color de ${key}`} value={/^#[\da-f]{6}$/i.test(value.colores?.[key] ?? '') ? value.colores![key] : '#ffffff'} onChange={e => patch({ colores: { ...value.colores, [key]: e.target.value } })} className="h-10 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1" />
          <div className="min-w-0 flex-1">{texto(`color-${key}`, `Color de ${key}`, value.colores?.[key], v => patch({ colores: { ...value.colores, [key]: v } }), 7, '#ffffff')}</div>
        </div>)}
      </div>
      {texto('fuente-titulos', 'Fuente de los títulos', value.fuentes?.titulos, titulos => patch({ fuentes: { ...value.fuentes, titulos } }), 60, 'DM Sans')}
      {texto('fuente-cuerpo', 'Fuente del cuerpo', value.fuentes?.cuerpo, cuerpo => patch({ fuentes: { ...value.fuentes, cuerpo } }), 60, 'DM Sans')}
      {texto('fuente-css', 'Enlace a la hoja de fuentes', value.fuentes?.cssUrl, cssUrl => patch({ fuentes: { ...value.fuentes, cssUrl } }), 2048, 'https://fonts.googleapis.com/css2?…')}
      <p className="text-xs text-muted-foreground">Sin enlace, la tienda busca las familias elegidas en Google Fonts.</p>
      <div className="space-y-2">
        <label htmlFor={`${id}-peso`} className="text-sm font-medium">Peso de los títulos</label>
        <Input id={`${id}-peso`} type="number" min={100} max={900} step={1} placeholder="El del diseño" value={value.fuentes?.pesoTitulos ?? ''} onChange={e => patch({ fuentes: { ...value.fuentes, pesoTitulos: e.target.value ? Number(e.target.value) : undefined } })} />
      </div>
    </div>
  </details>
}

/** Se reutiliza al revisar la carta, cuando los productos nuevos ya tienen su ID. */
export function SelectorProductoDestacado({ productos, value, onChange, disabled = false, className = 'border-t pt-5' }: {
  productos: ProductoDestacable[]; value?: number; onChange: (id: number | undefined) => void; disabled?: boolean; className?: string
}) {
  const id = useId()
  const lista = elegibles(productos)
  return <div className={`space-y-2 ${className}`}>
    <label htmlFor={`${id}-destacado`} className="text-sm font-medium">Producto destacado</label>
    <select id={`${id}-destacado`} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">Sin producto destacado</option>
      {value && !lista.some(p => p.id === value) && <option value={value}>Producto elegido ya no disponible</option>}
      {lista.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
    </select>
    <p className="text-xs text-muted-foreground">Se muestra en la portada de tu tienda. Si no elegís uno, no aparece ningún destacado.</p>
    {!lista.length && <p className="text-xs text-muted-foreground">Cuando tengas productos activos guardados en tu carta, vas a poder elegirlos acá.</p>}
  </div>
}

