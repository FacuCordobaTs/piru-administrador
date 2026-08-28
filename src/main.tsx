import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Register from './pages/Register'
import RegisterEmail from './pages/RegisterEmail'
import VerificarCodigo from './pages/VerificarCodigo'
import CuentaCreada from './pages/CuentaCreada'
import ProtectedLayout from './components/ProtectedLayout'
import GuestLayout from './components/GuestLayout'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Pedidos from './pages/Pedidos'
import Pedido from './pages/Pedido'
import Productos from './pages/Productos'
import AjustesPage from './pages/ajustes'
import Clientes from './pages/Clientes'
import Mensajes from './pages/Mensajes'
import Repartidores from './pages/Repartidores'
import CodigosDescuento from './pages/CodigosDescuento'
import { PrinterProvider } from './context/PrinterContext'
import Onboarding from './pages/Onboarding';
import Suscribir from './pages/Suscribir';
import Metricas from './pages/Metricas';
import MiSuscripcion from './pages/MiSuscripcion';
import UpdaterPrompt from './components/UpdaterPrompt';
import PagoLink from './pages/PagoLink';
import ClaimTienda from './pages/ClaimTienda';
import Modulos from './pages/Modulos';
import Mesas from './pages/Mesas';
import AccesoInterno from './pages/AccesoInterno';
import { initializeDesktopZoom } from './utils/desktopZoom';



const router = createBrowserRouter([
  {
    // Sesión corta emitida exclusivamente desde interno/. Fuera de GuestLayout para
    // poder reemplazar una sesión ya abierta en este navegador.
    path: "/acceso-interno",
    element: <AccesoInterno />,
  },
  {
    // Página pública de pago por link/QR (sin login): el celular paga lo que la compu muestra.
    path: "/pago/:token",
    element: <PagoLink />,
  },
  {
    // Claim de tienda (onboarding outbound, sin login): el dueño reclama la tienda que Facu le
    // armó verificando su WhatsApp. Fuera de ProtectedLayout, igual que /pago/:token.
    path: "/mi-tienda/:token",
    element: <ClaimTienda />,
  },
  {
    path: "/",
    element: <GuestLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/register",
        element: <Register />,
      },
      {
        // Alta por email + contraseña (sin verificar teléfono). Camino secundario para cuentas
        // de prueba/manuales; reusa /auth/register-restaurante.
        path: "/register-email",
        element: <RegisterEmail />,
      },
      {
        path: "/verificar/:id",
        element: <VerificarCodigo />,
      }
    ],
  },
  {
    path: "/pedido/:id",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Pedido />,
      },
    ],
  },
  {
    path: "/bienvenida",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <CuentaCreada />
      }
    ]
  },
  {
    path: "/onboarding",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Onboarding />
      }
    ]
  },
  {
    // Hard paywall: pantalla de "elegí tu plan / pagá" a la que el gate manda a los locales
    // nuevos que completaron el onboarding pero aún no tienen suscripción activa.
    path: "/suscribir",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Suscribir />
      }
    ]
  },
  {
    path: "/dashboard",
    element: <ProtectedLayout />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <Dashboard />,
          },
          {
            path: "metricas",
            element: <Metricas />,
          },
          {
            path: "pedidos",
            element: <Pedidos />,
          },
          {
            path: "pedidos/:id",
            element: <Pedido />,
          },
          {
            path: "pedido/:id",
            element: <Pedido />,
          },
          {
            path: "productos",
            element: <Productos />,
          },
          {
            path: "clientes",
            element: <Clientes />,
          },
          {
            path: "mensajes",
            element: <Mensajes />,
          },
          {
            path: "modulos",
            element: <Modulos />,
          },
          {
            path: "mesas",
            element: <Mesas />,
          },
          {
            path: "suscripcion",
            element: <MiSuscripcion />,
          },
          {
            // Ruta temporal para admins instalados y enlaces previos.
            path: "plan",
            element: <Navigate to="/dashboard/suscripcion" replace />,
          },
          {
            path: "repartidores",
            element: <Repartidores />,
          },
          {
            path: "codigos-descuento",
            element: <CodigosDescuento />,
          },
          {
            path: "ajustes",
            element: <AjustesPage />,
          },
          {
            path: "ajustes/:seccion",
            element: <AjustesPage />,
          },
          {
            // Compat: /dashboard/perfil es el redirect_uri de los OAuth (MP y
            // WhatsApp). Redirige a Pagos CONSERVANDO el query (?mp_status,
            // ?code&state=whatsapp) para que la sección Pagos los procese.
            path: "perfil",
            element: <PerfilRedirect />,
          },
        ],
      },
    ],
  },
]);

function PerfilRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/dashboard/ajustes/pagos${search}`} replace />
}

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <UpdaterPrompt />
    </>
  );
}


await initializeDesktopZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrinterProvider>
      <App />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'bg-card border border-border shadow-lg',
            title: 'text-foreground font-semibold',
            description: 'text-muted-foreground',
            actionButton: 'bg-primary text-primary-foreground',
            cancelButton: 'bg-muted text-muted-foreground',
          },
        }}
      />
    </PrinterProvider>
  </StrictMode>,
)
