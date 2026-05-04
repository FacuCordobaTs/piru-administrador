# Guía de Mesas con WebSocket en Tiempo Real

## Implementación Completada ✅

Se ha implementado la funcionalidad completa de gestión de mesas con conexión WebSocket en tiempo real.

## Características Implementadas

### 1. **Crear Mesa** (`src/pages/Mesas.tsx`)

**Funcionalidad:**
- ✅ Formulario para crear nueva mesa
- ✅ Validación de nombre (mínimo 3 caracteres)
- ✅ Generación automática de QR Token único (UUID)
- ✅ Actualización automática de la lista
- ✅ Estados de carga durante creación
- ✅ Notificaciones de éxito/error

**Flujo:**
```
Usuario click "Nueva Mesa"
  ↓
Modal con formulario
  ↓
Ingresa nombre
  ↓
POST /api/mesa/create
  ↓
Backend genera UUID único
  ↓
Mesa creada en DB
  ↓
Frontend actualiza lista
```

### 2. **Componente QR Code** (`src/components/MesaQRCode.tsx`)

**Características:**
- ✅ Genera QR code con link a `https://my.piru.app/mesa/{qrToken}`
- ✅ Preview grande y claro del QR
- ✅ Copiar link al portapapeles
- ✅ Descargar QR como imagen PNG
- ✅ Abrir link en nueva pestaña
- ✅ QR con nombre de mesa incluido en descarga
- ✅ Diseño responsive y moderno

**Formato del Link:**
```
https://my.piru.app/mesa/550e8400-e29b-41d4-a716-446655440000
```

### 3. **Hook WebSocket** (`src/hooks/useMesaWebSocket.ts`)

**Funcionalidad:**
- ✅ Conexión automática al WebSocket del backend
- ✅ Reconexión automática si se pierde conexión
- ✅ Manejo de todos los eventos del servidor
- ✅ Estado en tiempo real de la mesa
- ✅ Cleanup automático al desmontar

**Eventos Manejados:**
```typescript
- ESTADO_INICIAL: Estado completo de la mesa
- CLIENTE_UNIDO: Nuevo cliente conectado
- CLIENTE_DESCONECTADO: Cliente desconectado
- ITEM_AGREGADO: Item agregado al pedido
- ITEM_ELIMINADO: Item eliminado del pedido
- CANTIDAD_ACTUALIZADA: Cantidad de item actualizada
- PEDIDO_CONFIRMADO: Pedido confirmado por cliente
- ERROR: Error del servidor
```

**Estado Retornado:**
```typescript
{
  state: {
    mesaId: number
    pedidoId: number
    clientes: Cliente[]
    items: ItemPedido[]
    total: string
    estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  },
  isConnected: boolean,
  error: string | null
}
```

### 4. **Página de Mesas Actualizada**

**Características:**
- ✅ Listado de todas las mesas
- ✅ Botón "Ver QR" para cada mesa
- ✅ Botón "Detalles" con info en tiempo real
- ✅ Indicador de conexión WebSocket
- ✅ Estado del pedido actual
- ✅ Número de clientes conectados
- ✅ Total del pedido en tiempo real
- ✅ Items en el pedido
- ✅ Estado vacío con CTA

## Arquitectura WebSocket

### Conexión:
```
Admin Panel → WebSocket → Backend → Mesa específica
     ↓
Recibe actualizaciones en tiempo real
```

### Flujo de Datos:
```
Cliente escanea QR
  ↓
Se conecta al WebSocket
  ↓
Backend notifica al admin
  ↓
Admin ve cliente conectado
  ↓
Cliente agrega items
  ↓
Admin ve items en tiempo real
  ↓
Cliente confirma pedido
  ↓
Admin recibe notificación
```

## Uso del Hook WebSocket

### Ejemplo básico:

```tsx
import { useMesaWebSocket } from '@/hooks/useMesaWebSocket'

function MesaDetails({ qrToken }) {
  const { state, isConnected, error } = useMesaWebSocket(qrToken)

  if (!isConnected) {
    return <div>Conectando...</div>
  }

  return (
    <div>
      <h2>Mesa en tiempo real</h2>
      <p>Clientes: {state?.clientes.length}</p>
      <p>Items: {state?.items.length}</p>
      <p>Total: ${state?.total}</p>
    </div>
  )
}
```

### Con reconexión automática:

El hook maneja automáticamente:
- Reconexión cada 3 segundos si se pierde conexión
- Cleanup al desmontar el componente
- Manejo de errores

## Componente MesaQRCode

### Uso:

```tsx
import MesaQRCode from '@/components/MesaQRCode'

function MesaDialog({ mesa }) {
  return (
    <Dialog>
      <MesaQRCode 
        qrToken={mesa.qrToken}
        mesaNombre={mesa.nombre}
      />
    </Dialog>
  )
}
```

### Funcionalidades:

1. **Copiar Link:**
   - Click en botón de copiar
   - Link copiado al portapapeles
   - Toast de confirmación

2. **Descargar QR:**
   - Click en "Descargar QR"
   - Genera imagen PNG con:
     - QR code
     - Nombre de la mesa
     - Padding blanco
   - Descarga automática

3. **Abrir Link:**
   - Click en "Abrir Link"
   - Abre en nueva pestaña
   - Para probar el flujo del cliente

## Variables de Entorno

### `.env` en admin:
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### Producción:
```env
VITE_API_URL=https://api.piru.app/api
VITE_WS_URL=wss://api.piru.app
```

## Backend Endpoints

### Crear Mesa:
```
POST /api/mesa/create
Authorization: Bearer {token}
Body: { nombre: string }

Response: {
  success: true,
  message: "Mesa creada correctamente",
  data: { insertId, ... }
}
```

### Listar Mesas:
```
GET /api/mesa/list
Authorization: Bearer {token}

Response: {
  success: true,
  data: Mesa[]
}
```

### WebSocket:
```
WS /ws/{qrToken}

Eventos enviados al conectar:
- ESTADO_INICIAL: Estado completo

Eventos recibidos en tiempo real:
- CLIENTE_UNIDO
- ITEM_AGREGADO
- CANTIDAD_ACTUALIZADA
- etc.
```

## Flujo Completo de Uso

### 1. Crear Mesa:
```
Admin → Click "Nueva Mesa"
     → Ingresa nombre
     → Mesa creada con UUID único
     → Aparece en lista
```

### 2. Ver QR:
```
Admin → Click "Ver QR" en mesa
     → Modal con QR grande
     → Puede copiar link
     → Puede descargar QR
     → Puede abrir link
```

### 3. Cliente Escanea QR:
```
Cliente → Escanea QR
       → Redirigido a https://my.piru.app/mesa/{token}
       → Se conecta al WebSocket
       → Admin ve cliente conectado
```

### 4. Monitoreo en Tiempo Real:
```
Admin → Click "Detalles" en mesa
     → Ve indicador de conexión
     → Ve clientes conectados
     → Ve items del pedido
     → Ve total actualizado
     → Todo en tiempo real
```

## Indicadores Visuales

### Estado de Conexión:
- 🟢 **Conectado**: Badge verde con icono Wifi
- 🔴 **Desconectado**: Badge gris con icono WifiOff

### Estado del Pedido:
- 🟡 **Pendiente**: Badge secondary
- 🔵 **Preparando**: Badge default
- 🟢 **Entregado**: Badge outline
- ⚫ **Cerrado**: Badge secondary

### Información en Tiempo Real:
- Número de clientes conectados
- Cantidad de items en pedido
- Total del pedido (actualizado en tiempo real)
- Estado del pedido

## Mejoras Futuras Posibles

- [ ] Eliminar mesa (con confirmación)
- [ ] Editar nombre de mesa
- [ ] Ver historial de pedidos de una mesa
- [ ] Notificaciones push cuando cliente se conecta
- [ ] Sonido de alerta para nuevos pedidos
- [ ] Vista de cocina con pedidos en preparación
- [ ] Estadísticas por mesa
- [ ] Cambiar estado del pedido desde admin
- [ ] Chat en tiempo real con clientes

## Testing

### Crear Mesa:
1. Click en "Nueva Mesa"
2. Ingresar nombre: "Mesa 1"
3. Click en "Crear Mesa"
4. Verificar que aparece en la lista

### Ver QR:
1. Click en "Ver QR" de una mesa
2. Verificar que se muestra QR grande
3. Click en "Copiar Link" → verificar toast
4. Click en "Descargar QR" → verificar descarga
5. Click en "Abrir Link" → verificar nueva pestaña

### WebSocket:
1. Abrir detalles de una mesa
2. Verificar indicador "Conectado"
3. En otra pestaña, abrir el link de la mesa
4. Verificar que en admin se actualiza el contador de clientes
5. Agregar items desde cliente
6. Verificar que admin ve items en tiempo real

## Solución de Problemas

### WebSocket no conecta:
- Verificar que backend está corriendo
- Verificar VITE_WS_URL en .env
- Revisar console del navegador
- Verificar que el qrToken es válido

### QR no se genera:
- Verificar que qrcode.react está instalado
- Revisar console para errores
- Verificar que el qrToken existe

### Mesa no se crea:
- Verificar que hay sesión activa
- Verificar que el nombre tiene mínimo 3 caracteres
- Revisar response del backend
- Verificar token de autenticación

## Notas Técnicas

### UUID para QR Token:
- Se genera en backend con `uuid-js`
- Es único y no se repite
- Formato: `550e8400-e29b-41d4-a716-446655440000`

### WebSocket Reconnection:
- Reconecta automáticamente cada 3 segundos
- No requiere intervención manual
- Mantiene el estado entre reconexiones

### QR Code Level:
- Usamos nivel "H" (High)
- 30% de corrección de errores
- Permite escanear incluso con daños

### Performance:
- WebSocket es muy eficiente
- Actualizaciones instantáneas
- Sin polling innecesario
- Bajo uso de recursos

