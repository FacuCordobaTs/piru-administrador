import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { useMetodosPago } from '../hooks/useMetodosPago'
import { SavedIndicator } from '../components/SavedIndicator'
import { MetodosHabilitados } from './pagos/MetodosHabilitados'
import {
  MercadoPagoEditor,
  CucuruEditor,
  TaloEditor,
} from './pagos/IntegracionEditors'
import type { PagosEditorId } from './pagos/types'

/** Los métodos se eligen en la vista principal; los editores son de cada conexión. */
type MonetizacionEditorId = PagosEditorId | null

export default function Monetizacion() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [editor, setEditor] = useState<MonetizacionEditorId>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const metodos = useMetodosPago()

  const mercadoPagoActivo = useModuloActivo('mercadopago')
  const taloActivo = useModuloActivo('talo')
  const facturacionActiva = useModuloActivo('facturacion_arca')

  // ── OAuth de MercadoPago: procesa ?mp_status= al volver del callback ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mpStatus = params.get('mp_status')
    const mpError = params.get('mp_error')
    if (mpStatus === 'success') {
      toast.success('Mercado Pago conectado', {
        description: 'Ahora tus clientes pueden pagar con Mercado Pago en tu tienda.',
      })
      void fetchData()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mpStatus === 'error') {
      const msg =
        mpError === 'missing_params'
          ? 'Faltan parámetros de autorización'
          : mpError === 'config_error'
          ? 'Error de configuración del servidor'
          : mpError === 'oauth_failed'
          ? 'Error en la autenticación con Mercado Pago'
          : 'No se pudo conectar con Mercado Pago'
      toast.error('Error al conectar Mercado Pago', { description: msg })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchData])

  const cucuruOk = !!restaurante?.cucuruConfigurado
  const taloOk = !!(restaurante?.taloClientId && restaurante?.taloClientSecret && restaurante?.taloUserId)
  const mpOk = !!restaurante?.mpConnected

  // Deep links directos desde Módulos o enlaces previos
  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'mercadopago' && mercadoPagoActivo) setEditor('mercadopago')
    if (config === 'talo' && taloActivo) setEditor('talo')
    // Enlaces guardados de cuando ARCA vivía en Métodos de pago.
    if (config === 'arca') navigate('/dashboard/facturacion', { replace: true })
  }, [searchParams, mercadoPagoActivo, taloActivo, navigate])

  // Cada proveedor aparece una sola vez: su fila dice si falta activarlo, conectarlo o ya está.
  const mercadoPago = !mercadoPagoActivo
    ? { oracion: 'Activá el módulo para cobrar con tarjetas y dinero en cuenta.', estado: 'sin-configurar' as const, accion: 'Ver módulos', ir: () => navigate('/dashboard/modulos') }
    : mpOk
      ? { oracion: 'Conectado · tarjetas y dinero en cuenta', estado: 'configurado' as const, accion: 'Cambiar', ir: () => setEditor('mercadopago') }
      : { oracion: 'Sin conectar · vinculá tu cuenta en un click', estado: 'sin-configurar' as const, accion: 'Conectar', ir: () => setEditor('mercadopago') }
  const talo = !taloActivo
    ? { oracion: 'Activá el módulo para recibir transferencias verificadas al instante.', estado: 'sin-configurar' as const, accion: 'Ver módulos', ir: () => navigate('/dashboard/modulos') }
    : taloOk
      ? { oracion: 'Conectado · transferencias verificadas al instante', estado: 'configurado' as const, accion: 'Cambiar', ir: () => setEditor('talo') }
      : { oracion: 'Sin conectar · cargá tus credenciales de Talo', estado: 'sin-configurar' as const, accion: 'Configurar', ir: () => setEditor('talo') }

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Métodos de pago</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Qué medios de pago ofrecés en tu tienda. Se guarda al tocar cada uno.
        </p>
      </header>

      {/* Lo que el local ya puede ofrecer: prender y apagar cada medio. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Métodos habilitados</h3>
          <SavedIndicator status={metodos.status} />
        </div>
        <div className="rounded-2xl border border-border/60 px-4">
          <MetodosHabilitados metodos={metodos} mpOk={mpOk} cucuruOk={cucuruOk} taloOk={taloOk} />
        </div>
      </div>

      {/* Proveedores para cobrar online y facturación: activar, conectar o cambiar. */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Conexiones</h3>
        <div>
          <AjusteRow titulo="Mercado Pago" oracion={mercadoPago.oracion} estado={mercadoPago.estado} accionLabel={mercadoPago.accion} onAccion={mercadoPago.ir} />
          <AjusteRow titulo="Talo" oracion={talo.oracion} estado={talo.estado} accionLabel={talo.accion} onAccion={talo.ir} />
          {/* Cucuru: sólo las cuentas que ya lo tenían (Alfajor). */}
          {cucuruOk && (
            <AjusteRow titulo="Cucuru" oracion="Conectado · transferencias directas" estado="configurado" onAccion={() => setEditor('cucuru')} />
          )}
          <AjusteRow
            titulo="Facturación electrónica (ARCA)"
            oracion={facturacionActiva ? 'Emití comprobantes desde el cierre de turno.' : 'Activá el módulo para emitir comprobantes fiscales.'}
            estado={facturacionActiva ? 'configurado' : 'sin-configurar'}
            accionLabel={facturacionActiva ? 'Abrir' : 'Ver módulos'}
            onAccion={() => navigate(facturacionActiva ? '/dashboard/facturacion' : '/dashboard/modulos')}
          />
        </div>
      </div>

      {/* Editores de cada conexión */}
      <AjusteEditor
        open={editor === 'mercadopago' && mercadoPagoActivo}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Mercado Pago"
        descripcion="Cobrá tarjetas de crédito, débito y dinero disponible en cuenta."
      >
        <MercadoPagoEditor conectado={mpOk} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'talo' && taloActivo}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Talo"
        descripcion="Transferencias bancarias e interoperables 3.0 validadas al instante."
      >
        <TaloEditor conectado={taloOk} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'cucuru'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Cucuru"
        descripcion="Transferencias automáticas a tu cuenta bancaria."
      >
        <CucuruEditor conectado={cucuruOk} />
      </AjusteEditor>

    </section>
  )
}
