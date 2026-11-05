import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  BadgeCheck,
  Ban,
  CalendarDays,
  Check,
  Gauge,
  Link2,
  MessageCircle,
  Moon,
  MousePointerClick,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Timer,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { MARKETING } from "../../lib/rutas";
import { cn } from "../ui";
import { Circuito } from "../escenas/Circuito";
import { LinkMedido } from "../escenas/LinkMedido";
import { FichaCliente } from "../escenas/FichaCliente";
import { RitmoCliente } from "../escenas/RitmoCliente";
import { EnvioHoy } from "../escenas/EnvioHoy";
import { Escalera } from "../escenas/Escalera";
import { MapaDias } from "../escenas/MapaDias";
import { ClubPuntos } from "../escenas/ClubPuntos";
import { CuponTicket } from "../escenas/CuponTicket";
import { Clave, Donde, Figura, Nota, Pasos } from "./piezas";

/** "Dónde está": la pantalla de Marketing de esa sección. */
const ruta = (seccion: string) =>
  seccion ? `${MARKETING}/${seccion}` : MARKETING;

function Tarjetas({ children, columnas = 2 }: { children: ReactNode; columnas?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columnas === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

function Tarjeta({
  icono: Icono,
  titulo,
  children,
  tono = "neutro",
}: {
  icono?: LucideIcon;
  titulo: ReactNode;
  children: ReactNode;
  tono?: "neutro" | "si" | "no";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 ring-1",
        tono === "si"
          ? "bg-emerald-50/70 ring-emerald-600/15"
          : tono === "no"
            ? "bg-rose-50/60 ring-rose-600/10"
            : "bg-surface ring-line",
      )}
    >
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {Icono && (
          <Icono
            size={17}
            className={cn(
              "shrink-0",
              tono === "si"
                ? "text-emerald-700"
                : tono === "no"
                  ? "text-rose-700"
                  : "text-brand-deep",
            )}
          />
        )}
        {titulo}
      </p>
      <div className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function Circuitos() {
  return (
    <>
      <p>
        Piru une cuatro cosas que en un local suelen andar sueltas: el contenido, la tienda,
        el WhatsApp y la base de clientes. Cada vuelta del circuito deja datos, y esos datos
        hacen más fácil la vuelta siguiente.
      </p>
      <Figura pie="Ejemplo: una historia con su link trae un pedido; el cliente queda en la base y, si deja de pedir, un mensaje con su link lo trae de vuelta.">
        <Circuito />
      </Figura>
      <Pasos
        items={[
          { icono: Link2, titulo: "Link", texto: "Cada historia, reel, anuncio o QR lleva su propio link. Así se sabe qué trajo cada pedido." },
          { icono: Store, titulo: "Tienda", texto: "El link abre la tienda del local: el cliente pide en un minuto, sin descargar nada ni crear un usuario." },
          {
            icono: MessageCircle,
            titulo: "Pedido",
            texto: "Te llega escrito a tu WhatsApp, el número de siempre, y aparece en tu panel.",
          },
          { icono: Users, titulo: "Cliente", texto: "Queda guardado en la base con su celular, qué pide, cada cuánto y por dónde llegó." },
          { icono: Repeat2, titulo: "Recompra", texto: "Si deja de pedir, Piru lo detecta y arma el mensaje para invitarlo a volver, con un link personal que vuelve a abrir la tienda." },
        ]}
      />
      <Clave>
        <li>
          Todo se mide en <strong>ventas cobradas</strong>: un pedido sin pagar o cancelado no suma.
        </li>
        <li>
          Los mensajes salen del <strong>WhatsApp del local</strong>, en el mismo chat de sus
          pedidos. No hay un número nuevo.
        </li>
        <li>La base es del local y se arma sola, pedido a pedido.</li>
      </Clave>
    </>
  );
}

const PANTALLAS: {
  Icono: LucideIcon;
  nombre: string;
  texto: string;
  seccion?: string;
  modulo?: string;
}[] = [
  { Icono: MessageCircle, nombre: "Hoy", seccion: "hoy", modulo: "Recompra", texto: "Los mensajes del día, listos para mandar." },
  { Icono: CalendarDays, nombre: "Días flojos", seccion: "dias-flojos", modulo: "Días flojos", texto: "Qué días y franjas venden menos, y a quién invitar." },
  { Icono: Link2, nombre: "Campañas", seccion: "campanas", texto: "Un link por historia o anuncio, con sus ventas cobradas." },
  { Icono: Users, nombre: "Clientes", seccion: "clientes", modulo: "Recompra", texto: "La base, con los hábitos, favoritos y segmento de cada uno." },
  { Icono: Sparkles, nombre: "Puntos", seccion: "puntos", modulo: "Puntos", texto: "El club: cómo se suman y se canjean los puntos." },
  { Icono: Ticket, nombre: "Cupones", seccion: "cupones", texto: "Códigos de descuento, con sus usos y sus ventas." },
  { Icono: TrendingUp, nombre: "Estadísticas", texto: "Ventas, pedidos, clientes, recompra y lo más vendido." },
];

function Pantallas() {
  return (
    <>
      <p>
        Todo lo que ves es de tu local. Estas son las pantallas del menú:
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PANTALLAS.map((p) => {
          const destino = p.seccion !== undefined ? ruta(p.seccion) : null;
          const contenido = (
            <>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                <p.Icono size={18} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
                  {p.nombre}
                  {p.modulo && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                      {p.modulo}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{p.texto}</span>
              </span>
            </>
          );
          const clase = "flex h-full items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line";
          return (
            <li key={p.nombre}>
              {destino ? (
                <Link to={destino} className={cn(clase, "hover:ring-ink-3/40")}>
                  {contenido}
                </Link>
              ) : (
                <div className={clase}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p>
        <strong>Recompra, Días flojos y Puntos</strong> son módulos incluidos e independientes: se
        activan gratis desde su pantalla y podés usar uno sin los otros. Campañas y Cupones también
        vienen incluidos.{" "}
      </p>
      <Nota icono={Smartphone}>
        Las pantallas de clientes y crecimiento están en el menú del panel. «Guía», arriba a la
        derecha, trae a esta guía.
      </Nota>
    </>
  );
}

const FICHA = [
  { titulo: "Pedidos y gasto", texto: "Cuántas veces pidió y cuánto gastó en total." },
  { titulo: "Favoritos", texto: "Los productos que más pide." },
  { titulo: "Cada cuánto pide", texto: "Su ritmo: «Pide cada ~12 días». Aparece desde el segundo pedido." },
  { titulo: "Por dónde llegó", texto: "La campaña de su primer pedido, un mensaje de recompra o «sin campaña»." },
  { titulo: "Campañas y cupones", texto: "En cuáles participó, con cuántos pedidos y cuánto vendió cada una." },
  { titulo: "Puntos", texto: "Su saldo en el club del local." },
];

function Clientes() {
  return (
    <>
      <p>
        Nadie carga clientes a mano: cada pedido de la tienda crea o actualiza la ficha del
        cliente. Lo que lo identifica es el <strong>celular</strong>: si vuelve a pedir con el
        mismo número, el pedido se suma a la misma ficha.
      </p>
      <Figura pie="Ejemplo: el pedido #1284 de Martina llega al WhatsApp del local y suma en su ficha.">
        <FichaCliente />
      </Figura>
      <h3>Qué guarda cada ficha</h3>
      <Tarjetas>
        {FICHA.map((f) => (
          <Tarjeta key={f.titulo} titulo={f.titulo}>
            {f.texto}
          </Tarjeta>
        ))}
      </Tarjetas>
      <Clave>
        <li>
          La base es de cada local: un cliente nunca se mezcla con el de otro local, aunque
          tenga el mismo número.
        </li>
        <li>
          La ficha muestra también su <strong>segmento</strong>: si es habitual, VIP o si se está
          yendo. Lo explica la sección <a className="underline" href="#segmentos">Segmentos</a>.
        </li>
        <li>Un pedido o un cliente se borra desde su ficha.</li>
      </Clave>
      <p>
        <Donde texto="Clientes" icono={Users} ruta={ruta("clientes")} />
      </p>
    </>
  );
}

const SEGMENTOS = [
  { nombre: "Primer pedido", punto: "bg-emerald-500", cuando: "Pidió una sola vez, no importa hace cuánto.", hacer: "Invitarlo al segundo pedido: es el mensaje que crea el hábito." },
  { nombre: "Habituales", punto: "bg-ink-3", cuando: "Pide a su ritmo.", hacer: "Nada: viene solo. No hace falta regalarle descuentos." },
  { nombre: "VIP", punto: "bg-amber-500", cuando: "Pidió 6 veces o más, o está entre los que más gastan del local.", hacer: "Cuidarlo. Si deja de venir, pasa al segmento que le toca." },
  { nombre: "Se están yendo", punto: "bg-orange-500", cuando: "Lleva 1,5 veces su ritmo sin pedir.", hacer: "Escribirle ya, antes de perderlo." },
  { nombre: "Hace tiempo no vienen", punto: "bg-violet-500", cuando: "Lleva 3 veces su ritmo sin pedir.", hacer: "Recordarle lo que le gusta." },
  { nombre: "Dejaron de pedir", punto: "bg-rose-500", cuando: "Lleva 6 veces su ritmo sin pedir.", hacer: "Un mensaje honesto, mejor en los días tranquilos del local." },
];

function Segmentos() {
  return (
    <>
      <p>
        Piru no usa días fijos para decidir quién se está yendo: compara cuánto hace que el
        cliente no pide con <strong>su propio ritmo</strong>. Para alguien que pide todas las
        semanas, 15 días sin pedir es mucho; para alguien que pide una vez por mes, no.
      </p>
      <Figura pie="Martina pide cada ~12 días. A los 18 días sin pedir (1,5 veces su ritmo) pasa a «Se están yendo»; a los 36, a «Hace tiempo no vienen»; a los 72, a «Dejaron de pedir».">
        <RitmoCliente />
      </Figura>
      <ul className="grid gap-2.5">
        {SEGMENTOS.map((s) => (
          <li
            key={s.nombre}
            className="grid gap-1 rounded-2xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[190px_1fr] sm:gap-4"
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className={cn("size-2.5 shrink-0 rounded-full", s.punto)} />
              {s.nombre}
            </span>
            <span className="text-[14.5px] leading-relaxed text-ink-2">
              {s.cuando} <span className="text-ink">{s.hacer}</span>
            </span>
          </li>
        ))}
      </ul>
      <Nota>
        Para medir el ritmo hacen falta dos pedidos: con uno solo, el cliente queda en «Primer
        pedido», pase el tiempo que pase. Es el grupo que más conviene invitar, porque el
        segundo pedido es el que crea el hábito.
      </Nota>
      <p className="flex flex-wrap gap-2">
        <Donde texto="Clientes" icono={Users} ruta={ruta("clientes")} />
        <Donde texto="Hoy" icono={MessageCircle} ruta={ruta("hoy")} />
      </p>
    </>
  );
}

function Campanas() {
  return (
    <>
      <p>
        Una campaña es un <strong>link con nombre</strong>. Lo pegás en el sticker de una
        historia, en la bio, en un anuncio o en un QR, y todo lo que entra por ahí queda
        contado: visitas, pedidos y ventas cobradas.
      </p>
      <Figura pie="Ejemplo: tres links del mismo local, ordenados por ventas cobradas. Abajo, lo que vendió sin campaña.">
        <LinkMedido />
      </Figura>
      <h3>Cómo se cuenta un pedido</h3>
      <Pasos
        items={[
          { icono: MousePointerClick, titulo: "Visita", texto: "Alguien abre el link: suma una visita." },
          { icono: ShoppingBag, titulo: "Pedido", texto: "Si en esa misma visita hace un pedido, el pedido queda atado al link. La visita se corta después de 30 minutos sin actividad." },
          { icono: BadgeCheck, titulo: "Venta cobrada", texto: "Recién cuando el pedido se cobra, suma a las ventas del link. Un clic no es una venta." },
        ]}
      />
      <h3>Qué puede abrir un link</h3>
      <ul className="guia-puntos">
        <li>
          <strong>La tienda</strong>, con toda la carta.
        </li>
        <li>
          <strong>Un producto con oferta</strong>: con un descuento opcional y un cupo de usos.
        </li>
        <li>
          <strong>Puntos extra</strong>: el link promete puntos que se acreditan cuando el pedido se
          cobra, con una compra mínima y un cupo. Nunca se suman con un descuento.
        </li>
        <li>
          <strong>Un carrito armado</strong>: los productos ya cargados, listos para pedir. Ideal
          para un combo o la recomendación de un influencer.
        </li>
      </ul>
      <p>
        Un link también puede tener fechas: el de un día flojo, por ejemplo, vale sólo ese día.
      </p>
      <h3>Cómo leer el ranking</h3>
      <p>
        Las campañas se ordenan por ventas cobradas, y cada barra se mide contra la que más
        vendió. Abajo está el <strong>orgánico</strong>: lo que el local vendió sin ninguna
        campaña. Es la línea de base.
      </p>
      <p>
        Si cargás lo que invertiste en pauta, el detalle de la campaña muestra el{" "}
        <strong>retorno</strong>: ventas cobradas dividido inversión. Un retorno de 9× quiere
        decir que cada $1 invertido trajo $9 en ventas.
      </p>
      <Clave>
        <li>
          <strong>Un link por pieza.</strong> Si la historia y el anuncio usan el mismo, no vas a
          saber cuál vendió.
        </li>
        <li>
          Muchas visitas y pocas ventas es curiosidad sin compra: probá otro destino o una oferta.
        </li>
        <li>
          Las campañas que usa el motor de recompra arman un link distinto para cada cliente: no se
          comparten ni se editan.
        </li>
      </Clave>
      <p>
        <Donde texto="Campañas" icono={Link2} ruta={ruta("campanas")} />
      </p>
    </>
  );
}

function Motor() {
  return <>
    <p>El motor está siempre activo con Recompra. Piru encuentra los clientes que necesitan volver y los distribuye por día de la semana y hora habitual. En <strong>Hoy</strong> ves todos los mensajes del día; también podés mirar <strong>Mañana</strong> y los siguientes días. En manual, el día y la hora son recomendaciones: podés abrir WhatsApp y marcar enviado cuando prefieras.</p>
    <Pasos items={[
      { titulo: "La agenda se actualiza sola", texto: "No hace falta crear tandas ni elegir una cantidad de clientes. El primer mensaje se asigna al día habitual de compra; los clientes perdidos se distribuyen en días con menos movimiento." },
      { titulo: "Mandás y marcás", texto: "Abrís WhatsApp con el texto listo desde el dispositivo del local y marcás enviado después de mandarlo." },
      { titulo: "El próximo toque", texto: "Si no compró, el siguiente mensaje se agenda a partir del envío real, respetando los días configurados y un mínimo de 48 horas. Un jueves más dos días da sábado; si el local cierra, pasa al próximo día abierto." },
    ]} />
    <h3>Hasta tres mensajes</h3><Figura pie="La recomendación: antojo, recordatorio y cierre."><Escalera /></Figura>
    <p>El primer mensaje no lleva descuento; el segundo recomienda 10 % y el tercero 20 %, con vencimiento de 48 horas. El descuento viaja en el link y se aplica solo. El ritmo es automático: no hay nada que configurar mensaje por mensaje.</p>
    <p>Con el club de puntos activo, el mensaje prioriza los puntos: si el cliente tiene saldo se lo recuerda (y le dice cuánto le falta para el premio más cercano); si tiene 0, lo invita a empezar a sumar. Podés cambiar el beneficio a un descuento a mano, o sumarle puntos extra. Un bonus de puntos en automático no se emite: se elige a mano en Hoy o se configura en una campaña.</p>
    <h3>El mismo día cada semana</h3><p>Un mensaje pendiente del jueves sigue disponible los jueves; no se acumula entre los mensajes de los demás días. Una vez enviado deja de aparecer y se programa su siguiente toque. Si el cliente vuelve a comprar, sale de la agenda.</p>
    <h3>Cuando el día es flojo</h3><p>Días flojos muestra, por día y horario, cuándo se vende menos; en Hoy aparecen dos herramientas: un link de campaña exclusivo para ese día de la semana, y sumar activos o VIP disponibles con una invitación propia sin descuento. Esa invitación no sube el descuento de su escalera y no genera recordatorios de recupero.</p>
    <Clave><li>Todos los contactos disponibles aparecen en la agenda: no se apartan clientes nuevos como control.</li><li>Se respetan las bajas, cuatro contactos en 30 días, 48 horas de descanso. El envío automático respeta el silencio de 22 a 9; en manual, el horario es una recomendación.</li><li>El envío manual sale del WhatsApp del local. Automático requiere su conexión de Meta, plantillas aprobadas, saldo y cupo de proveedor.</li></Clave>
    <p className="flex flex-wrap gap-2"><Donde texto="Hoy" icono={MessageCircle} ruta={ruta("hoy")} /></p>
  </>;
}

function Control() { return <p>La agenda semanal contacta a todos los clientes elegibles. Ya no crea grupos de control nuevos. Los grupos de las campañas anteriores se conservan sólo como historial; sus resultados no demuestran cuánto aporta el motor actual.</p>; }

const CUIDADOS = [
  { icono: ShieldCheck, titulo: "4 mensajes en 30 días", texto: "Nunca más que eso a la misma persona." },
  { icono: Moon, titulo: "Horario recomendado", texto: "En manual elegís cuándo mandar. El automático no envía entre las 22 y las 9." },
  { icono: Timer, titulo: "48 horas de descanso", texto: "Como mínimo, entre un mensaje y el siguiente." },
  { icono: Gauge, titulo: "Cupo diario", texto: "Los envíos automáticos respetan el cupo del proveedor." },
  { icono: Ban, titulo: "La baja se respeta", texto: "Quien pidió no recibir más mensajes, no los recibe." },
  { icono: ShoppingBag, titulo: "Si pide, sale", texto: "Un pedido nuevo lo saca de la cola." },
];

function Whatsapp() {
  return (
    <>
      <p>
        Los mensajes salen del número donde el local ya recibe los pedidos, en el mismo chat con
        cada cliente. No hay un número nuevo, ni una API que conectar, ni costo por mensaje.
      </p>
      <Figura pie="En Hoy: «Abrir WhatsApp» abre el chat con el mensaje escrito; se manda desde ahí y después se marca como enviado.">
        <EnvioHoy />
      </Figura>
      <h3>Primero, ¿qué dispositivo es?</h3>
      <p>
        «Abrir WhatsApp» abre el WhatsApp del celular o la compu donde lo tocás. Por eso Hoy
        pregunta, una vez por local, si ese dispositivo tiene el WhatsApp del local:
      </p>
      <Tarjetas>
        <Tarjeta icono={Check} titulo="Sí, lo tiene" tono="si">
          Aparecen «Abrir WhatsApp» y «Marcar enviado».
        </Tarjeta>
        <Tarjeta icono={X} titulo="No, está en otro" tono="no">
          Mandalos desde el celular o la compu que tiene tu WhatsApp. Desde acá podés copiar el texto.
        </Tarjeta>
      </Tarjetas>
      <p>La respuesta queda guardada en ese dispositivo y se cambia con «Cambiar dispositivo».</p>
      <h3>Marcar enviado</h3>
      <p>
        Piru no ve el WhatsApp: se entera de que el mensaje salió cuando tocás{" "}
        <strong>Marcar enviado</strong>. Eso lo registra y deja
        programado el mensaje siguiente. Marcalo después de mandarlo.
      </p>
      <h3>Cuidados de la base</h3>
      <p>
        Piru cuida a los clientes y al número del local. Por eso, a veces un mensaje dice
        «Todavía no se puede mandar» y explica por qué:
      </p>
      <Tarjetas columnas={3}>
        {CUIDADOS.map((x) => (
          <Tarjeta key={x.titulo} icono={x.icono} titulo={x.titulo}>
            {x.texto}
          </Tarjeta>
        ))}
      </Tarjetas>
      <p>
        <Donde texto="Hoy" icono={MessageCircle} ruta={ruta("hoy")} />
      </p>
    </>
  );
}

function DiasFlojos() {
  return (
    <>
      <p>
        Piru mira los pedidos de las últimas semanas (8, salvo que elijas otra ventana) y calcula
        el promedio de cada día y cada franja. Un día abierto que vende menos del{" "}
        <strong>70 % del promedio</strong> es un día flojo.
      </p>
      <Figura pie="Ejemplo: el martes a la noche es el hueco más grande. Más naranja, más movimiento; con trama, los días que el local cierra.">
        <MapaDias />
      </Figura>
      <h3>A quién invita</h3>
      <p>
        No invita a los que vienen igual: los habituales y los que pidieron en los últimos 7 días
        quedan afuera. Un descuento para el martes a quien pide todos los viernes no suma un
        pedido: lo corre de día. Primero van los que ya pidieron ese día de la semana; después,
        los que hace rato no vuelven.
      </p>
      <h3>La invitación</h3>
      <p>
        En Hoy, si es un día flojo, podés sumar activos y VIP con una invitación sin descuento. El link de campaña sirve cada semana en el día elegido.
      </p>
      <h3>El link del día</h3>
      <p>
        «Crear el link del día» arma una campaña que vale sólo esa fecha, para la historia y el
        estado de WhatsApp de ese día. El análisis y el link los tiene cualquier local; la
        invitación por WhatsApp necesita Días flojos.
      </p>
      <Nota>Hacen falta al menos dos semanas con pedidos para encontrar el patrón.</Nota>
      <p>
        <Donde texto="Días flojos" icono={CalendarDays} ruta={ruta("dias-flojos")} />
      </p>
    </>
  );
}

function Puntos() {
  return (
    <>
      <p>
        Cada pedido cobrado le suma puntos al cliente, y con los puntos canjea premios. Es una
        razón concreta para volver a pedir en el local y no por otro lado.
      </p>
      <Figura pie="Ejemplo con 1 punto cada $100: un pedido de $13.500 suma 135 puntos.">
        <ClubPuntos />
      </Figura>
      <h3>Cómo se suman</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Por el monto</strong>: un punto cada tantos pesos del pedido.
        </li>
        <li>
          <strong>Por los productos</strong>: cada producto suma los puntos que le pongas en
          «Puntos por producto».
        </li>
        <li>
          <strong>Monto y productos</strong>: las dos cosas a la vez.
        </li>
        <li>
          <strong>Bienvenida</strong>: puntos de regalo con el primer pedido.
        </li>
      </ul>
      <h3>Cómo se canjean</h3>
      <ul className="guia-puntos">
        <li>
          <strong>Envío gratis</strong>, por los puntos que definas.
        </li>
        <li>
          <strong>Un descuento</strong>, en porcentaje o monto fijo, con una compra mínima si
          querés.
        </li>
        <li>
          <strong>Productos</strong>: los que tengan un costo en «Cuesta canjear». El producto
          sigue a la venta con su precio: el canje es una opción más.
        </li>
      </ul>
      <p>El «Mínimo para canjear» evita canjes muy chicos.</p>
      <h3>Puntos como incentivo</h3>
      <p>
        Los puntos también sirven para recuperar clientes sin regalar margen. En un link de campaña
        o en un mensaje manual podés elegir <strong>sumar puntos extra</strong> en vez de un
        descuento: se acreditan recién cuando el pedido se cobra. Para que el premio no salga más
        caro que la venta, el local define tres topes: cuánto puede valer el bonus sobre el pedido,
        cuántos puntos como máximo por pedido y cuántas veces por cliente cada 30 días. La compra
        mínima del link se calcula con esos topes y se anuncia en el mensaje.
      </p>
      <Clave>
        <li>
          Los puntos extra y el descuento son excluyentes: un link promete uno u otro, nunca los dos.
        </li>
        <li>
          Si el pedido se cancela, los puntos extra se retiran del saldo igual que los de la compra.
        </li>
      </Clave>
      <Clave>
        <li>
          Los puntos se acreditan cuando el pedido se cobra. Si el pedido se cancela, se descuentan
          y lo canjeado vuelve al saldo.
        </li>
        <li>
          Podés sumar o restar puntos a mano a un cliente, siempre con un motivo: queda en sus
          movimientos.
        </li>
        <li>Cambiar las reglas del club no toca los precios ni la carta del local.</li>
      </Clave>
      <p>
        <Donde texto="Puntos" icono={Sparkles} ruta={ruta("puntos")} />
      </p>
    </>
  );
}

function Cupones() {
  return (
    <>
      <p>
        Un cupón es un código que el cliente escribe al pagar, como <code>MARTES</code> con 15 % o
        $2.000 de descuento, o con envío gratis. Sirve para acciones puntuales: un sorteo, una alianza con otro
        comercio, un volante.
      </p>
      <Figura pie="Cada cupón muestra cuántas veces se usó, cuántos clientes lo usaron y las ventas cobradas de esos pedidos.">
        <CuponTicket />
      </Figura>
      <ul className="guia-puntos">
        <li>
          <strong>Beneficio</strong>: un porcentaje, un monto fijo o envío gratis. El envío gratis sólo sirve para delivery y bonifica el costo de la zona; la compra mínima no incluye el envío.
        </li>
        <li>
          <strong>Usos máximos</strong> y <strong>compra mínima</strong>, si querés ponerle límites.
        </li>
        <li>
          <strong>Vigencia</strong>: desde y hasta qué día sirve.
        </li>
        <li>
          <strong>Pausar</strong> lo deja sin efecto sin borrarlo.
          {" "}Un cupón que ya se usó en pedidos no se puede borrar: pausalo.
        </li>
      </ul>
      <Nota>
        Los descuentos del motor de recompra no son cupones que tengas que crear: Piru arma uno
        para cada cliente y cada mensaje, viaja en su link y no aparece en esta lista.
      </Nota>
      <p>
        <Donde texto="Cupones" icono={Ticket} ruta={ruta("cupones")} />
      </p>
    </>
  );
}

function Numeros() {
  return (
    <>
      <p>
        En toda la app, «ventas» quiere decir <strong>ventas cobradas</strong>: pedidos pagados y
        no cancelados. Es la plata que entró, no la que se prometió.
      </p>
      <ul className="guia-puntos">
        <li>
          <strong>Estadísticas</strong>: la facturación, los pedidos cobrados y el ticket del
          período, los clientes nuevos, los que hay para recuperar, la recompra y lo que podés
          hacer hoy.
        </li>
        <li>
          <strong>Estadísticas → Clientes</strong>: la base de clientes, los segmentos, la recompra
          y los resultados de campañas.
        </li>
        <li>
          <strong>Estadísticas</strong>: entre las fechas que elijas, la facturación, los pedidos
          cobrados, el ticket, cuánto entró por la tienda y cuánto se anotó a mano, los medios de
          pago y los productos más vendidos.
        </li>
        <li>
          <strong>Campañas</strong>: las ventas de cada link (lo explica la sección{" "}
          <a className="underline" href="#campanas">
            Campañas y links
          </a>
          ).
        </li>
      </ul>
      <Clave titulo="Para leerlos bien">
        <li>
          Compará contra un período parecido: un mes contra el anterior, no contra diciembre.
        </li>
        <li>
          Un link que vende más que el orgánico, un día flojo que mejora y clientes que vuelven
          más que el grupo de control: esas son las señales de que el marketing funciona.
        </li>
      </Clave>
      <p className="flex flex-wrap gap-2">
        <Donde texto="Estadísticas" icono={TrendingUp} ruta={ruta("estadisticas")} />
      </p>
    </>
  );
}

function Rutina() {
  const bloques = [
    {
      titulo: "Todos los días",
      detalle: "Unos 5 minutos",
      items: ["Abrí Hoy y mandá los mensajes del día.", "Marcá cada uno como enviado."],
    },
    {
      titulo: "Cada semana",
      detalle: "Media hora",
      items: [
        "Un link nuevo para cada historia o anuncio.",
        "Mirá Días flojos y programá la invitación.",
        "La agenda de los que se están yendo.",
      ],
    },
    {
      titulo: "Cada mes",
      detalle: "Para ver el resultado",
      items: [
        "El ranking de campañas contra el orgánico.",
        "Estadísticas → Clientes: clientes nuevos y los que volvieron contra el control.",
        "Si nadie llega a canjear puntos, bajá lo que cuestan los premios.",
      ],
    },
  ];
  return (
    <ol className="grid gap-3 lg:grid-cols-3">
      {bloques.map((b, i) => (
        <li key={b.titulo} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
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
  );
}

function Preguntas() {
  const preguntas = [
    {
      p: "¿Por qué no veo Hoy, Días flojos o Puntos?",
      r: "Son módulos independientes: si no tenés el que abre esa pantalla, la tab no aparece y la URL te muestra cómo activarlo gratis.",
    },
    {
      p: "¿Se paga algo por cada mensaje?",
      r: "En el modo manual, no: salen del WhatsApp del local como cualquier otro mensaje. Sólo el modo automático, con la API de Meta, usa créditos.",
    },
    {
      p: "¿Por qué un mensaje dice «Todavía no se puede mandar»?",
      r: "Porque el cliente recibió otro mensaje hace menos de 48 horas, alcanzó el límite de contactos, pidió la baja o volvió a comprar. También puede haber vencido una invitación de día flojo. En manual, el día y la hora sugeridos no bloquean las acciones. El mensaje explica el motivo.",
    },
    {
      p: "¿Qué pasa si el cliente vuelve a pedir?",
      r: "Sale de la cola: no recibe los mensajes que le faltaban.",
    },
    {
      p: "¿Qué pasa si hoy no mando un mensaje?",
      r: "Sigue pendiente para ese mismo día de la semana. El siguiente toque recién se agenda cuando marcás enviado.",
    },
    {
      p: "¿El cliente tiene que escribir un código para el descuento?",
      r: "En la recompra, no: el descuento viaja en su link y se aplica solo. Los cupones, en cambio, se escriben al pagar.",
    },
    {
      p: "¿Por qué un link tiene visitas pero no ventas?",
      r: "Las ventas cuentan recién cuando el pedido se cobra, y sólo si se hizo en la visita que entró por el link. Muchas visitas y pocas ventas suele ser curiosidad sin compra: probá otro destino o una oferta.",
    },
    {
      p: "¿Qué es «Orgánico»?",
      r: "Lo que el local vendió sin ninguna campaña. Es la línea de base para comparar cada link.",
    },
    {
      p: "¿Por qué alguien figura como «Primer pedido» hace meses?",
      r: "Porque pidió una sola vez: hasta el segundo pedido no tiene un ritmo para medir. Es el grupo con más prioridad en la recompra.",
    },
    {
      p: "¿Puedo borrar una campaña?",
      r: "Sí. Si ya trajo ventas, en lugar de borrarse se desactiva, para no perder sus resultados.",
    },
  ];
  return (
    <div className="grid gap-2.5">
      {preguntas.map((x) => (
        <details key={x.p} className="guia-pregunta rounded-2xl bg-surface ring-1 ring-line">
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
  );
}

const GLOSARIO: [string, string][] = [
  ["Cola", "Los mensajes agendados que todavía no salieron."],
  ["Cupo diario", "Cuántos mensajes automáticos puede mandar el local por día."],
  ["Día flojo", "Un día y franja en que el local abre y vende menos del 70 % del promedio."],
  ["Escalera", "Los tres mensajes de la recompra, con el descuento que recomienda Piru: sin descuento, 10 % y 20 %."],
  ["Franja", "Una parte del día —mediodía, tarde o noche— según los horarios del local."],
  ["Grupo de control", "Grupo histórico de campañas anteriores; la agenda actual no crea controles."],
  ["Mensaje 1, 2 y 3", "Cada intento de la recompra con un mismo cliente."],
  ["Orgánico", "Lo que se vende sin ninguna campaña."],
  ["Recompra", "El módulo incluido con la agenda de mensajes de Hoy."],
  ["Días flojos", "El módulo incluido que encuentra los días y franjas con menos movimiento."],
  ["Puntos", "El módulo incluido del club: cómo se suman y se canjean los puntos."],
  ["Retorno", "Las ventas cobradas de una campaña divididas por lo que se invirtió en pauta."],
  ["Segmento", "El grupo de un cliente según su ritmo: primer pedido, habituales, VIP, se están yendo, hace tiempo no vienen o dejaron de pedir."],
  ["Agenda semanal", "Los mensajes pendientes de Hoy, Mañana y los siguientes días, actualizados automáticamente."],
  ["Venta cobrada", "Un pedido pagado y no cancelado."],
];

function Glosario() {
  return (
    <dl className="grid gap-x-8 gap-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line sm:grid-cols-[170px_1fr] sm:p-6">
      {GLOSARIO.map(([termino, definicion]) => (
        <div key={termino} className="contents">
          <dt className="text-[15px] font-semibold text-ink">{termino}</dt>
          <dd className="-mt-3 text-[15px] leading-relaxed text-ink-2 sm:mt-0">{definicion}</dd>
        </div>
      ))}
    </dl>
  );
}

/** El cuerpo de cada sección de la guía. */
export function CuerpoSeccion({ id }: { id: string }) {
  switch (id) {
    case "circuito":
      return <Circuitos />;
    case "pantallas":
      return <Pantallas />;
    case "clientes":
      return <Clientes />;
    case "segmentos":
      return <Segmentos />;
    case "campanas":
      return <Campanas />;
    case "motor":
      return <Motor />;
    case "control":
      return <Control />;
    case "whatsapp":
      return <Whatsapp />;
    case "dias-flojos":
      return <DiasFlojos />;
    case "puntos":
      return <Puntos />;
    case "cupones":
      return <Cupones />;
    case "numeros":
      return <Numeros />;
    case "rutina":
      return <Rutina />;
    case "preguntas":
      return <Preguntas />;
    case "glosario":
      return <Glosario />;
    default:
      return null;
  }
}
