import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useRestauranteStore } from '@/store/restauranteStore'
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
import { useModuloActivo } from '@/store/modulosStore'

export default function Pagos() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [editor, setEditor] = useState<PagosEditorId>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const metodos = useMetodosPago()
  const wa = useWhatsApp()

  // ── OAuth de MercadoPago: procesa ?mp_status= al volver del callback ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mpStatus = params.get('mp_status')
    const mpError = params.get('mp_error')
    if (mpStatus === 'success') {
      toast.success('Mercado Pago conectado', {
        description: 'Ahora tus clientes pueden pagar con Mercado Pago.',
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
  const waConectado = !!wa.status?.conectado
  const waVencido = waConectado && !!wa.status?.tokenVencido
  const mercadoPagoActivo = useModuloActivo('mercadopago')
  const taloActivo = useModuloActivo('talo')

  // Las cards de Módulos aterrizan directamente en la configuración elegida.
  // Si el entitlement dejó de estar activo, no abrimos ningún editor.
  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'mercadopago' && mercadoPagoActivo) setEditor('mercadopago')
    if (config === 'talo' && taloActivo) setEditor('talo')
  }, [mercadoPagoActivo, searchParams, taloActivo])

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Pagos</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cómo cobrás y qué integraciones usás.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Métodos de pago"
          oracion={describirMetodos(metodos.config, mpOk, cucuruOk, taloOk)}
          estado={hayAlgunMetodo(metodos.config, mpOk, cucuruOk, taloOk) ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('metodos')}
        />
        {mercadoPagoActivo && (
          <AjusteRow
            titulo="Mercado Pago"
            oracion={mpOk ? 'Conectado' : 'Sin conectar'}
            estado={mpOk ? 'configurado' : 'sin-configurar'}
            onAccion={() => setEditor('mercadopago')}
          />
        )}
        {/* Cucuru no se ofrece a cuentas nuevas. Sólo conservamos la configuración
            de locales que ya tienen la integración, como Alfajor. */}
        {cucuruOk && (
          <AjusteRow
            titulo="Cucuru"
            oracion="Conectado"
            estado="configurado"
            onAccion={() => setEditor('cucuru')}
          />
        )}
        {taloActivo && (
          <AjusteRow
            titulo="Talo"
            oracion={taloOk ? 'Conectado' : 'Sin conectar'}
            estado={taloOk ? 'configurado' : 'sin-configurar'}
            onAccion={() => setEditor('talo')}
          />
        )}
        <AjusteRow
          titulo="WhatsApp Business"
          oracion={
            waVencido
              ? 'Token vencido — reconectá el número'
              : waConectado
              ? `Conectado · ${wa.status?.phoneNumber ?? ''}`
              : 'Sin conectar'
          }
          estado={waVencido ? 'atencion' : waConectado ? 'configurado' : 'sin-configurar'}
          accionLabel={waVencido ? 'Reconectar' : undefined}
          onAccion={() => (waConectado ? setEditor('whatsapp') : wa.conectar())}
        />
      </div>

      {/* ── Editores ── */}
      <AjusteEditor
        open={editor === 'metodos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Métodos de pago"
        descripcion="Qué medios de pago ofrecés en tu link."
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
          irAModulo={() => navigate('/dashboard/modulos')}
        />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'mercadopago' && mercadoPagoActivo}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Mercado Pago"
        descripcion="Tarjetas y dinero en cuenta."
      >
        <MercadoPagoEditor conectado={mpOk} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'cucuru'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Cucuru"
        descripcion="Transferencias automáticas a tu cuenta."
      >
        <CucuruEditor conectado={cucuruOk} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'talo' && taloActivo}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Talo"
        descripcion="Transferencias en tiempo real."
      >
        <TaloEditor conectado={taloOk} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'whatsapp'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="WhatsApp Business"
        descripcion="Un asistente que atiende pedidos por WhatsApp."
      >
        <WhatsAppEditor wa={wa} />
      </AjusteEditor>
    </section>
  )
}
