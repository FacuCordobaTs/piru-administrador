import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Armchair,
  Banknote,
  Bike,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  LayoutDashboard,
  Link2,
  MessageCircle,
  MessageSquare,
  MonitorSmartphone,
  Package,
  Printer,
  RefreshCw,
  Repeat2,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GUIA_MARKETING, type ContextoGuia } from '@/lib/guia'
import { ViajePedido } from './escenas/ViajePedido'
import { ListaPedidos } from './escenas/ListaPedidos'
import { PedidoWhatsapp } from './escenas/PedidoWhatsapp'
import { PosAnotar } from './escenas/PosAnotar'
import { SinConexion } from './escenas/SinConexion'
import { CobroQr } from './escenas/CobroQr'
import { MesasMozo } from './escenas/MesasMozo'
import { ComandaTicket } from './escenas/ComandaTicket'
import { ZonasEnvio } from './escenas/ZonasEnvio'
import { CajaTurno } from './escenas/CajaTurno'
import { ProductoOpciones } from './escenas/ProductoOpciones'
import { Clave, Donde, Figura, Nota, Pasos } from './piezas'

/** Con sesión, "Dónde está" lleva directo a la pantalla del panel. */
const ruta = (c: ContextoGuia, destino: string) => (c.conSesion ? destino : null)

function Tarjetas({ children, columnas = 2 }: { children: ReactNode; columnas?: 2 | 3 }) {
  return (
    <div className={cn('grid gap-3', columnas === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')}>
      {children}
    </div>
  )
}

function Tarjeta({
  icono: Icono,
  titulo,
  children,
  tono = 'neutro',
}: {
  icono?: LucideIcon
  titulo: ReactNode
  children: ReactNode
  tono?: 'neutro' | 'si' | 'no'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 ring-1',
        tono === 'si'
          ? 'bg-emerald-50/70 ring-emerald-600/15'
          : tono === 'no'
            ? 'bg-rose-50/60 ring-rose-600/10'
            : 'bg-white ring-line',
      )}
    >
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {Icono && (
          <Icono
            size={17}
            className={cn(
              'shrink-0',
              tono === 'si' ? 'text-emerald-700' : tono === 'no' ? 'text-rose-700' : 'text-brand-deep',
            )}
          />
        )}
        {titulo}
      </p>
      <div className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  )
}

/** Un link a otra sección de la guía, en el medio del texto. */
function Ancla({ a, children }: { a: string; children: ReactNode }) {
  return (
    <a className="underline decoration-ink-3/40 underline-offset-[3px] hover:decoration-ink-3" href={`#${a}`}>
      {children}
    </a>
  )
}

function Circuito() {
  return (
    <>
      <p>
        Piru junta en una sola pantalla todo lo que vende tu local: los pedidos de tu tienda online, los que
        anotás en el mostrador o por teléfono y los de las mesas. Todos siguen el mismo camino, de la tienda a
        la cocina y de la cocina al cliente.
      </p>
      <Figura pie="Ejemplo: el pedido #1284 de Martina, desde el link de la tienda hasta que sale para su casa.">
        <ViajePedido />
      </Figura>
      <Pasos
        items={[
          { icono: Store, titulo: 'Tienda', texto: 'Tu cliente abre tu link, arma el pedido y elige cómo pagar. No descarga nada ni crea un usuario.' },
          { icono: MessageCircle, titulo: 'WhatsApp', texto: 'El pedido te llega escrito a tu WhatsApp de siempre, en el chat con ese cliente.' },
          { icono: LayoutDashboard, titulo: 'Panel', texto: 'Al mismo tiempo entra en Inicio, con la comanda, los datos del cliente y cómo pagó.' },
          { icono: Printer, titulo: 'Cocina', texto: 'Con la app de Piru para Windows y una impresora térmica, la comanda sale sola.' },
          { icono: Bike, titulo: 'Despacho', texto: 'Cuando sale, lo despachás: pasa al historial y queda en la caja del día.' },
        ]}
      />
      <Clave>
        <li>
          Lo del mostrador, el teléfono y las mesas va por el mismo camino: lo anotás en el{' '}
          <strong>punto de venta</strong> y aparece en la misma lista.
        </li>
        <li>Te pagan directo a vos: la plata va a tu cuenta y Piru no se queda con un porcentaje.</li>
        <li>
          Cada pedido deja al cliente en tu base, con lo que pide y cada cuánto. Es lo que usa Clientes para
          que vuelva.
        </li>
      </Clave>
    </>
  )
}

const PANTALLAS: { Icono: LucideIcon; nombre: string; destino: string; texto: string; etiqueta?: string }[] = [
  { Icono: LayoutDashboard, nombre: 'Inicio', destino: '/dashboard', texto: 'Los pedidos del día, el punto de venta, las mesas, el mapa y la caja.' },
  { Icono: Package, nombre: 'Menú', destino: '/dashboard/productos', texto: 'Productos, categorías, variantes, extras y precios.' },
  { Icono: Users, nombre: 'Clientes', destino: '/dashboard/clientes', texto: 'Abre la app de marketing: tu base, campañas, cupones, puntos y recompra.' },
  { Icono: MessageSquare, nombre: 'Mensajes', destino: '/dashboard/mensajes', texto: 'Tus avisos por WhatsApp: cuántos mandaste, tu saldo y las recargas.', etiqueta: 'Según tus módulos' },
  { Icono: TrendingUp, nombre: 'Estadísticas', destino: '/dashboard/metricas', texto: 'Lo que vendiste por mes o entre dos fechas, cómo te pagaron y lo más pedido.' },
  { Icono: Settings, nombre: 'Configuración', destino: '/dashboard/ajustes', texto: 'Tu negocio, tu tienda, entregas, horarios, pagos, WhatsApp, módulos y suscripción.' },
]

function Panel({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>El menú de la izquierda lleva a cada pantalla. En el celular se abre con el botón de arriba.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PANTALLAS.map((p) => {
          const destino = ruta(c, p.destino)
          const contenido = (
            <>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                <p.Icono size={18} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                  {p.nombre}
                  {p.etiqueta && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                      {p.etiqueta}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{p.texto}</span>
              </span>
            </>
          )
          const clase = 'flex h-full items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line'
          return (
            <li key={p.nombre}>
              {destino ? (
                <Link to={destino} className={cn(clase, 'hover:ring-ink-3/40')}>
                  {contenido}
                </Link>
              ) : (
                <div className={clase}>{contenido}</div>
              )}
            </li>
          )
        })}
      </ul>
      <h3>Configuración, por dentro</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Operación</strong>: WhatsApp, Entregas y zonas, Horarios y Ventas en el local. Con Punto de
          venta y Mesas activos suma Mozos y, en la app de escritorio, Impresión.
        </li>
        <li>
          <strong>Tu negocio</strong>: General (tus datos, tu link, colores y logos), Métodos de pago, Tu
          marketer, Mis módulos, Suscripción y pagos, y Cuenta.
        </li>
      </ul>
      <Nota icono={MonitorSmartphone}>
        El panel funciona en la compu, la tablet y el celular. Para que las comandas se impriman solas hace
        falta la app de Piru para Windows (o la de Android) con una impresora térmica. Esta guía está en el
        menú, arriba de Configuración.
      </Nota>
    </>
  )
}

function Pedidos({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Inicio es la pantalla del servicio. A la izquierda, los pedidos activos; a la derecha, el que tocás,
        para leerlo como una comanda.
      </p>
      <Figura pie="Ejemplo: entra el #1284 de Martina, lo abrís, ves su comanda y lo despachás.">
        <ListaPedidos />
      </Figura>
      <h3>La lista</h3>
      <p>
        Cada tarjeta dice el número, si es delivery, takeaway o mesa, el total, el cliente y hace cuánto entró.
        Además puede llevar:
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Cómo pagó</strong>: Mercado Pago, transferencia o efectivo. <strong>Pendiente</strong> quiere
          decir que todavía no está cobrado.
        </li>
        <li>
          <strong>Una hora</strong>: es un pedido programado para esa franja.
        </li>
        <li>
          <strong>Manual</strong>: lo anotaste en el punto de venta.
        </li>
        <li>
          <strong>IA</strong>: lo tomó el asistente de WhatsApp.
        </li>
      </ul>
      <p>
        Arriba está el día que estás mirando: tocalo para ver otro. Los pedidos despachados bajan a{' '}
        <strong>Historial</strong>, al final de la lista.
      </p>
      <h3>El detalle</h3>
      <p>
        Muestra quién es y dónde está, cómo pagó, la nota del cliente y la comanda, con cada variante, extra o
        ingrediente quitado. Debajo del nombre, una línea con su historia en tu local:{' '}
        <strong>7º pedido de Martina · $86.400 histórico · última vez hace 12 días</strong>, o{' '}
        <strong>Primer pedido</strong> si es nuevo. Si llegó por una campaña, también lo dice.
      </p>
      <h3>Despachar</h3>
      <p>
        Cuando el pedido sale, tocá <strong>Despachar</strong>: el camión de la tarjeta o el botón del detalle.
        Deja la lista de activos y pasa al historial. Si es una mesa, elegís si además imprimir su comanda
        completa; si tenés más de un repartidor, te pregunta quién lo lleva.
      </p>
      <Clave>
        <li>Despachar no borra nada: el pedido sigue en Historial y en Caja.</li>
        <li>
          <strong>Eliminar</strong>, el tacho del detalle, sí lo borra para siempre. Usalo sólo para pruebas o
          errores.
        </li>
        <li>
          Con el punto de venta activo, <strong>Editar pedido</strong> te deja cambiar los productos o los datos
          de un pedido que ya entró. Algunos, como los facturados, no se pueden editar.
        </li>
      </Clave>
      <p>
        <Donde texto="Inicio" icono={LayoutDashboard} ruta={ruta(c, '/dashboard')} />
      </p>
    </>
  )
}

function PuntoDeVenta({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Para lo que entra por el mostrador o por teléfono: buscás, tocás y queda anotado. Es un pedido como
        cualquier otro: aparece en la lista, imprime su comanda y suma en la caja.
      </p>
      <Figura pie="Ejemplo: un takeaway en el mostrador, en efectivo. Al anotarlo entra en la lista con la etiqueta Manual.">
        <PosAnotar />
      </Figura>
      <Pasos
        items={[
          { titulo: 'Nuevo pedido', texto: 'En Inicio, «+ Nuevo pedido». En la compu, la comanda queda abierta a la derecha.' },
          { titulo: 'Productos', texto: 'Buscalos por nombre y tocalos. Si tienen variantes o extras, elegís en el momento. Tocá uno de la comanda para cambiarlo.' },
          { titulo: 'Tipo y cliente', texto: 'Delivery o takeaway, y los datos del cliente: al escribir el nombre o el celular te sugiere los que ya pidieron. Con delivery, la dirección y el envío.' },
          { titulo: 'Cómo paga', texto: 'Efectivo, tarjeta, transferencia o Mercado Pago.' },
          { titulo: 'Anotar pedido', texto: 'Queda cobrado con ese medio, entra en la lista y sale la comanda.' },
        ]}
      />
      <h3>En el celular y la tablet</h3>
      <p>
        El punto de venta ocupa toda la pantalla. En el celular, el pedido se arma en una hoja que sube desde
        abajo; en la tablet, catálogo y pedido van lado a lado y se completa en dos pasos: «Siguiente» y
        «Anotar pedido». Si salís a ver los pedidos, el borrador te espera: «Seguir pedido» lo retoma.
      </p>
      <h3>Configurar el punto de venta</h3>
      <p>
        Desde el menú de la comanda (los tres puntos) elegís, para ese dispositivo: qué tipos de pedido y medios
        de pago ofrecer, qué datos del cliente pedir, si querés nota, si mostrar el catálogo en una columna
        aparte y si imprimir cada comanda dos veces.
      </p>
      <Clave>
        <li>
          Esa configuración se guarda en cada dispositivo: la compu de la caja y la tablet del salón pueden tener
          la suya.
        </li>
        <li>Con un solo medio de pago activo no aparece el selector: se anota con ese.</li>
        <li>El costo de envío se completa solo con el que cargaste en Configuración → General.</li>
        <li>
          Un pedido ya anotado se corrige con <strong>Editar pedido</strong>, desde su detalle.
        </li>
      </Clave>
      <p>
        <Donde texto="Inicio" icono={LayoutDashboard} ruta={ruta(c, '/dashboard')} />
      </p>
    </>
  )
}

function Mesas({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Con Punto de venta y Mesas activos, Inicio suma la pestaña <strong>Mesas</strong>: el salón de un
        vistazo, con las libres en verde y las ocupadas en naranja, con su cliente y su total.
      </p>
      <Figura pie="Ejemplo: el mozo suma unas papas a la Mesa 4 desde su celular. En la cocina sale sólo lo nuevo.">
        <MesasMozo />
      </Figura>
      <h3>Armá tu salón</h3>
      <p>
        En el plano de mesas (Configuración → Ventas en el local → Mesas → Configurar) agregás cada mesa, la
        ubicás como está en tu local y le ponés nombre, capacidad y sucursal.
      </p>
      <h3>Atender una mesa</h3>
      <Pasos
        items={[
          { titulo: 'Abrí la mesa', texto: 'Tocá una mesa libre: se abre el punto de venta con esa mesa. El primer producto la abre.' },
          { titulo: 'Se guarda sola', texto: 'Cada cambio se guarda solo («Guardado»). Guardar no imprime nada.' },
          {
            titulo: 'Mandá a cocina',
            texto: '«Imprimir productos nuevos» saca sólo lo que sumaste desde la última comanda; «Reimprimir comanda entera», todo.',
          },
          {
            titulo: 'Despachá la mesa',
            texto: 'Al irse, «Despachar mesa»: elegís sólo despachar o despachar e imprimir la comanda completa. La mesa queda libre.',
          },
        ]}
      />
      <h3>La app de mozos</h3>
      <p>
        Cada mozo toma los pedidos desde su celular. Les creás el acceso en Configuración → Mozos: Piru le
        asigna a cada uno un número dentro de tu local y, si querés, lo limitás a una sucursal.
      </p>
      <Pasos
        items={[
          {
            icono: Smartphone,
            titulo: 'Entra',
            texto: 'En la app de mozos pone el WhatsApp del local y su número de mozo. Le llega un código de 6 dígitos al WhatsApp del local: se lo pasás vos o el encargado.',
          },
          {
            icono: Armchair,
            titulo: 'Toma el pedido',
            texto: 'Elige la mesa y suma productos. Quedan «Por confirmar» hasta que toca «Confirmar pedido».',
          },
          {
            icono: Printer,
            titulo: 'Sale en cocina',
            texto: 'La compu del local imprime sólo los productos nuevos de esa mesa, en una sola comanda.',
          },
        ]}
      />
      <Clave>
        <li>
          El celular del mozo no imprime: imprime la compu del local, que tiene que estar con la app de Piru
          abierta.
        </li>
        <li>Borrar un producto o cambiar una nota no imprime nada.</li>
        <li>La app de mozos necesita los módulos Punto de venta y Mesas activos.</li>
      </Clave>
      <p className="flex flex-wrap gap-2">
        <Donde texto="Plano de mesas" icono={Armchair} ruta={ruta(c, '/dashboard/mesas')} />
        <Donde texto="Mozos" icono={Users} ruta={ruta(c, '/dashboard/ajustes/mozos')} />
      </p>
    </>
  )
}

function Comandas({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Con la app de Piru para Windows (o la de Android) y una impresora térmica, cada pedido se imprime solo
        apenas entra. No hace falta tocar nada.
      </p>
      <Figura pie="Ejemplo: la comanda del #1284, con el extra y el ingrediente quitado bien a la vista.">
        <ComandaTicket />
      </Figura>
      <h3>Qué se imprime y cuándo</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Los pedidos nuevos</strong>, de la tienda y del punto de venta, apenas entran.
        </li>
        <li>
          <strong>Los que se pagan online</strong>, recién cuando el pago se acredita.
        </li>
        <li>
          <strong>Las mesas</strong>, cuando lo pedís (productos nuevos, comanda entera o al despachar) y cuando
          un mozo confirma productos: ahí sale sólo lo nuevo.
        </li>
        <li>
          <strong>Cada pedido, una sola vez</strong>, aunque tengas el panel abierto en varias compus.
        </li>
      </ul>
      <p>
        Si hace falta otra copia, abrí el pedido y tocá <strong>Reimprimir comprobante</strong>.
      </p>
      <h3>Configurar la impresora</h3>
      <p>
        En la app de escritorio, Configuración → Impresión: elegís la impresora y cómo está conectada —la de
        Windows, por puerto serie, por red o por Bluetooth; en Android, también por USB— y probás una comanda.
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Imprimir cada comanda dos veces</strong>, en la configuración del punto de venta: una copia
          para el cliente y otra para el local.
        </li>
        <li>
          <strong>Productos grandes en mayúsculas</strong>, en Configuración → General: agranda los productos,
          variantes, extras y notas.
        </li>
        <li>
          <strong>Bebidas destacadas</strong>: marcá en Menú las categorías de bebidas y salen más grandes y en
          negrita.
        </li>
      </ul>
      <Nota icono={MonitorSmartphone}>
        Desde el navegador el panel no puede imprimir solo: en Configuración → Impresión te ofrece descargar la
        app de escritorio. En Android, activá «Que Android no duerma la app» (Configuración → General) para que
        no se corte una impresión.
      </Nota>
      <p>
        <Donde texto="Impresión" icono={Printer} ruta={ruta(c, '/dashboard/ajustes/impresion')} />
      </p>
    </>
  )
}

function Delivery({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Para hacer delivery dibujás tus <strong>zonas de envío</strong> en el mapa, cada una con su costo. La
        tienda ubica la dirección del cliente, le cobra el envío de su zona y, si queda afuera, se lo avisa
        antes de pagar.
      </p>
      <Figura pie="Ejemplo: Av. Belgrano 1450 cae en la zona Centro y paga $1.200 de envío. Una dirección fuera de las zonas no puede pedir delivery.">
        <ZonasEnvio />
      </Figura>
      <ul className="guia-puntos">
        <li>
          <strong>Tipos de pedido</strong>: en Configuración → Entregas y zonas activás delivery, takeaway o los
          dos.
        </li>
        <li>
          <strong>Zonas</strong>: cada zona es un área del mapa con su precio de envío.
        </li>
        <li>
          <strong>Mapa de pedidos</strong>: en Inicio, «Mapa» muestra los pedidos activos con dirección.
        </li>
        <li>
          <strong>Envío del mostrador</strong>: el delivery que anotás en el punto de venta toma el costo de
          envío de Configuración → General.
        </li>
      </ul>
      <h3>Repartidores</h3>
      <p>
        Con <strong>Gestión de cadetes</strong> cargás a tus repartidores (Inicio → los tres puntos de la lista
        → Repartidores) y asignás quién lleva cada delivery desde su detalle. Si tenés más de uno activo, al
        despachar te pregunta «¿Quién hace el envío?». En Estadísticas, la pestaña Repartidores muestra los
        pedidos que entregó cada uno y lo recaudado en envíos.
      </p>
      <Clave>
        <li>Fuera de las zonas no se puede pedir delivery: el cliente puede elegir retirar en el local.</li>
        <li>Si cambia lo que cobrás de envío, cambialo en la zona: la tienda lo toma de ahí.</li>
        <li>¿Trabajás con Rapiboy? La integración se conecta desde Entregas y zonas.</li>
      </Clave>
      <p>
        <Donde texto="Entregas y zonas" icono={Truck} ruta={ruta(c, '/dashboard/ajustes/entregas')} />
      </p>
    </>
  )
}

function Caja({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        <strong>Caja</strong>, en Inicio, es el resumen del día: el total, cuánto entró en efectivo, por Mercado
        Pago y por transferencia, cuánto vino de la tienda y cuánto anotaste a mano, y los pedidos uno por uno.
      </p>
      <Figura pie="Ejemplo: la caja de un turno. Al cerrarlo, queda con su resumen y empieza uno nuevo.">
        <CajaTurno />
      </Figura>
      <ul className="guia-puntos">
        <li>
          <strong>Total y medios de pago</strong>: lo vendido, separado por cómo te pagaron.
        </li>
        <li>
          <strong>Pendientes de cobro</strong>: cuántos pedidos todavía no se cobraron.
        </li>
        <li>
          <strong>Por la web y anotados a mano</strong>: lo que entró por la tienda y lo del punto de venta.
        </li>
        <li>
          <strong>Por hora y pedido por pedido</strong>: cuándo se movió el local, con filtros por tipo y un
          buscador.
        </li>
      </ul>
      <p>Para ver otro día, elegilo desde la fecha de arriba.</p>
      <h3>Cerrar el turno a mano</h3>
      <p>
        Si tu turno cruza la medianoche o querés cortar la caja al terminar cada turno, activá{' '}
        <strong>Cerrar turno manualmente</strong> (Configuración → Ventas en el local). Inicio deja de mostrar
        días y muestra el <strong>Turno actual</strong>, desde que lo abriste.
      </p>
      <Pasos
        items={[
          { icono: Clock, titulo: 'Cerrar turno', texto: 'Al terminar, tocá «Cerrar turno» en Inicio.' },
          { icono: CalendarDays, titulo: 'Queda agrupado', texto: 'Los pedidos desde la apertura quedan en ese turno, con su caja.' },
          { icono: RefreshCw, titulo: 'Empieza otro', texto: 'Se abre un turno nuevo en el momento. Los anteriores se eligen desde el título.' },
        ]}
      />
      <Nota>
        Las mesas sin despachar quedan fuera del cierre: despachalas antes de cerrar el turno.
      </Nota>
      <p>
        <Donde texto="Inicio" icono={LayoutDashboard} ruta={ruta(c, '/dashboard')} />
      </p>
    </>
  )
}

function SinConexionSeccion() {
  return (
    <>
      <p>
        El punto de venta sigue andando sin internet. Los pedidos se guardan en ese dispositivo, la comanda se
        imprime igual y, cuando vuelve la conexión, se suben solos.
      </p>
      <Figura pie="Ejemplo: dos ventas sin internet quedan como LOCAL-1 y LOCAL-2; al volver la conexión se suben y toman su número.">
        <SinConexion />
      </Figura>
      <Pasos
        items={[
          {
            icono: Download,
            titulo: 'Antes: descargá los datos',
            texto: 'En la configuración del punto de venta, «Descargar todo (catálogo + clientes)». Así el dispositivo tiene una copia para vender sin internet.',
          },
          { icono: WifiOff, titulo: 'Se corta', texto: 'Arriba aparece «Modo sin conexión». Seguís anotando: cada pedido queda guardado en el dispositivo.' },
          {
            icono: Printer,
            titulo: 'La comanda sale igual',
            texto: 'Con el número LOCAL-1, LOCAL-2… y la marca SIN CONEXIÓN, para que en la cocina se distingan.',
          },
          {
            icono: RefreshCw,
            titulo: 'Vuelve internet',
            texto: 'Los pedidos guardados se suben solos y toman su número. Si tarda, «Reintentar sincronización».',
          },
        ]}
      />
      <Clave>
        <li>Cada pedido se sube una sola vez, aunque se reintente: no se duplica.</li>
        <li>
          Sin internet no entran los pedidos de la tienda ni se puede cobrar con el QR de Mercado Pago.
        </li>
        <li>Si cambiás productos o precios, volvé a descargar los datos.</li>
      </Clave>
    </>
  )
}

function CobroQrSeccion() {
  return (
    <>
      <p>
        Si querés que el punto de venta espere a que el cliente pague con Mercado Pago antes de dar el pedido
        por cobrado, activá <strong>Confirmar cobros manualmente</strong> en su configuración. Con Mercado Pago,
        «Anotar pedido» pasa a decir <strong>Cobrar</strong>: aparece el QR de tu caja con el total y el pedido
        queda cobrado cuando Mercado Pago confirma el pago.
      </p>
      <Figura pie="Ejemplo: un takeaway de $26.700. El cliente escanea el QR de la caja y, cuando Mercado Pago confirma, sale la comanda.">
        <CobroQr />
      </Figura>
      <Pasos
        items={[
          {
            titulo: 'Activá la opción',
            texto: 'En la configuración del punto de venta, «Confirmar cobros manualmente», con Mercado Pago entre los medios de pago.',
          },
          {
            titulo: 'Conectá Mercado Pago',
            texto: '«Conectar Mercado Pago» autoriza a Piru a cobrar con el QR de tu cuenta. Es una conexión aparte de la de los pagos de la tienda.',
          },
          {
            titulo: 'Elegí la caja',
            texto: 'Vinculá una caja con QR de tu cuenta de Mercado Pago o creá una nueva. Cada dispositivo cobra con la suya.',
          },
          {
            titulo: 'Cobrá',
            texto: '«Cobrar» muestra el QR con el total. Cuando el pago se acredita, el pedido queda cobrado y sale la comanda.',
          },
        ]}
      />
      <Clave>
        <li>
          La confirmación la da Mercado Pago, no el dispositivo: si se recarga la página en medio del cobro, el
          punto de venta lo retoma.
        </li>
        <li>Cancelar el cobro cancela el pedido sin pagar y te deja el borrador para intentar de nuevo.</li>
        <li>
          Sólo pasa por el QR un pedido nuevo de delivery o takeaway con Mercado Pago. Las mesas, las ediciones
          y los demás medios se anotan como siempre.
        </li>
        <li>Necesita internet.</li>
      </Clave>
    </>
  )
}

function Tienda({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Tu tienda es una página con tu logo, tus colores y tu carta, en tu link
        {c.tienda ? (
          <>
            : <strong>{c.tienda}</strong>
          </>
        ) : null}
        . Se abre desde el navegador de cualquier celular o compu. Para pedir, tu cliente pone su nombre y su
        celular: no descarga nada ni crea un usuario.
      </p>
      <Figura pie="Ejemplo: Martina confirma en la tienda, se le abre WhatsApp con el pedido escrito y te lo manda. En el panel ya está el #1284.">
        <PedidoWhatsapp />
      </Figura>
      <h3>Del carrito a tu WhatsApp</h3>
      <Pasos
        items={[
          {
            icono: ShoppingBag,
            titulo: 'Arma el pedido',
            texto: 'Elige productos, variantes y extras, y si es delivery o retiro. Con delivery, la tienda ubica la dirección en tus zonas y suma el envío.',
          },
          { icono: CreditCard, titulo: 'Elige cómo pagar', texto: 'Con los medios que activaste: Mercado Pago, transferencia o efectivo.' },
          {
            icono: MessageCircle,
            titulo: 'Te lo manda',
            texto: 'Al confirmar, se le abre WhatsApp con el pedido escrito para tu número. Lo envía y te queda en el chat con ese cliente.',
          },
          {
            icono: LayoutDashboard,
            titulo: 'Entra al panel',
            texto: 'El pedido ya está en Inicio. Si pagó online, aparece cuando el pago se acredita.',
          },
        ]}
      />
      <Nota>
        Con <strong>Avisos automáticos por WhatsApp</strong> la tienda no lo lleva a WhatsApp: tu cliente recibe
        los avisos desde tu cuenta oficial. Lo explica <Ancla a="whatsapp">WhatsApp y avisos</Ancla>.
      </Nota>
      <h3>Lo que tu cliente puede hacer</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Programar</strong> el pedido para una franja más tarde, si lo permitís en{' '}
          <Ancla a="horarios">Horarios</Ancla>.
        </li>
        <li>
          <strong>Pedir en grupo</strong>: cada uno elige desde su celular y te llega una sola comanda, separada
          por persona. Se activa en Configuración → General.
        </li>
        <li>
          <strong>Aprovechar una promo</strong>: si entra por un link de campaña con descuento, se aplica solo.
        </li>
      </ul>
      <h3>Tu link y tu marca</h3>
      <p>
        En Configuración → General cambiás el alias de tu link, los colores y los logos. ¿Querés usar tu propio
        dominio? Escribinos.
      </p>
      <Clave>
        <li>Cuando no tenés ningún pedido abierto, Inicio te muestra tu link para copiarlo.</li>
        <li>
          Ponelo en tu bio de Instagram, en tu estado de WhatsApp y en un QR en el mostrador: cuanto más se pide
          por tu link, menos dependés de las apps de delivery.
        </li>
      </Clave>
      <p>
        <Donde texto="General" icono={Store} ruta={ruta(c, '/dashboard/ajustes/general')} />
      </p>
    </>
  )
}

const FICHA_PRODUCTO = [
  { titulo: 'Categorías', texto: 'Agrupan la carta. Arrastralas para elegir en qué orden aparecen. Las de bebidas salen destacadas en la comanda.' },
  { titulo: 'Variantes', texto: 'Ponen el precio: Simple, Doble, Triple. Una segunda elección suma a ese precio, como carne o vegana.' },
  { titulo: 'Ingredientes', texto: 'Los que el cliente puede sacar: «Sin cebolla». Salen así en la comanda.' },
  { titulo: 'Extras', texto: 'Lo que se suma con precio, como «Extra cheddar». Los secundarios aparecen en un paso después.' },
  { titulo: 'Nota del cliente', texto: 'Una aclaración libre para ese producto, con la pregunta que quieras.' },
  { titulo: 'Descuento', texto: 'Un porcentaje, para siempre o entre dos fechas. «Descuentos masivos» lo aplica a varios productos juntos.' },
]

function Menu({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        En <strong>Menú</strong> cargás todo lo que vendés. Lo que cambiás acá es lo que ven tu tienda y tu
        punto de venta.
      </p>
      <Figura pie="Ejemplo: la Smash burger como la ve el cliente. La variante Doble pone el precio, sin cebolla y con extra cheddar: $15.000.">
        <ProductoOpciones />
      </Figura>
      <Tarjetas>
        {FICHA_PRODUCTO.map((f) => (
          <Tarjeta key={f.titulo} titulo={f.titulo}>
            {f.texto}
          </Tarjeta>
        ))}
      </Tarjetas>
      <h3>Pausar un producto</h3>
      <p>
        Si se te terminó algo, apagá <strong>Activo</strong> en su ficha: deja de ofrecerse hasta que lo vuelvas
        a prender, sin perder nada.
      </p>
      <h3>Otros datos del producto</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Foto y descripción</strong>: una buena foto vende más.
        </li>
        <li>
          <strong>Dónde se vende</strong>: en el catálogo de siempre o sólo en un evento (lo explica{' '}
          <Ancla a="sucursales">Sucursales y eventos</Ancla>).
        </li>
        <li>
          <strong>Puntos</strong>: con el club de puntos activo, cuántos puntos da y cuánto cuesta canjearlo.
        </li>
      </ul>
      <Clave>
        <li>
          Los extras y los ingredientes se crean una vez y se usan en varios productos: si cambiás el precio de
          un extra, cambia en todos.
        </li>
        <li>¿No querés cargar la carta desde cero? Mandanos la tuya y te la armamos.</li>
        <li>Si usás el punto de venta sin conexión, volvé a descargar los datos después de cambiar precios.</li>
      </Clave>
      <p>
        <Donde texto="Menú" icono={Package} ruta={ruta(c, '/dashboard/productos')} />
      </p>
    </>
  )
}

function Horarios({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        En Configuración → Horarios cargás cuándo abrís cada día, o «Cerrado». Fuera de horario la tienda no
        toma pedidos para ahora. Los cambios se guardan solos.
      </p>
      <h3>Pedidos programados</h3>
      <p>
        Con <strong>Permitir pedidos programados</strong>, el cliente elige una <strong>franja</strong> para
        recibir su pedido: Mañana, Tarde, Noche o las que armes. Piru te las puede proponer a partir de tus
        horarios, y cada una puede tener un <strong>cupo</strong>: cuántos pedidos pagados acepta por día.
      </p>
      <ul className="guia-puntos">
        <li>Aunque estés cerrado, tus clientes pueden dejar el pedido para más tarde.</li>
        <li>
          <strong>Solo pedidos programados</strong>: nadie puede pedir para ahora; todos eligen franja.
        </li>
        <li>
          En Inicio, un pedido programado lleva su hora en la lista y, en el detalle, «Programado para las
          21:30».
        </li>
      </ul>
      <p>
        <Donde texto="Horarios" icono={Clock} ruta={ruta(c, '/dashboard/ajustes/horarios')} />
      </p>
    </>
  )
}

function Pagos({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Tus clientes te pagan directo a vos: la plata va a tu cuenta y Piru no se queda con un porcentaje. En
        Configuración → Métodos de pago elegís qué medios ofrece tu tienda.
      </p>
      <Tarjetas>
        <Tarjeta icono={CreditCard} titulo="Mercado Pago">
          Con tu propia cuenta. Tu cliente paga con dinero en cuenta desde la app de Mercado Pago o con tarjeta
          sin salir de tu tienda. El pedido entra cobrado.
        </Tarjeta>
        <Tarjeta icono={Zap} titulo="Transferencia automática">
          Tu cliente transfiere y el pago se confirma solo, sin que tengas que mirar el banco. Funciona con Talo.
        </Tarjeta>
        <Tarjeta icono={Wallet} titulo="Transferencia manual">
          Mostrás tu alias y confirmás vos que llegó.
        </Tarjeta>
        <Tarjeta icono={Banknote} titulo="Efectivo">
          Paga al recibir o al retirar, y lo cobrás en caja.
        </Tarjeta>
      </Tarjetas>
      <p>
        Un pedido pagado online entra en Inicio recién cuando el pago se acredita: no ves pedidos a medio pagar.
        Uno en efectivo o con transferencia manual entra como <strong>Pendiente</strong> hasta que se cobra.
      </p>
      <Clave>
        <li>
          Mercado Pago se conecta una vez, con tu cuenta, desde Métodos de pago. El cobro con QR del mostrador
          es otra conexión: lo explica <Ancla a="cobro-qr">Cobrar con el QR de Mercado Pago</Ancla>.
        </li>
        <li>Cada sucursal puede tener su propio alias para transferencias.</li>
        <li>En el punto de venta elegís el medio en cada pedido: no depende de lo que ofrece la tienda.</li>
      </Clave>
      <p>
        <Donde texto="Métodos de pago" icono={CreditCard} ruta={ruta(c, '/dashboard/ajustes/monetizacion')} />
      </p>
    </>
  )
}

function Whatsapp({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Piru está pensado para tu WhatsApp de siempre: los pedidos te llegan ahí, en el chat con cada cliente, y
        los mensajes para que vuelvan salen de ese mismo número. No necesitás un número nuevo.
      </p>
      <h3>Avisos para vos</h3>
      <p>
        En Configuración → General → Avisos de pedidos podés recibir un WhatsApp cada vez que entra un pedido
        nuevo, en el número que elijas.
      </p>
      <h3>Avisos automáticos para tus clientes</h3>
      <p>
        Es un módulo pago: tus clientes reciben mensajes oficiales de WhatsApp a tu nombre, sin que mandes nada.
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Pedido confirmado</strong>: cuando se acredita un pago online.
        </li>
        <li>
          <strong>En camino o listo</strong>: con el botón de WhatsApp de cada pedido cobrado. Dice «ya está en
          camino», «listo para retirar» o «listo para servir», según el tipo de pedido.
        </li>
        <li>
          <strong>Confirmación manual con demora</strong>: en vez del aviso automático, al aceptar el pedido
          elegís en cuántos minutos sale y tocás «Confirmar y avisar por WhatsApp».
        </li>
      </ul>
      <p>
        Cada aviso usa saldo: el módulo trae avisos incluidos cada mes y en <strong>Mensajes</strong> ves cuántos
        mandaste, cuántos te quedan y podés recargar. Si el saldo se agota, los avisos dejan de salir, pero tus
        clientes siguen viendo el estado del pedido en la tienda.
      </p>
      <Nota>
        Conectar tu número a WhatsApp Business, la API oficial de Meta, es opcional. Sin eso, los pedidos te
        llegan igual y los mensajes de recompra salen desde tu WhatsApp con un toque.
      </Nota>
      <p className="flex flex-wrap gap-2">
        <Donde texto="WhatsApp" icono={MessageCircle} ruta={ruta(c, '/dashboard/ajustes/whatsapp')} />
        <Donde texto="Mensajes" icono={MessageSquare} ruta={ruta(c, '/dashboard/mensajes')} />
      </p>
    </>
  )
}

function Sucursales({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Con el módulo <strong>Múltiples sucursales</strong> cargás tus locales en Configuración → Entregas y
        zonas → Sucursales. Cada uno tiene sus pedidos y, si querés, su propio WhatsApp y su alias para
        transferencias.
      </p>
      <ul className="guia-puntos">
        <li>
          En Inicio, <strong>Cambiar sucursal</strong> (en los tres puntos de la lista) elige qué local ve esa
          compu. Cada dispositivo recuerda el suyo.
        </li>
        <li>Las comandas que imprime cada compu son las de su sucursal.</li>
        <li>A un mozo lo podés limitar a una sucursal.</li>
      </ul>
      <h3>Eventos con POS</h3>
      <p>
        Para vender en una feria o un evento sin mezclarlo con tu local: en Entregas y zonas → Eventos con POS
        creás una sede de evento. En la compu del evento la elegís con Cambiar sucursal y vendés con el punto de
        venta, con su propia cola de impresión. La tienda sigue atendiendo en el local.
      </p>
      <ul className="guia-puntos">
        <li>
          Un producto puede venderse <strong>sólo en el evento</strong> (Menú → Dónde se vende): no aparece en
          la tienda.
        </li>
        <li>En la configuración del punto de venta, «Sólo productos del evento» muestra únicamente esos.</li>
        <li>Mientras haya un evento activo, el punto de venta se usa sólo en las sedes de evento.</li>
        <li>Con el evento cerrado, sus pedidos se consultan pero no se anotan nuevos.</li>
      </ul>
      <p>
        <Donde texto="Entregas y zonas" icono={Truck} ruta={ruta(c, '/dashboard/ajustes/entregas')} />
      </p>
    </>
  )
}

const APP_MARKETING = [
  { Icono: Users, nombre: 'Clientes', texto: 'Tu base, con sus hábitos y sus favoritos.' },
  { Icono: Link2, nombre: 'Campañas y cupones', texto: 'Un link por historia y lo que vendió cada uno.' },
  { Icono: Repeat2, nombre: 'Recompra por WhatsApp', texto: 'Mensajes que salen del WhatsApp de tu local.' },
  { Icono: Sparkles, nombre: 'Puntos', texto: 'El club que les da una razón para volver.' },
  { Icono: CalendarDays, nombre: 'Días flojos', texto: 'A quién invitar cuando hay menos movimiento.' },
  { Icono: TrendingUp, nombre: 'Estadísticas', texto: 'Ventas cobradas, pedidos y lo más vendido.' },
]

function Clientes({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Nadie carga clientes a mano: cada pedido crea o actualiza la ficha del cliente, y lo que lo identifica
        es el celular. Esa base es la que usás para que vuelvan.
      </p>
      <p>
        En el panel, <strong>Clientes</strong> abre la app de marketing de Piru en otra pestaña, con tu cuenta y
        sin contraseña. Este panel queda abierto, recibiendo e imprimiendo pedidos.
      </p>
      <Tarjetas columnas={3}>
        {APP_MARKETING.map((x) => (
          <Tarjeta key={x.nombre} icono={x.Icono} titulo={x.nombre}>
            {x.texto}
          </Tarjeta>
        ))}
      </Tarjetas>
      <p>
        Campañas y cupones vienen incluidos: se activan gratis. La recompra y los puntos son parte de{' '}
        <strong>Retención</strong>, un módulo pago. La app de marketing tiene su propia guía, con todo explicado.
      </p>
      <Clave>
        <li>El acceso a la app de marketing dura 12 horas en esa pestaña. Si vence, abrila de nuevo desde Clientes.</li>
        <li>Si tu navegador bloquea la pestaña nueva, Clientes te deja un link para abrirla.</li>
      </Clave>
      <p className="flex flex-wrap gap-2">
        <Donde texto="Clientes" icono={Users} ruta={ruta(c, '/dashboard/clientes')} />
        <a
          href={GUIA_MARKETING}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-ink ring-1 ring-line hover:bg-sand"
        >
          <ExternalLink size={15} className="text-brand-deep" />
          Guía de la app de marketing
        </a>
      </p>
    </>
  )
}

function Estadisticas({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Estadísticas cuenta los pedidos <strong>cobrados</strong>, del mes que elijas o entre dos fechas («Por
        mes» o «Por rango»).
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Facturación, pedidos y ticket promedio</strong> del período.
        </li>
        <li>
          <strong>Cómo te pagaron</strong>: efectivo, Mercado Pago, tarjeta y transferencias.
        </li>
        <li>
          <strong>Origen de las ventas</strong>: lo que entró por la tienda y lo que anotaste a mano.
        </li>
        <li>
          <strong>Los más pedidos</strong>: tus productos estrella, con unidades y total.
        </li>
        <li>
          <strong>Acumulado histórico</strong>: todo lo facturado y los pedidos desde que usás Piru.
        </li>
      </ul>
      <p>
        Con Gestión de cadetes se suma la pestaña <strong>Repartidores</strong>: los pedidos que entregó cada uno
        y lo recaudado en envíos.
      </p>
      <Clave titulo="Para leerlas bien">
        <li>Compará un mes con el anterior, no con diciembre.</li>
        <li>
          Si crece lo que entra por la web, tu link está trabajando: cada pedido por la tienda es un cliente que
          queda en tu base.
        </li>
        <li>Caja es el día o el turno; Estadísticas, el mes. Para el cierre de cada noche, usá Caja.</li>
      </Clave>
      <p>
        <Donde texto="Estadísticas" icono={TrendingUp} ruta={ruta(c, '/dashboard/metricas')} />
      </p>
    </>
  )
}

function TuMarketer({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Si trabajás con un marketer, le das acceso con su código en Configuración → Tu marketer. Desde su cuenta
        ve la misma app de marketing que vos, con los datos de tu local.
      </p>
      <Tarjetas>
        <Tarjeta icono={Check} titulo="Puede" tono="si">
          Ver tus clientes, crear campañas, links y cupones, configurar los puntos, programar mensajes de
          recompra desde tu WhatsApp y ver tus estadísticas.
        </Tarjeta>
        <Tarjeta icono={X} titulo="No puede" tono="no">
          Tocar tus cobros, tu suscripción, tu menú y tus precios, tus pedidos ni tu configuración.
        </Tarjeta>
      </Tarjetas>
      <ul className="guia-puntos">
        <li>Los mensajes salen de tu WhatsApp: los mandás vos, o tu marketer si tiene ese WhatsApp vinculado.</li>
        <li>Si hace falta un módulo pago, te manda el link de pago: pagás vos.</li>
        <li>Le sacás el acceso cuando quieras, desde el mismo lugar.</li>
        <li>Piru le paga una parte de tu suscripción: tu precio no cambia.</li>
      </ul>
      <p>
        <Donde texto="Tu marketer" icono={Users} ruta={ruta(c, '/dashboard/ajustes/marketer')} />
      </p>
    </>
  )
}

function Modulos({ c }: { c: ContextoGuia }) {
  return (
    <>
      <p>
        Piru se paga con una suscripción mensual que incluye la tienda, el panel y la mayoría de las
        herramientas. Cada herramienta es un <strong>módulo</strong> que activás cuando lo necesitás, desde
        Configuración → Mis módulos o desde la sección donde se usa.
      </p>
      <Tarjetas>
        <Tarjeta icono={Check} titulo="Incluidos" tono="si">
          Se activan gratis y se apagan cuando quieras: Punto de venta, Mesas, Impresión de comandas, Gestión de
          cadetes, Múltiples sucursales, Mercado Pago, Campañas, Cupones y más.
        </Tarjeta>
        <Tarjeta icono={CreditCard} titulo="Pagos">
          Se suman a tu cuota, como Retención o los Avisos automáticos por WhatsApp. Se activan cuando se acredita
          el pago y, si los das de baja, siguen hasta el final del período pagado.
        </Tarjeta>
      </Tarjetas>
      <h3>Tu suscripción</h3>
      <p>
        En Configuración → Suscripción y pagos ves tu cuota, los módulos pagos que sumaste y tus comprobantes.
        Podés pagar la próxima cuota antes: se suma al final de tu cobertura, sin perder días.
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Prueba gratis</strong>: arriba de Inicio ves cuántos días te quedan y lo que ya vendiste con
          Piru.
        </li>
        <li>
          <strong>Si vence la cuota</strong>, tenés unos días de gracia: Inicio te avisa hasta cuándo podés
          pagarla sin cortes.
        </li>
        <li>
          <strong>Si se suspende</strong>, tu tienda se muestra cerrada temporalmente: la carta sigue visible y
          no se borra nada.
        </li>
        <li>
          <strong>Si das de baja Piru</strong>, seguís hasta el final del período pagado y tus datos quedan
          guardados.
        </li>
      </ul>
      <p className="flex flex-wrap gap-2">
        <Donde texto="Mis módulos" icono={Package} ruta={ruta(c, '/dashboard/ajustes/modulos')} />
        <Donde texto="Suscripción y pagos" icono={CreditCard} ruta={ruta(c, '/dashboard/ajustes/suscripcion')} />
      </p>
    </>
  )
}

function Rutina() {
  const bloques = [
    {
      titulo: 'Al abrir',
      detalle: 'Dos minutos',
      items: [
        'Abrí la app de Piru en la compu de la caja y fijate que la impresora esté prendida.',
        'Si tenés sucursales, revisá que esa compu esté en la suya.',
        'En Menú, pausá lo que no vas a tener hoy.',
      ],
    },
    {
      titulo: 'Durante el servicio',
      detalle: 'Pedido a pedido',
      items: [
        'Los pedidos entran solos: leé la comanda y despachalos cuando salen.',
        'Lo del mostrador y el teléfono, al punto de venta.',
        'En las mesas, mandá lo nuevo a cocina y despachalas cuando se van.',
      ],
    },
    {
      titulo: 'Al cerrar',
      detalle: 'Cinco minutos',
      items: [
        'Mirá la Caja: el total, los medios de pago y lo pendiente de cobro.',
        'Si trabajás por turnos, cerrá el turno.',
        'Una vez por semana, Estadísticas y Clientes.',
      ],
    },
  ]
  return (
    <ol className="grid gap-3 lg:grid-cols-3">
      {bloques.map((b, i) => (
        <li key={b.titulo} className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-[.09em] text-brand-deep">
            {i + 1} · {b.detalle}
          </p>
          <p className="mt-1.5 text-[17px] font-semibold text-ink">{b.titulo}</p>
          <ul className="mt-3 grid gap-2">
            {b.items.map((t) => (
              <li key={t} className="flex gap-2 text-[14.5px] leading-snug text-ink-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

const PREGUNTAS = [
  {
    p: '¿Por qué no se imprimió un pedido?',
    r: 'La impresión automática necesita la app de Piru para Windows (o Android) abierta, con la impresora configurada en Configuración → Impresión. Los pedidos que se pagan online se imprimen recién cuando se acredita el pago. Para otra copia, abrí el pedido y tocá «Reimprimir comprobante».',
  },
  {
    p: '¿Por qué un pedido dice «Pendiente»?',
    r: 'Porque todavía no está cobrado: es en efectivo o con transferencia manual. La Caja te muestra cuántos pedidos quedan pendientes de cobro.',
  },
  {
    p: '¿Dónde está un pedido que ya despaché?',
    r: 'En Historial, al final de la lista de ese día, y en la Caja. Despachar no borra nada.',
  },
  {
    p: '¿Qué pasa si se corta internet?',
    r: 'El punto de venta sigue andando: guarda las ventas en el dispositivo, imprime la comanda y las sube cuando vuelve la conexión. Los pedidos de la tienda entran recién cuando vuelve.',
  },
  {
    p: '¿Puedo cambiar un pedido que ya entró?',
    r: 'Sí, con «Editar pedido» desde su detalle, si tenés el punto de venta. Algunos pedidos, como los facturados, no se pueden editar.',
  },
  {
    p: '¿Cómo dejo de vender un producto por hoy?',
    r: 'En Menú, abrí el producto y apagá «Activo». Vuelve a ofrecerse cuando lo prendas.',
  },
  {
    p: '¿Por qué un cliente no puede pedir delivery?',
    r: 'Porque su dirección queda fuera de tus zonas de envío. Puede elegir retirar en el local, o podés ampliar las zonas en Entregas y zonas.',
  },
  {
    p: '¿Por qué no veo Mesas o Mozos?',
    r: 'Aparecen con los módulos Punto de venta y Mesas activos. Se activan gratis desde Configuración → Ventas en el local.',
  },
  {
    p: '¿Puedo usar el panel en varias compus a la vez?',
    r: 'Sí. Los pedidos se ven en todas al mismo tiempo y cada comanda se imprime una sola vez.',
  },
  {
    p: '¿Piru me cobra por pedido?',
    r: 'No. Pagás la suscripción mensual y los módulos pagos que actives. Lo que te pagan tus clientes va directo a tu cuenta.',
  },
]

function Preguntas() {
  return (
    <div className="grid gap-2.5">
      {PREGUNTAS.map((x) => (
        <details key={x.p} className="guia-pregunta rounded-2xl bg-white ring-1 ring-line">
          <summary className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-[15.5px] font-semibold text-ink">
            {x.p}
            <span
              aria-hidden
              className="guia-mas grid size-7 shrink-0 place-items-center rounded-full bg-sand text-lg font-medium leading-none text-ink-2"
            >
              +
            </span>
          </summary>
          <p className="guia-respuesta px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{x.r}</p>
        </details>
      ))}
    </div>
  )
}

const GLOSARIO: [string, string][] = [
  ['Anotado a mano', 'Un pedido cargado en el punto de venta, no por la tienda. Lleva la etiqueta Manual.'],
  ['Caja', 'El resumen de lo vendido en el día o en el turno, por medio de pago.'],
  ['Comanda', 'El pedido para la cocina: productos, variantes, extras e ingredientes quitados.'],
  ['Despachar', 'Dar el pedido por salido: deja la lista de activos y pasa al historial.'],
  ['Extra', 'Algo que se suma a un producto, con su precio.'],
  ['Franja', 'Un rango de horario para los pedidos programados, con un cupo opcional.'],
  ['Historial', 'Los pedidos ya despachados, al final de la lista de cada día.'],
  ['Módulo', 'Una herramienta que activás en tu local. Los incluidos son gratis; los pagos se suman a tu cuota.'],
  ['Pendiente', 'Un pedido que todavía no está cobrado.'],
  ['Punto de venta', 'La pantalla para anotar los pedidos del mostrador, el teléfono y las mesas.'],
  ['Sucursal', 'Cada uno de tus locales, con sus pedidos. También las sedes de un evento.'],
  ['Turno', 'La caja desde que abrís hasta que la cerrás, con el cierre de turno manual.'],
  ['Variante', 'Una versión del producto con su precio, como Simple, Doble o Triple.'],
  ['Zona de envío', 'Un área del mapa donde hacés delivery, con su costo.'],
]

function Glosario() {
  return (
    <dl className="grid gap-x-8 gap-y-4 rounded-2xl bg-white p-5 ring-1 ring-line sm:grid-cols-[170px_1fr] sm:p-6">
      {GLOSARIO.map(([termino, definicion]) => (
        <div key={termino} className="contents">
          <dt className="text-[15px] font-semibold text-ink">{termino}</dt>
          <dd className="-mt-3 text-[15px] leading-relaxed text-ink-2 sm:mt-0">{definicion}</dd>
        </div>
      ))}
    </dl>
  )
}

/** El cuerpo de cada sección de la guía. */
export function CuerpoSeccion({ id, c }: { id: string; c: ContextoGuia }) {
  switch (id) {
    case 'circuito':
      return <Circuito />
    case 'panel':
      return <Panel c={c} />
    case 'pedidos':
      return <Pedidos c={c} />
    case 'pos':
      return <PuntoDeVenta c={c} />
    case 'mesas':
      return <Mesas c={c} />
    case 'comandas':
      return <Comandas c={c} />
    case 'delivery':
      return <Delivery c={c} />
    case 'caja':
      return <Caja c={c} />
    case 'sin-conexion':
      return <SinConexionSeccion />
    case 'cobro-qr':
      return <CobroQrSeccion />
    case 'tienda':
      return <Tienda c={c} />
    case 'menu':
      return <Menu c={c} />
    case 'horarios':
      return <Horarios c={c} />
    case 'pagos':
      return <Pagos c={c} />
    case 'whatsapp':
      return <Whatsapp c={c} />
    case 'sucursales':
      return <Sucursales c={c} />
    case 'clientes':
      return <Clientes c={c} />
    case 'estadisticas':
      return <Estadisticas c={c} />
    case 'tu-marketer':
      return <TuMarketer c={c} />
    case 'modulos':
      return <Modulos c={c} />
    case 'rutina':
      return <Rutina />
    case 'preguntas':
      return <Preguntas />
    case 'glosario':
      return <Glosario />
    default:
      return null
  }
}
