import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const Welcome = () => {
  const navigate = useNavigate()
  const [fadeIn, setFadeIn] = useState(false)

  useEffect(() => {
    setFadeIn(true)
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className={`w-full max-w-2xl p-8 md:p-12 transition-all duration-1000 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="text-center space-y-6">
          <div className="inline-block">
            <h1 className="text-5xl md:text-7xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              PIRU
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-muted-foreground font-light">
            Gestión inteligente para tu restaurante
          </p>
          
          <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
            Administra mesas, pedidos y productos desde un solo lugar. 
            Simple, rápido e intuitivo.
          </p>

          <div className="pt-8 space-y-4">
            <Button 
              size="lg" 
              className="w-full md:w-auto px-8 text-lg h-12"
              onClick={() => navigate('/login')}
            >
              Comenzar
            </Button>
          </div>

          <div className="pt-8 grid grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">📱</div>
              <p className="text-sm text-muted-foreground">QR Digital</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">⚡</div>
              <p className="text-sm text-muted-foreground">Tiempo Real</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">📊</div>
              <p className="text-sm text-muted-foreground">Analíticas</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default Welcome

