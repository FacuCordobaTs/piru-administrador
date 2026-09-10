import { Navigate } from 'react-router'

export default function CodigosDescuento() {
  return <Navigate to="/dashboard/clientes?tab=cupones" replace />
}
