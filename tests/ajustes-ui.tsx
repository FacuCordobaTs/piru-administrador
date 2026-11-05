import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useRestauranteStore } from '../src/store/restauranteStore'
import { useModulosStore } from '../src/store/modulosStore'
import { useAuthStore } from '../src/store/authStore'
import Ajustes from '../src/pages/ajustes'
import Modulos from '../src/pages/Modulos'
import '../src/index.css'

const modulo = (codigo: string, nombre: string, activoAhora = false, tipo = 'incluido') => ({ codigo, nombre, activoAhora, tipo, activable: true, estadoProducto: 'disponible', estado: activoAhora ? 'activo' : 'inactivo', precioMensual: tipo === 'pago' ? 30000 : 0 })
useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })
useRestauranteStore.setState({ fetchData: async () => {}, restaurante: { nombre: 'Piru Prueba', username: 'prueba', direccion: 'Av. Siempre Viva 742', deliveryFee: '20', telefono: '3415550000', permitirPedidosProgramados: true } as never })
useModulosStore.setState({ cargar: async () => {}, categorias: [
  { id: 1, codigo: 'ventas', nombre: 'Ventas en el local', modulos: [modulo('pos', 'Punto de venta', true), modulo('mesas', 'Mesas', true)] },
  { id: 2, codigo: 'operacion', nombre: 'Operación y administración', modulos: [modulo('gestion_stock', 'Gestión de stock'), modulo('facturacion_arca', 'Facturación ARCA')] },
  { id: 4, codigo: 'cobros', nombre: 'Cobros', modulos: [modulo('mercadopago', 'Mercado Pago', true)] },
  { id: 3, codigo: 'marketing', nombre: 'Clientes y fidelización', modulos: [modulo('avisos_automaticos_whatsapp', 'Avisos automáticos', true, 'pago'), modulo('crecimiento', 'Campañas de adquisición', true, 'pago'), modulo('motor_recompra', 'Retención', false, 'pago')] },
] as never, suscripcion: { estado: 'activa', ciclo: 'mensual', suscripcionId: 1, suscripcionBase: { precioMensual: 40000, descuentoAnual: 20 }, cotizacionProximaFactura: { montoTotalMensual: 40000 } } as never })

/** Permite a la suite probar los gates de Ajustes sin recargar el fixture. */
;(window as unknown as { __piruModulo: (codigo: string, activo: boolean) => void }).__piruModulo = (codigo, activo) => {
  useModulosStore.setState((state) => ({
    categorias: state.categorias.map((categoria) => ({
      ...categoria,
      modulos: categoria.modulos.map((modulo) => modulo.codigo === codigo
        ? { ...modulo, activoAhora: activo, estado: activo ? 'activo' : 'inactivo' }
        : modulo),
    })),
  }))
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[window.location.hash.slice(1) || '/dashboard/ajustes']}><PrinterProvider><Routes><Route path="/dashboard/ajustes/:seccion?" element={<Ajustes />} /><Route path="/dashboard/modulos" element={<Modulos />} /><Route path="*" element={<RutaActual />} /></Routes></PrinterProvider></MemoryRouter>)

/** Destino de un redirect: el harness no tiene el resto de las pantallas montadas. */
export function RutaActual() {
  const { pathname, search } = useLocation()
  return <p data-testid="ruta">{pathname}{search}</p>
}
