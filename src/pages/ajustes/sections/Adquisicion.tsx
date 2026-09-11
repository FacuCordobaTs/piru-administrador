import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useModuloActivo } from '@/store/modulosStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'

const formatoGtm = (value: string) => value.trim().toUpperCase()
const validarGtm = (value: string) => {
  if (value === '') return null
  return /^GTM-[A-Z0-9]{4,32}$/.test(value)
    ? null
    : 'Usá el ID del contenedor, por ejemplo GTM-ABC123.'
}

export default function Adquisicion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const gtmContainerId = restaurante?.gtmContainerId?.trim() || ''

  const crecimientoActivo = useModuloActivo('crecimiento')
  const codigosActivo = useModuloActivo('codigos_descuento')

  const [gtmEditor, setGtmEditor] = useState(false)
  const [qrModal, setQrModal] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const username = restaurante?.username?.trim()
  const linkTienda = username ? `https://piru.app/${username}` : null

  useEffect(() => {
    if (searchParams.get('config') === 'gtm' && crecimientoActivo) {
      setGtmEditor(true)
    }
  }, [searchParams, crecimientoActivo])

  const handleCopyLink = async () => {
    if (!linkTienda) return
    try {
      await navigator.clipboard.writeText(linkTienda)
      toast.success('Link copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${username || 'tienda'}.png`
    a.click()
    toast.success('QR descargado en alta resolución')
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Adquisición
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Herramientas y canales para captar pedidos directos hacia tu tienda web desde historias de Instagram, reels, anuncios digitales, material impreso en el local o folletos en la bolsa de entrega.
          </p>
          <p>
            Creá enlaces que lleven a tu menú completo, a un producto específico o con el carrito ya prearmado, administrá códigos de descuento y conectá Google Tag Manager para medir visitas y conversiones de cada canal.
          </p>
        </div>
      </header>

      {/* Ajustes y herramientas del pilar */}
      <div className="space-y-1">
        <AjusteRow
          titulo="Campañas con atribución"
          oracion="Medí ventas desde Historias de Instagram, Reels, TikTok, Meta Ads, QR Salón y Packaging."
          estado="configurado"
          accionLabel="Ver campañas"
          onAccion={() => navigate('/dashboard/clientes?tab=campanas')}
        />

        <AjusteRow
          titulo="Código QR del local"
          oracion={
            linkTienda
              ? `piru.app/${username} · Listo para descargar e imprimir en cartas, barras y volantes`
              : 'Configurá el alias de tu tienda en General para emitir tu QR'
          }
          estado={linkTienda ? 'configurado' : 'sin-configurar'}
          accionLabel={linkTienda ? 'Ver y descargar QR' : 'Configurar'}
          onAccion={() => {
            if (linkTienda) setQrModal(true)
            else navigate('/dashboard/ajustes/general')
          }}
        />

        {codigosActivo ? (
          <AjusteRow
            titulo="Códigos de descuento (Cupones)"
            oracion="Cupones promocionales y de bienvenida para captar comensales en redes y folletería."
            estado="configurado"
            accionLabel="Gestionar cupones"
            onAccion={() => navigate('/dashboard/clientes?tab=cupones')}
          />
        ) : (
          <AjusteRow
            titulo="Códigos de descuento (Cupones)"
            oracion="Activá el módulo desde Módulos para crear cupones promocionales con descuento."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

        {crecimientoActivo ? (
          <AjusteRow
            titulo="Google Tag Manager (GTM) y Meta Pixel"
            oracion={
              gtmContainerId
                ? `Contenedor ${gtmContainerId} conectado · Medición de visitas y conversiones activa`
                : 'Sin contenedor configurado — conectá tu ID de GTM para medir pauta digital'
            }
            estado={gtmContainerId ? 'configurado' : 'sin-configurar'}
            accionLabel={gtmContainerId ? 'Editar' : 'Configurar'}
            onAccion={() => setGtmEditor(true)}
          />
        ) : (
          <AjusteRow
            titulo="Google Tag Manager (GTM) y Meta Pixel"
            oracion="Activá el módulo de analítica para conectar GTM y medir pauta en Instagram y TikTok."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}
      </div>

      {/* Editor de GTM */}
      <AjusteEditor
        open={gtmEditor && crecimientoActivo}
        onOpenChange={setGtmEditor}
        titulo="Google Tag Manager"
        descripcion="Pegá el ID de tu contenedor para medir visitas y conversiones de tu tienda."
      >
        <div className="space-y-3">
          <AjusteInput
            campo="gtmContainerId"
            label="ID del contenedor"
            placeholder="GTM-ABC123"
            mono
            transform={formatoGtm}
            validate={validarGtm}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Piru no inyecta scripts pesados por defecto para que la tienda cargue en milisegundos. Si utilizás Meta Pixel, Google Analytics 4 o TikTok Pixel, administralos de forma transparente dentro de tu contenedor GTM.
          </p>
        </div>
      </AjusteEditor>

      {/* Modal interactivo de QR del local */}
      <AjusteEditor
        open={qrModal}
        onOpenChange={setQrModal}
        titulo="Código QR de tu local"
        descripcion="Imprimilo en tus mesas, mostrador, cartas físicas o volantes dentro de la bolsa."
      >
        {linkTienda && (
          <div className="space-y-6 pt-1">
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-border/40">
              <div ref={qrRef}>
                <QRCodeCanvas
                  value={linkTienda}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="mt-3 text-sm font-semibold tracking-tight text-neutral-900">
                piru.app/{username}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Abre al instante en el navegador del celular
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="w-full gap-2" onClick={handleCopyLink}>
                <Copy className="size-4" />
                Copiar link
              </Button>
              <Button className="w-full gap-2" onClick={handleDownloadQR}>
                <Download className="size-4" />
                Descargar QR
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t border-border/50">
              <p>• Los clientes lo escanean con la cámara de su celular y ven tu menú en milisegundos.</p>
              <p>• Nunca les exige descargar una aplicación ni crear una cuenta para pedir.</p>
              <p>• El archivo PNG descargado tiene resolución óptima para imprenta.</p>
            </div>
          </div>
        )}
      </AjusteEditor>
    </section>
  )
}
