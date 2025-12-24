# Guía de Subida de Productos con Imágenes

## Implementación Completada ✅

Se ha implementado la funcionalidad completa de crear y editar productos con subida de imágenes a Cloudflare R2.

## Características Implementadas

### 1. **Componente ImageUpload** (`src/components/ImageUpload.tsx`)

Componente reutilizable y visualmente atractivo para subir imágenes:

**Características:**
- ✅ Drag & Drop de imágenes
- ✅ Click para seleccionar archivo
- ✅ Preview en tiempo real
- ✅ Validación de formato (JPG, PNG, WebP)
- ✅ Validación de tamaño (máx. 5MB)
- ✅ Conversión automática a Base64
- ✅ Botones para cambiar o eliminar imagen
- ✅ Diseño responsive y moderno
- ✅ Mensajes de error descriptivos

**Props:**
```typescript
interface ImageUploadProps {
  onImageChange: (base64: string | null) => void  // Callback con imagen en base64
  currentImage?: string | null                    // URL o base64 de imagen actual
  maxSize?: number                                // Tamaño máximo en MB (default: 5)
}
```

### 2. **Página de Productos Actualizada** (`src/pages/Productos.tsx`)

**Funcionalidades:**
- ✅ Crear producto con imagen
- ✅ Editar producto y actualizar imagen
- ✅ Preview de imagen actual al editar
- ✅ Validaciones completas del formulario
- ✅ Estados de carga durante envío
- ✅ Notificaciones de éxito/error
- ✅ Actualización automática de la lista

### 3. **API Actualizada** (`src/lib/api.ts`)

Endpoints correctos para productos:
- `POST /api/producto/create` - Crear producto
- `PUT /api/producto/update` - Actualizar producto
- `DELETE /api/producto/delete/:id` - Eliminar producto

**Formato de datos:**
```typescript
// Crear producto
{
  nombre: string,
  descripcion: string,
  precio: number,
  image?: string  // Base64 completo: "data:image/jpeg;base64,..."
}

// Actualizar producto
{
  id: number,
  nombre?: string,
  descripcion?: string,
  precio?: number,
  image?: string  // Base64 completo
}
```

## Flujo de Subida de Imagen

### 1. **Usuario selecciona imagen**
- Desde explorador de archivos
- O arrastrando y soltando

### 2. **Validación Frontend**
```
┌─────────────────────────┐
│ Validar formato         │
│ (JPG, PNG, WebP)        │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│ Validar tamaño          │
│ (máx. 5MB)              │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│ Convertir a Base64      │
│ con prefijo data:image  │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│ Mostrar Preview         │
└─────────────────────────┘
```

### 3. **Envío al Backend**
```
Frontend (Base64) → Backend (Validación) → Cloudflare R2 → URL Pública
```

### 4. **Backend procesa imagen** (`Backend/src/routes/producto.ts`)
1. Recibe string base64 completo
2. Extrae MIME type y datos
3. Valida formato y tamaño nuevamente
4. Genera UUID único para nombre de archivo
5. Sube a Cloudflare R2
6. Retorna URL pública
7. Guarda URL en base de datos

### 5. **Mostrar en frontend**
- La URL pública se guarda en el producto
- Se muestra directamente desde Cloudflare R2
- Carga rápida gracias a CDN global

## Uso del Componente ImageUpload

### Ejemplo básico:

```tsx
import ImageUpload from '@/components/ImageUpload'
import { useState } from 'react'

function MiFormulario() {
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  return (
    <form>
      <ImageUpload 
        onImageChange={setImageBase64}
        currentImage={imageBase64}
        maxSize={5}
      />
      
      <button onClick={() => {
        // imageBase64 contiene la imagen en formato:
        // "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
        console.log(imageBase64)
      }}>
        Enviar
      </button>
    </form>
  )
}
```

### Con imagen existente:

```tsx
<ImageUpload 
  onImageChange={setImageBase64}
  currentImage={producto.imagenUrl} // URL de R2
  maxSize={5}
/>
```

## Validaciones Implementadas

### Frontend (ImageUpload.tsx):
- ✅ Formatos permitidos: JPG, JPEG, PNG, WebP
- ✅ Tamaño máximo: 5MB
- ✅ Mensajes de error descriptivos con Sonner

### Backend (producto.ts):
- ✅ Verificación de formato base64
- ✅ Validación de MIME type
- ✅ Validación de tamaño del buffer
- ✅ Manejo de errores en subida a R2

## Estados del Formulario

### Crear Producto:
```
1. Usuario abre modal
2. Formulario vacío + ImageUpload vacío
3. Usuario completa datos y sube imagen (opcional)
4. Click en "Crear Producto"
5. Validación → Conversión → Envío → R2 Upload
6. Success → Refresca lista → Cierra modal
```

### Editar Producto:
```
1. Usuario hace click en "Editar"
2. Formulario pre-llenado + Preview de imagen actual
3. Usuario puede cambiar datos y/o imagen
4. Click en "Guardar Cambios"
5. Solo envía imagen si cambió (detecta formato base64)
6. Success → Refresca lista → Cierra modal
```

## Diseño UI/UX

### Características de diseño:
- 📱 **Responsive**: Funciona en móvil y desktop
- 🎨 **Visual**: Preview grande y claro
- 🖱️ **Intuitivo**: Drag & drop + click
- 🎯 **Feedback**: Indicadores de estado claros
- ⚡ **Rápido**: Conversión instantánea a base64
- ✨ **Moderno**: Animaciones suaves y transiciones
- 🔔 **Informativo**: Toasts para cada acción

### Estados visuales:
1. **Vacío**: Card con icono de imagen y texto instructivo
2. **Hover**: Borde cambia a color primario
3. **Dragging**: Fondo con tinte primario
4. **Con imagen**: Preview + botones de cambiar/eliminar
5. **Cargando**: Spinner en botón de submit

## Mejoras Futuras Posibles

- [ ] Recorte de imagen antes de subir
- [ ] Múltiples imágenes por producto
- [ ] Compresión de imagen antes de enviar
- [ ] Progreso de subida con barra
- [ ] Previsualización de diferentes tamaños
- [ ] Editor de imagen integrado

## Notas Técnicas

### ¿Por qué Base64?
- Simple integración con JSON
- No requiere multipart/form-data
- Backend puede validar antes de procesar
- Fácil de debuggear

### Tamaño de Base64:
- Base64 es ~33% más grande que el archivo original
- Una imagen de 3MB → ~4MB en base64
- Por eso validamos antes de convertir

### Cloudflare R2:
- Compatible con API de S3
- Sin costos de egreso
- CDN global incluido
- URLs públicas permanentes

## Testing

Para probar la funcionalidad:

1. **Crear producto sin imagen:**
   - Llenar nombre, descripción, precio
   - No subir imagen
   - Verificar que se crea correctamente

2. **Crear producto con imagen:**
   - Llenar todos los campos
   - Arrastrar una imagen JPG
   - Verificar preview
   - Crear y verificar en lista

3. **Editar imagen de producto:**
   - Editar un producto existente
   - Ver preview de imagen actual
   - Cambiar por otra imagen
   - Guardar y verificar

4. **Validaciones:**
   - Intentar subir archivo > 5MB (debe fallar)
   - Intentar subir PDF o archivo no imagen (debe fallar)
   - Verificar mensajes de error

## Solución de Problemas

### La imagen no se sube:
- Verificar que el backend está corriendo
- Verificar variables de entorno de R2 en backend
- Revisar console del navegador para errores

### Error de formato:
- Asegurarse que la imagen es JPG, PNG o WebP
- Verificar que el tamaño es < 5MB

### La imagen no se muestra:
- Verificar que la URL de R2 es pública
- Verificar que R2_PUBLIC_URL está configurado correctamente
- Revisar CORS en R2 bucket

### Performance lento:
- Considerar comprimir imágenes grandes antes de subir
- El límite de 5MB es razonable para la mayoría de casos

