import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PosConfigForm } from '@/components/PosConfigDialog'
import { useModuloActivo } from '@/store/modulosStore'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteRow } from '../components/AjusteRow'
import { SucursalesLista } from '../components/SucursalesLista'
import { useSucursales } from '../hooks/useSucursales'

/**
 * Configuración de las herramientas de venta que el local ya tiene activas.
 * El catálogo y la activación viven en Módulos, no en Ajustes.
 */
export default function Ventas() {
  const navigate = useNavigate()
  const posActivo = useModuloActivo('pos')
  const mesasActivo = useModuloActivo('mesas')
  const stockActivo = useModuloActivo('gestion_stock')
  const cierreTurnoActivo = useModuloActivo('cierre_turno_manual')
  const [configurandoPos, setConfigurandoPos] = useState(false)
  const [editandoEventos, setEditandoEventos] = useState(false)
  const { sucursales, recargar } = useSucursales()
  const eventos = sucursales.filter((sucursal) => sucursal.soloPos)

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Ventas en el local</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Punto de venta, mesas y stock: las herramientas para atender y vender en el local.
        </p>
      </header>

      <div>
        {posActivo && (
          <AjusteRow
            titulo="Punto de venta"
            oracion="Qué datos y opciones se cargan al anotar un pedido en este dispositivo."
            accionLabel="Configurar"
            onAccion={() => setConfigurandoPos(true)}
          />
        )}
        {posActivo && (
          <AjusteRow
            titulo="Eventos con POS"
            oracion={eventos.some((evento) => evento.activo)
              ? 'El POS atiende en el evento; la tienda sigue en el local'
              : 'Tomá e imprimí pedidos fuera del local sin mezclar la tienda'}
            estado={eventos.some((evento) => evento.activo) ? 'configurado' : 'sin-configurar'}
            accionLabel={eventos.length ? 'Administrar' : 'Crear evento'}
            onAccion={() => setEditandoEventos(true)}
          />
        )}
        {mesasActivo && (
          <AjusteRow
            titulo="Mesas"
            oracion="Mesas del local y su consumo abierto."
            onAccion={() => navigate('/dashboard/mesas')}
          />
        )}
        {stockActivo && (
          <AjusteRow
            titulo="Control de stock"
            oracion="Insumos, recetas por producto y movimientos."
            onAccion={() => navigate('/dashboard/productos?tab=stock')}
          />
        )}
        {cierreTurnoActivo && (
          <AjusteRow
            titulo="Cierre de turno"
            oracion="Desde Inicio, al cerrar la caja, ves lo que entró por cada medio de pago."
          />
        )}
      </div>

      <AjusteEditor
        open={configurandoPos}
        onOpenChange={(abierto) => !abierto && setConfigurandoPos(false)}
        titulo="Configurar punto de venta"
        descripcion="La configuración se guarda en este dispositivo."
      >
        {configurandoPos && <PosConfigForm onSaved={() => setConfigurandoPos(false)} />}
      </AjusteEditor>

      <AjusteEditor
        open={editandoEventos}
        onOpenChange={(abierto) => !abierto && setEditandoEventos(false)}
        titulo="Eventos con POS"
        descripcion="En la computadora del evento, elegí su sede desde Cambiar sucursal. La computadora del local conserva su vista habitual."
      >
        <SucursalesLista sucursales={eventos} onChanged={recargar} soloPos />
      </AjusteEditor>
    </section>
  )
}
