import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'

const Register = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Apply system theme preference on mount
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (password.length < 3) {
      toast.error('La contraseña debe tener al menos 3 caracteres')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await authApi.register(email, password, nombre)
      
      if (
        typeof response === 'object' &&
        response !== null &&
        'token' in response &&
        'newRestaurante' in response
      ) {
        const { token, newRestaurante, message } = response as { token: string; newRestaurante: any; message?: string };
        setAuth(token, newRestaurante[0])
        toast.success('¡Cuenta creada!', {
          description: message || 'Registro exitoso',
        })
        navigate('/dashboard')
      } else {
        console.error('Register error:', response)
        const data = await response as { token: string; newRestaurante: any; message?: string }
        console.error('Register error:', data)
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      console.error('Register error:', error)
      if (error instanceof ApiError) {
        toast.error('Error al registrarse', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              PIRU
            </h1>
          </div>
          <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
          <CardDescription>
            Regístrate para comenzar a gestionar tu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del restaurante</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Mi Restaurante"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={3}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={3}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={3}
                className="transition-all focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Creando cuenta...' : 'Registrarse'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Register

