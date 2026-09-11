import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { facturacionApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import FacturacionAfipSection from '@/components/FacturacionAfipSection'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { useMetodosPago } from '../hooks/useMetodosPago'
import { useWhatsApp } from '../hooks/useWhatsApp'
import { describirMetodos, hayAlgunMetodo } from './pagos/describir'
import { MetodosEditor } from './pagos/MetodosEditor'
import {
  MercadoPagoEditor,
  CucuruEditor,
  TaloEditor,
  WhatsAppEditor,
} from './pagos/IntegracionEditors'
import type { PagosEditorId } from './pagos/types'

type MonetizacionEditorId = PagosEditorId | 'arca' | null

export default function Monetizacion() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const token = useAuthStore((s) => s.token)
  const [editor, setEditor] = useState<MonetizacionEditorId>(null)
  const [arcaHabilitada, setArcaHabilitada] = useState<boolean | null>(null)
  const [searchParams] = useSearchParams()
  const metodos = useMetodosPago()
  const wa = useWhatsApp()

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

  // Estado de Facturación ARCA
  useEffect(() => {
    if (!token || !facturacionActiva) return
    facturacionApi
      .getEstado(token)
      .then((res) => {
        const data = res as { success: boolean; data?: { habilitado?: boolean } }
        setArcaHabilitada(!!data.data?.habilitado)
      })
      .catch(() => setArcaHabilitada(false))
  }, [token, facturacionActiva])

  const cucuruOk = !!restaurante?.cucuruConfigurado
  const taloOk = !!(restaurante?.taloClientId && restaurante?.taloClientSecret && restaurante?.taloUserId)
  const mpOk = !!restaurante?.mpConnected
  const waConectado = !!wa.status?.conectado
  const waVencido = waConectado && !!wa.status?.tokenVencido

  // Deep links directos desde Módulos o enlaces previos
  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'mercadopago' && mercadoPagoActivo) setEditor('mercadopago')
    if (config === 'talo' && taloActivo) setEditor('talo')
    if (config === 'arca' && facturacionActiva) setEditor('arca')
  }, [searchParams, mercadoPagoActivo, taloActivo, facturacionActiva])

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Monetización
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Configurá los medios de cobro habilitados para tu tienda web: pagos online con tarjetas y saldo mediante Mercado Pago, o transferencias directas cuenta a cuenta 3.0 a través de Talo con verificación automática por webhook.
          </p>
          <p>
            También podés ofrecer cobro en efectivo al entregar o retirar, vincular tu número de WhatsApp para atención y activar la emisión de facturación electrónica automática autorizada por AFIP/ARCA.
          </p>
        </div>
      </header>

      {/* Ajustes y herramientas del pilar */}
      <div className="space-y-1">
        <AjusteRow
          titulo="Métodos de pago habilitados"
          oracion={describirMetodos(metodos.config, mpOk, cucuruOk, taloOk)}
          estado={hayAlgunMetodo(metodos.config, mpOk, cucuruOk, taloOk) ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('metodos')}
        />

        {mercadoPagoActivo ? (
          <AjusteRow
            titulo="Mercado Pago"
            oracion={
              mpOk
                ? 'Conectado · Tarjetas de crédito, débito y dinero disponible en cuenta'
                : 'Sin conectar · Vinculá tu cuenta de Mercado Pago en un click'
            }
            estado={mpOk ? 'configurado' : 'sin-configurar'}
            accionLabel={mpOk ? 'Cambiar' : 'Conectar'}
            onAccion={() => setEditor('mercadopago')}
          />
        ) : (
          <AjusteRow
            titulo="Mercado Pago"
            oracion="Activá el módulo desde Módulos para cobrar online con tarjetas y saldo de Mercado Pago."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

        {taloActivo ? (
          <AjusteRow
            titulo="Talo (Transferencias 3.0 en tiempo real)"
            oracion={
              taloOk
                ? 'Conectado · Transferencias automáticas cuenta a cuenta validadas al instante'
                : 'Sin conectar · Ingresá tus credenciales de API de Talo'
            }
            estado={taloOk ? 'configurado' : 'sin-configurar'}
            accionLabel={taloOk ? 'Cambiar' : 'Configurar'}
            onAccion={() => setEditor('talo')}
          />
        ) : (
          <AjusteRow
            titulo="Talo (Transferencias 3.0 en tiempo real)"
            oracion="Activá el módulo para recibir transferencias inmediatas verificadas automáticamente por webhook."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

        {/* Cucuru: soporte de cuentas previas como Alfajor */}
        {cucuruOk && (
          <AjusteRow
            titulo="Cucuru"
            oracion="Conectado · Transferencias directas"
            estado="configurado"
            onAccion={() => setEditor('cucuru')}
          />
        )}

        {facturacionActiva ? (
          <AjusteRow
            titulo="Facturación electrónica (ARCA / AFIP)"
            oracion={
              arcaHabilitada === null
                ? 'Cargando estado fiscal…'
                : arcaHabilitada
                ? 'Configurada · Emisión automática de comprobantes fiscales autorizados'
                : 'Sin configurar · Conectá tu CUIT y clave fiscal de ARCA'
            }
            estado={arcaHabilitada ? 'configurado' : 'sin-configurar'}
            accionLabel={arcaHabilitada ? 'Cambiar' : 'Configurar'}
            onAccion={() => setEditor('arca')}
          />
        ) : (
          <AjusteRow
            titulo="Facturación electrónica (ARCA / AFIP)"
            oracion="Activá el módulo para emitir comprobantes fiscales electrónicos de AFIP/ARCA automáticamente."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

        <AjusteRow
          titulo="WhatsApp Business"
          oracion={
            waVencido
              ? 'Token vencido · Reconectá tu número oficial de WhatsApp'
              : waConectado
              ? `Conectado · ${wa.status?.phoneNumber ?? ''}`
              : 'Sin conectar · Conectá tu número oficial para recepción de pedidos'
          }
          estado={waVencido ? 'atencion' : waConectado ? 'configurado' : 'sin-configurar'}
          accionLabel={waVencido ? 'Reconectar' : waConectado ? 'Cambiar' : 'Conectar'}
          onAccion={() => (waConectado ? setEditor('whatsapp') : wa.conectar())}
        />
      </div>

      {/* Editores modales */}
      <AjusteEditor
        open={editor === 'metodos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Métodos de cobro"
        descripcion="Elegí qué medios de pago ofrecés a tus comensales en la tienda web."
        status={metodos.status}
      >
        <MetodosEditor
          metodos={metodos}
          mpOk={mpOk}
          cucuruOk={cucuruOk}
          taloOk={taloOk}
          mercadoPagoActivo={mercadoPagoActivo}
          taloActivo={taloActivo}
          irA={setEditor}
          irAModulo={() => {
            document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      </AjusteEditor>

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

      <AjusteEditor
        open={editor === 'arca' && facturacionActiva}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Facturación electrónica (ARCA / AFIP)"
        descripcion="Conectá tu CUIT y clave fiscal de ARCA para emitir comprobantes legales."
      >
        <FacturacionAfipSection />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'whatsapp'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="WhatsApp Business"
        descripcion="Conexión de número oficial de WhatsApp para recepción de pedidos."
      >
        <WhatsAppEditor wa={wa} />
      </AjusteEditor>
    </section>
  )
}
