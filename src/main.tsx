import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Register from './pages/Register'
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
import Repartidores from './pages/Repartidores'
import CodigosDescuento from './pages/CodigosDescuento'
import { PrinterProvider } from './context/PrinterContext'
import Onboarding from './pages/Onboarding';
import Metricas from './pages/Metricas';
import UpdaterPrompt from './components/UpdaterPrompt';



const router = createBrowserRouter([
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
            path: "repartidores",
            element: <Repartidores />,
          },
          {
            path: "codigos-descuento",
            element: <CodigosDescuento />,
          },
          {
            path: "ajustes",
            element: <Navigate to="/dashboard/ajustes/general" replace />,
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
