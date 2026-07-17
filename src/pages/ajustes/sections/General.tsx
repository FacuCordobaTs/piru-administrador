import { useState } from 'react'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import {
  DireccionField,
  SucursalJustInTime,
  DisenoSelector,
  ColorField,
  LogoField,
} from './general/campos'

type EditorId = 'negocio' | 'tienda' | 'logos' | null

export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const nombre = restaurante?.nombre?.trim()
  const dirCorta = restaurante?.direccionTexto?.split(',')[0]?.trim()
  const username = restaurante?.username?.trim()
  const diseno = restaurante?.disenoAlternativo ? 'glass' : 'sólido'
  const tieneLogo = !!(restaurante?.imagenUrl || restaurante?.imagenLightUrl)

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">General</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Información del negocio, tu link y tu identidad visual.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Tu negocio"
          oracion={
            nombre
              ? `${nombre}${dirCorta ? ` · ${dirCorta}` : ' · sin dirección cargada'}`
              : 'Todavía no cargaste el nombre de tu local'
          }
          estado={nombre ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('negocio')}
        />
        <AjusteRow
          titulo="Tu tienda"
          oracion={
            username
              ? `piru.app/${username} · diseño ${diseno}`
              : 'Todavía no elegiste el alias de tu link'
          }
          estado={username ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('tienda')}
        />
        <AjusteRow
          titulo="Logos"
          oracion={tieneLogo ? 'Logo cargado' : 'Sin logo para el link público'}
          estado={tieneLogo ? 'configurado' : 'atencion'}
          onAccion={() => setEditor('logos')}
        />
      </div>

      <AjusteEditor
        open={editor === 'negocio'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Tu negocio"
        descripcion="Se guarda solo al salir de cada campo."
      >
        <div className="space-y-5">
          <AjusteInput campo="nombre" label="Nombre del local" placeholder="Ej: Burger Bros" />
          <DireccionField />
          <AjusteInput campo="telefono" label="Teléfono" placeholder="Ej: 11 2345 6789" inputMode="tel" />
          <SucursalJustInTime />
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'tienda'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Tu tienda"
        descripcion="Tu link público, el diseño del menú y los colores."
      >
        <div className="space-y-6">
          <AjusteInput
            campo="username"
            label="Alias de tu link"
            prefix="piru.app/"
            mono
            transform={(v) => v.toLowerCase().replace(/[^a-z0-9-]/g, '')}
            validate={(v) =>
              !v ? 'El alias no puede quedar vacío' : v.length < 3 ? 'Usá al menos 3 caracteres' : null
            }
          />
          <DisenoSelector />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField campo="colorPrimario" label="Color primario (botones)" fallback="#FF7A00" />
            <ColorField campo="colorSecundario" label="Color secundario (fondos)" fallback="#FFFFFF" />
          </div>
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'logos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Logos"
        descripcion="Se guardan apenas los subís."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <LogoField which="image" campoLocal="imagenUrl" label="Logo (modo oscuro)" current={restaurante?.imagenUrl ?? null} dark />
          <LogoField which="imageLight" campoLocal="imagenLightUrl" label="Logo (modo claro)" current={restaurante?.imagenLightUrl ?? null} />
        </div>
      </AjusteEditor>
    </section>
  )
}
