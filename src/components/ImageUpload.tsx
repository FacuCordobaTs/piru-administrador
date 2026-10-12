import { useState, useRef, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
  onImageChange: (base64: string | null) => void
  currentImage?: string | null
  maxSize?: number // in MB
  square?: boolean // preview cuadrado + info de formatos centrada (por defecto: rectángulo 16:9)
  compact?: boolean
}

const ImageUpload = ({ onImageChange, currentImage, maxSize = 5, square = false, compact = false }: ImageUploadProps) => {
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLDivElement>(null)
  const pasteHintId = useId()

  useEffect(() => {
    setPreview(currentImage || null)
  }, [currentImage])

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const validateImage = (file: File): boolean => {
    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato no válido', {
        description: 'Solo se permiten imágenes JPG, PNG y WebP',
      })
      return false
    }

    // Validar tamaño
    const maxSizeBytes = maxSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast.error('Imagen muy grande', {
        description: `El tamaño máximo es ${maxSize}MB`,
      })
      return false
    }

    return true
  }

  const handleFileChange = async (file: File) => {
    if (!validateImage(file)) return

    try {
      const base64 = await convertToBase64(file)
      setPreview(base64)
      onImageChange(base64)
      toast.success('Imagen cargada correctamente')
    } catch (error) {
      console.error('Error converting image:', error)
      toast.error('Error al cargar la imagen')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.currentTarget.closest('fieldset:disabled')) return
    const item = Array.from(e.clipboardData.items).find(item => item.kind === 'file' && item.type.startsWith('image/'))
    const file = item?.getAsFile() ?? Array.from(e.clipboardData.files).find(file => file.type.startsWith('image/'))
    // El texto pegado conserva su comportamiento habitual.
    if (!file) return
    e.preventDefault()
    void handleFileChange(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onImageChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      ref={uploadRef}
      role="group"
      aria-label="Cargador de imagen"
      aria-describedby={pasteHintId}
      tabIndex={0}
      onPaste={handlePaste}
      onPointerDown={() => uploadRef.current?.focus({ preventScroll: true })}
      className="space-y-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-within:ring-2 focus-within:ring-primary/30"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      {preview ? (
        <Card className="relative overflow-hidden">
          <div className={`${square ? 'aspect-square' : 'aspect-video'} w-full bg-muted`}>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Cambiar imagen"
              className="h-8 w-8 rounded-full shadow-lg"
              onClick={handleClick}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              aria-label="Quitar imagen"
              className="h-8 w-8 rounded-full shadow-lg"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card
          className={`border-2 border-dashed transition-all cursor-pointer ${square ? 'aspect-square' : ''} ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className={`flex flex-col items-center justify-center text-center px-3 ${compact ? 'h-full py-2' : square ? 'h-full py-4' : 'py-12'}`}>
            <div className={`rounded-full bg-primary/10 ${compact ? 'p-2 mb-2' : square ? 'p-3 mb-3' : 'p-4 mb-4'}`}>
              <ImageIcon className={square ? 'h-6 w-6 text-primary' : 'h-8 w-8 text-primary'} />
            </div>
            <p className={`font-medium mb-1 ${square ? 'text-xs' : 'text-sm'}`}>
              {compact ? 'Subir foto' : 'Tocá o arrastrá una imagen acá'}
            </p>
            {!compact && <p className="text-xs text-muted-foreground text-center">
              JPG, PNG o WebP (máx. {maxSize}MB)
            </p>}
          </div>
        </Card>
      )}

      <button
        type="button"
        id={pasteHintId}
        onClick={() => uploadRef.current?.focus({ preventScroll: true })}
        className="block w-full rounded-lg px-1 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {compact ? 'Pegar: Ctrl + V' : 'Seleccioná este recuadro y pegá con Ctrl + V'}
      </button>

      {!compact && <div className={`text-xs text-muted-foreground ${square ? 'flex flex-col items-center text-center gap-0.5' : 'flex items-center justify-between'}`}>
        <span>Formatos: JPG, PNG, WebP</span>
        <span>Tamaño máximo: {maxSize}MB</span>
      </div>}
    </div>
  )
}

export default ImageUpload

