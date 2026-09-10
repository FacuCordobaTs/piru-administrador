import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import Productos from '../src/pages/Productos'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
useRestauranteStore.setState({ productos: [{
    id: 1, restauranteId: 1, nombre: 'Alfajor habitual', precio: '1500', activo: true,
    categoriaId: null, categoria: null, descripcion: 'Alfajor de chocolate', imagenUrl: null, createdAt: '',
}] })
createRoot(document.getElementById('root')!).render(<div className="h-screen"><Productos /><Toaster /></div>)
