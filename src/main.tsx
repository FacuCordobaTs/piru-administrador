import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster, toast } from 'sonner'
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
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

function App() {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update?.available) {
          toast.info(`Descargando actualización v${update.version}...`);
          await update.downloadAndInstall();

          toast.success("Actualización lista. Reiniciando...");
          await new Promise(r => setTimeout(r, 2000)); // Espera un poco
          await relaunch();
        }
      } catch (error) {
        console.error("Error buscando actualizaciones:", error);
      }
    };

    checkForUpdates();
  }, []);

  return <RouterProvider router={router} />;
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
