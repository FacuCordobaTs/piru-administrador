# Guía de Configuración - Sistema de Autenticación

## Implementación Completada ✅

Se ha implementado un sistema completo de autenticación que incluye:

1. **Auth Store con Zustand** - Gestión del estado de autenticación
2. **Login y Register** - Páginas conectadas al backend
3. **Protected Routes** - Rutas protegidas con redirección automática
4. **API Utilities** - Funciones para comunicación con el backend

## Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en la carpeta `admin/`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 2. Backend

Asegúrate de que el backend tenga configurado el archivo `.env` con:

```env
DB_HOST=localhost
DB_USER=tu_usuario_db
DB_PASSWORD=tu_contraseña_db
DB_NAME=piru_db
DB_PORT=3306
JWT_SECRET=tu_secreto_jwt
PORT=3000
```

## Estructura Implementada

### Auth Store (`src/store/authStore.ts`)
```typescript
- token: string | null
- restaurante: Restaurante | null
- isAuthenticated: boolean
- setAuth(token, restaurante): void
- logout(): void
- updateRestaurante(restaurante): void
```

El store usa `zustand` con persistencia local, por lo que el usuario permanece logueado incluso al recargar la página.

### API Utilities (`src/lib/api.ts`)

Incluye funciones para:
- `authApi.login(email, password)` - Iniciar sesión
- `authApi.register(email, password, nombre)` - Registrar nuevo restaurante
- `restauranteApi.getProfile(token)` - Obtener perfil
- `productosApi.*` - CRUD de productos
- `mesasApi.*` - CRUD de mesas

### Protected Layout (`src/components/ProtectedLayout.tsx`)

Componente que protege las rutas privadas:
- Verifica si el usuario está autenticado
- Redirige a `/login` si no está autenticado
- Usa `<Outlet />` para renderizar las rutas hijas

### Rutas Actualizadas

```
/ -> redirige a /login
/login -> Página de inicio de sesión
/register -> Página de registro
/dashboard -> Protected (requiere autenticación)
  ├── /dashboard (index)
  ├── /dashboard/mesas
  ├── /dashboard/notificaciones
  └── /dashboard/productos
```

## Flujo de Autenticación

### Login
1. Usuario ingresa email y contraseña
2. Se envía POST a `/api/auth/login-restaurante`
3. Backend valida credenciales y devuelve token + datos del restaurante
4. Se guarda en el auth store
5. Redirección a `/dashboard`

### Register
1. Usuario ingresa nombre, email y contraseña
2. Se envía POST a `/api/auth/register-restaurante`
3. Backend crea cuenta y devuelve token + datos del restaurante
4. Se guarda en el auth store
5. Redirección a `/dashboard`

### Logout
1. Usuario hace clic en "Cerrar Sesión"
2. Se limpia el auth store
3. Redirección a `/login`

## Uso en Componentes

### Acceder al usuario autenticado
```typescript
import { useAuthStore } from '@/store/authStore'

const MyComponent = () => {
  const { restaurante, token, isAuthenticated } = useAuthStore()
  
  // Usar token para llamadas a la API
  const fetchData = async () => {
    const data = await restauranteApi.getProfile(token!)
  }
}
```

### Hacer llamadas a la API
```typescript
import { productosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const ProductosPage = () => {
  const token = useAuthStore((state) => state.token)
  
  const createProduct = async () => {
    try {
      await productosApi.create(token!, {
        nombre: 'Pizza Margherita',
        precio: 12.50,
        descripcion: 'Pizza clásica italiana'
      })
    } catch (error) {
      console.error(error)
    }
  }
}
```

## Correcciones al Backend

Se realizó una corrección en el backend para mantener consistencia:

**Backend/src/libs/jwt.ts** - Se cambió `TOKEN_SECRET` por `JWT_SECRET` para que coincida con el middleware de autenticación.

## Próximos Pasos

1. Iniciar el backend: `cd Backend && bun run dev`
2. Iniciar el admin: `cd admin && npm run dev`
3. Crear un restaurante en `/register`
4. Iniciar sesión en `/login`
5. Acceder al dashboard protegido

## Notas

- El token se guarda en `localStorage` automáticamente por Zustand
- Las rutas protegidas redirigen automáticamente si no hay autenticación
- Todos los endpoints de la API (excepto login/register) requieren el header `Authorization: Bearer <token>`
- Los toasts (notificaciones) ya están configurados con Sonner

