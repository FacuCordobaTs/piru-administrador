import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useRestauranteStore } from '../src/store/restauranteStore'
import { useModulosStore } from '../src/store/modulosStore'
import { useAuthStore } from '../src/store/authStore'
import Ajustes from '../src/pages/ajustes'
import '../src/index.css'

const modulo = (codigo: string, nombre: string, activoAhora = false, tipo = 'incluido') => ({ codigo, nombre, activoAhora, tipo, activable: true, estadoProducto: 'disponible', estado: activoAhora ? 'activo' : 'inactivo', precioMensual: tipo === 'pago' ? 30000 : 0 })
useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })
useRestauranteStore.setState({ fetchData: async () => {}, restaurante: { nombre: 'Piru Prueba', username: 'prueba', deliveryFee: '20', telefono: '3415550000', permitirPedidosProgramados: true } as never })
useModulosStore.setState({ cargar: async () => {}, categorias: [
  { id: 1, codigo: 'ventas', nombre: 'Ventas en el local', modulos: [modulo('pos', 'Punto de venta', true), modulo('mesas', 'Mesas', true)] },
  { id: 2, codigo: 'operacion', nombre: 'Operación y administración', modulos: [modulo('gestion_stock', 'Gestión de stock'), modulo('facturacion_arca', 'Facturación ARCA')] },
  { id: 4, codigo: 'cobros', nombre: 'Cobros', modulos: [modulo('mercadopago', 'Mercado Pago')] },
  { id: 3, codigo: 'marketing', nombre: 'Clientes y fidelización', modulos: [modulo('avisos_automaticos_whatsapp', 'Avisos automáticos', false, 'pago'), modulo('crecimiento', 'Campañas de adquisición', false, 'pago'), modulo('motor_recompra', 'Retención', false, 'pago')] },
] as never, suscripcion: { estado: 'activa', ciclo: 'mensual', suscripcionId: 1, suscripcionBase: { precioMensual: 40000, descuentoAnual: 20 }, cotizacionProximaFactura: { montoTotalMensual: 40000 } } as never })
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[window.location.hash.slice(1) || '/dashboard/ajustes']}><PrinterProvider><Routes><Route path="/dashboard/ajustes/:seccion?" element={<Ajustes />} /><Route path="*" element={<RutaActual />} /></Routes></PrinterProvider></MemoryRouter>)

/** Destino de un redirect: el harness no tiene el resto de las pantallas montadas. */
export function RutaActual() {
  const { pathname, search } = useLocation()
  return <p data-testid="ruta">{pathname}{search}</p>
}
