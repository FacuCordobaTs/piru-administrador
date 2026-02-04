import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedLayout from './components/ProtectedLayout'
import GuestLayout from './components/GuestLayout'
import DashboardLayout from './components/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Pedidos from './pages/Pedidos'
import Pedido from './pages/Pedido'
import Productos from './pages/Productos'
import Perfil from './pages/Perfil'
import { PrinterProvider } from './context/PrinterContext'



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
    ],
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
            element: <Pedidos />,
          },
          {
            path: "mesas",
            element: <Dashboard />,
          },
          {
            path: "pedidos/:id",
            element: <Pedido />,
          },
          {
            path: "productos",
            element: <Productos />,
          },
          {
            path: "perfil",
            element: <Perfil />,
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrinterProvider>
      <RouterProvider router={router} />
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
