import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useRestauranteStore } from '../src/store/restauranteStore'
import { useModulosStore } from '../src/store/modulosStore'
import Ajustes from '../src/pages/ajustes'
import '../src/index.css'

const modulo = (codigo: string, nombre: string, activoAhora = false, tipo = 'incluido') => ({ codigo, nombre, activoAhora, tipo, activable: true, estadoProducto: 'disponible', estado: activoAhora ? 'activo' : 'inactivo', precioMensual: tipo === 'pago' ? 30000 : 0 })
useRestauranteStore.setState({ restaurante: { nombre: 'Piru Prueba', username: 'prueba', deliveryFee: '20', telefono: '3415550000' } as never })
useModulosStore.setState({ cargar: async () => {}, categorias: [
  { id: 1, codigo: 'ventas', nombre: 'Ventas en el local', modulos: [modulo('pos', 'Punto de venta', true), modulo('mesas', 'Mesas')] },
  { id: 2, codigo: 'operacion', nombre: 'Operación y administración', modulos: [modulo('gestion_stock', 'Gestión de stock'), modulo('facturacion_arca', 'Facturación ARCA')] },
  { id: 4, codigo: 'cobros', nombre: 'Cobros', modulos: [modulo('mercadopago', 'Mercado Pago')] },
  { id: 3, codigo: 'marketing', nombre: 'Clientes y fidelización', modulos: [modulo('avisos_automaticos_whatsapp', 'Avisos automáticos', false, 'pago')] },
] as never, suscripcion: { estado: 'activa', ciclo: 'mensual', suscripcionId: 1, suscripcionBase: { precioMensual: 40000, descuentoAnual: 20 }, cotizacionProximaFactura: { montoTotalMensual: 40000 } } as never })
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/dashboard/ajustes/general']}><PrinterProvider><Routes><Route path="/dashboard/ajustes/:seccion" element={<Ajustes />} /></Routes></PrinterProvider></MemoryRouter>)
