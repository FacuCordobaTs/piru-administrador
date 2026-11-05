import { expect, test, type Page } from "@playwright/test";
const local = (id: number, nombre: string) => ({
  restauranteId: id,
  nombre,
  username: nombre.toLowerCase(),
  imagenUrl: null,
  colorPrimario: null,
  baseTienda: `https://my.piru.app/${nombre.toLowerCase()}/`,
  whatsappConectado: false,
  retencionActiva: true,
  crecimientoActivo: true,
  codigosDescuentoActivo: true,
  suscripcion: { estado: "active", montoMensual: 10000 },
  ventas30d: 13500,
  ventas30dAnterior: 10000,
  pedidos30d: 2,
  clientesNuevos30d: 1,
  ventasSemanales: [0, 1000, 2000, 1000, 4000, 3000, 5000, 5000],
  diaMasFlojo: { diaSemana: 2, nombre: "Martes" },
  mensajesParaHoy: 1,
});
const config = {
  restauranteId: 1,
  estado: "activa",
  modo: "manual",
  automaticoDisponible: false,
  cupoDiario: 20,
  toqueHasta: 3,
  diasToque2: 7,
  diasToque3: 7,
  porcentajeControl: 0,
  ultimoDrenajeDia: null,
  avisoSinSaldoAt: null,
};
const estado = {
  activa: true,
  config,
  campana: {
    enviadosHoy: 0,
    totalEnviados: 0,
    volvieron: 0,
    controlVolvieron: 0,
  },
  programaciones: [],
  plan: { totalDetectados: 1 },
};
const metricas = {
  ingresos: {
    mensual: 13500,
    historico: 13500,
    mensualManual: 1000,
    mensualWeb: 12500,
  },
  pedidos: {
    mensuales: 2,
    mensualesPagados: 2,
    mensualesManual: 1,
    mensualesWeb: 1,
    historicos: 2,
  },
  desgloseMetodoPago: [{ metodoPago: "efectivo", total: 13500 }],
  topProductos: [
    { productoId: 1, nombre: "Hamburguesa", cantidad: 2, totalVendido: 13500 },
  ],
};
const growth = {
  metricas: {
    ventas: 13500,
    pedidos: 1,
    inversionManual: 1000,
    retorno: 12500,
    sesiones: 2,
  },
  campanas: [
    {
      id: 1,
      nombre: "Historia martes",
      metricas: { ventas: 13500, pedidos: 1, sesiones: 2, inversionManual: 1000, retorno: 12500 },
    },
  ],
  oportunidades: {},
  funnel: {},
  recompra: {},
  incremental: {},
};
const campana = {
  id: 1,
  slug: "historia-martes",
  nombre: "Historia martes",
  tipo: "adquisicion",
  estado: "activa",
  categoria: "historias_instagram",
  destinoTipo: "tienda",
  productoId: null,
  carritoRep: null,
  descuentoProductoPorcentaje: 0,
  limiteUsos: null,
  inversionManual: 1000,
  fechaInicio: null,
  fechaFin: null,
};
const cliente = {
  id: 1,
  nombre: "Ana",
  telefono: "5491112345678",
  puntos: 100,
  totalGastado: 13500,
  cantidadPedidos: 2,
  segmento: "dormido",
  ultimoPedidoAt: new Date().toISOString(),
  pedidos: [],
  productosTop: [{ nombre: "Hamburguesa", cantidad: 2 }],
  campanasParticipadas: [],
  cuponesUsados: [],
};
const now = new Date(Date.now() - 3600000).toISOString();
// El día de Argentina, como lo calcula la app: con el de UTC, de 21 a 24 la cola quedaba "para mañana".
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date());
const candidato = {
  clienteId: 1,
  nombre: "Ana",
  telefono: "5491112345678",
  segmento: "dormido",
  diasDesdeUltimo: 45,
  totalGastado: 13500,
  ticketPromedio: 6750,
  cantidadPedidos: 2,
  toquesDesdeUltimoPedido: 0,
  proximoNivel: 1,
  horarioSugerido: "Martes 18:00 hs",
  dueDate: now,
  elegible: true,
  motivo: "Pidió 3 veces un martes",
  pedidosDia: 3,
};
const hace = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();
const diaArgentina = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(s));
const pedido = (id: number, dias: number, extra: Record<string, unknown> = {}) => ({
  id,
  total: "6750",
  createdAt: hace(dias),
  tipo: "delivery",
  items: [{ nombreProducto: "Hamburguesa", cantidad: 1, precioUnitario: "6750" }],
  ...extra,
});
// Ana llegó por la historia hace 40 días y después volvió sola; Beto pidió ayer en la otra
// sucursal, con un cupón.
const clientes = [
  {
    ...cliente,
    direccion: "Mitre 123",
    ultimoPedidoAt: hace(2),
    fuenteAdquisicion: "campana",
    campanaAdquisicion: { id: 1, nombre: "Historia martes", slug: "historia-martes" },
    primeraCompra: { pedidoId: 11, fecha: hace(40), revenue: 6750 },
    campanasParticipadas: [
      {
        id: 1,
        nombre: "Historia martes",
        slug: "historia-martes",
        pedidos: 1,
        revenueAtribuido: 6750,
        primeraInteraccion: hace(40),
        ultimaInteraccion: hace(40),
      },
    ],
    pedidos: [
      pedido(12, 2, { sucursalId: 1, esOrganico: true }),
      pedido(11, 40, { sucursalId: 1, campanaId: 1 }),
    ],
  },
  {
    id: 2,
    nombre: "Beto",
    telefono: "5491187654321",
    direccion: null,
    puntos: 0,
    totalGastado: 6750,
    cantidadPedidos: 1,
    segmento: "activo",
    ultimoPedidoAt: hace(1),
    fuenteAdquisicion: "organico",
    productosTop: [],
    campanasParticipadas: [],
    cuponesUsados: [
      {
        id: 7,
        codigo: "PRIMAVERA",
        tipo: "porcentaje",
        valor: 15,
        usos: 1,
        facturacion: 6750,
        montoDescontado: 1012,
        ultimoUsoAt: hace(1),
      },
    ],
    pedidos: [pedido(21, 1, { sucursalId: 2, esOrganico: true, codigoDescuentoId: 7 })],
  },
];
const cupones = [
  {
    id: 7,
    restauranteId: 1,
    codigo: "PRIMAVERA",
    tipo: "porcentaje",
    valor: "15.00",
    limiteUsos: null as number | null,
    usosActuales: 3,
    montoMinimo: "0.00",
    fechaInicio: hace(14) as string | null,
    fechaFin: null as string | null,
    activo: true,
    generadoAutomaticamente: false,
    createdAt: hace(15),
  },
  {
    id: 8,
    restauranteId: 1,
    codigo: "INVIERNO",
    tipo: "monto_fijo",
    valor: "2000.00",
    limiteUsos: 10,
    usosActuales: 10,
    montoMinimo: "5000.00",
    fechaInicio: null,
    fechaFin: hace(30),
    activo: false,
    generadoAutomaticamente: false,
    createdAt: hace(120),
  },
];
// La campaña que el backend crea para el motor de recompra, y un link pausado de producto.
const maestra = {
  ...campana,
  id: 2,
  slug: "reactivacion",
  nombre: "Reactivación",
  tipo: "reactivacion",
  categoria: null,
  inversionManual: 0,
};
const reel = {
  ...campana,
  id: 3,
  slug: "reel-promo",
  nombre: "Reel promo",
  estado: "inactiva",
  categoria: "reels_tiktok",
  destinoTipo: "producto",
  productoId: 1,
  descuentoProductoPorcentaje: 20,
};
const opcionesMensaje = {
  segmentos: (["primer_pedido", "en_riesgo", "dormido", "perdido"] as const).map(
    (codigo) => ({
      codigo,
      nombre: codigo,
      esDelCliente: codigo === "dormido",
      esActual: codigo === "dormido",
    }),
  ),
  toques: [1, 2, 3].map((toque) => ({
    toque,
    titulo: `${toque}º toque`,
    descripcion: ["relato y antojo", "recordatorio corto", "cierre"][toque - 1],
    descuento: [10, 15, 20][toque - 1],
    expiraHoras: 48,
    esActual: toque === 1,
    esDeLaEscalera: toque === 1,
  })),
  links: [
    {
      modalidad: "lo-mismo",
      titulo: "Lo de siempre",
      descripcion: "Abre su pedido de siempre, sin descuento",
      esActual: false,
    },
    {
      modalidad: "reactivacion",
      titulo: "Con beneficio",
      descripcion: "Abre la tienda con el descuento",
      esActual: true,
    },
  ],
  descuentos: { min: 0, max: 30, sugeridos: [10, 15, 20], recomendado: 10 },
};
// El texto de cada toque, como lo arma el backend con las decisiones que llegan por query.
const textoToque = (toque: number, descuento: number) =>
  `${["Hola Ana 👋 Volvé a Brasa.", "Ana, ¿te tentás con lo de siempre?", "Ana, última invitación del mes."][toque - 1]}${descuento ? ` Tenés ${descuento}% OFF.` : ""} https://my.piru.app/brasa/`;
async function mock(
  page: Page,
  opciones: {
    envio?: { puedeEnviar: boolean; motivo: string | null; desde?: string };
    horarioSugerido?: string;
    cupoDiario?: number;
    candidatos?: number;
    retencion?: "activo" | "inactivo" | "pendiente_pago";
    /** Suma la campaña del motor y un link pausado a "Historia martes". */
    variasCampanas?: boolean;
    motor?: "activa" | "pausada_manual" | "pausada_sin_saldo";
    /** Deja que el recorrido de bienvenida se abra solo, como la primera vez. */
    recorrido?: boolean;
  } = {},
) {
  // El resto de los recorridos no lo quieren encima: lo dan por visto.
  if (!opciones.recorrido)
    await page.addInitScript(() => {
      localStorage.setItem("piru-marketing-recorrido-v1:1", "visto");
    });
  const envio = opciones.envio ?? { puedeEnviar: true, motivo: null };
  const requests: string[] = [];
  const posts: {
    path: string;
    body: Record<string, unknown>;
    raw: string | null;
  }[] = [];
  const borrados: string[] = [];
  const consultas: { path: string; params: Record<string, string> }[] = [];
  const autorizaciones = new Map<string, string>();
  const retencion = opciones.retencion ?? "activo";
  // Lo que se puede borrar o cambiar vive en el mock: las pantallas vuelven a pedir y lo ven.
  let motor = opciones.motor ?? "activa";
  let clientesVivos = clientes.map((c) => ({ ...c, pedidos: [...c.pedidos] }));
  let cuponesVivos = cupones.map((c) => ({ ...c }));
  let campanasVivas: (typeof campana | typeof maestra | typeof reel)[] =
    opciones.variasCampanas ? [campana, maestra, reel].map((c) => ({ ...c })) : [campana];
  const resumen = opciones.variasCampanas
    ? {
        ...growth,
        campanas: [
          ...growth.campanas,
          { id: 2, nombre: "Reactivación", metricas: { ventas: 50000, pedidos: 4, sesiones: 0, inversionManual: 0, retorno: 50000 } },
        ],
      }
    : growth;
  await page.route("https://api.piru.app/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api", "");
    requests.push(path);
    consultas.push({ path, params: Object.fromEntries(url.searchParams) });
    autorizaciones.set(path, req.headers()["authorization"] || "");
    if (["POST", "PUT"].includes(req.method()))
      posts.push({ path, body: req.postDataJSON() || {}, raw: req.postData() });
    if (req.method() === "DELETE") borrados.push(path);
    const id = Number(path.match(/\/(\d+)(?:\/[a-z-]+)?$/)?.[1]);
    const envelope = (data: unknown) => ({ success: true, data });
    const fulfill = (data: unknown, status = 200) =>
      route.fulfill({ status, json: data });
    if (path === "/marketing-local") return fulfill(local(1, "Brasa"));
    if (path === "/marketing-local/sucursales")
      return fulfill([
        { id: 1, nombre: "Centro", activo: true },
        { id: 2, nombre: "Norte", activo: true },
      ]);
    if (path === "/modulos/motor_recompra/checkout")
      return fulfill(
        envelope({
          url_pago:
            "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=prueba",
        }),
      );
    if (path === "/modulos/motor_recompra/pago-link-whatsapp")
      return fulfill(envelope({ enviado: true, telefono: "5491100000000" }));
    if (path === "/modulos/mis-modulos")
      return fulfill(
        envelope([
          {
            id: 1,
            modulos: ["motor_recompra", "crecimiento", "codigos_descuento"].map(
              (codigo) => ({
                codigo,
                tipo: codigo === "motor_recompra" ? "pago" : "incluido",
                activoAhora:
                  codigo !== "motor_recompra" || retencion === "activo",
                estado: codigo === "motor_recompra" ? retencion : "activo",
                precioMensual:
                  codigo === "motor_recompra" ? "15000.00" : "0.00",
                precioMensualCongelado: null,
              }),
            ),
          },
        ]),
      );
    if (path === "/metricas") return fulfill(envelope(metricas));
    if (path === "/producto")
      return fulfill({
        success: true,
        productos: [
          {
            id: 1,
            nombre: "Hamburguesa",
            puntosGanados: 5,
            puntosNecesarios: 500,
            variantes: [],
          },
        ],
      });
    if (path === "/clientes/list" && !url.searchParams.has("pagina"))
      return fulfill(envelope(clientesVivos));
    if (path === "/clientes/list")
      return fulfill(
        envelope({
          items: clientesVivos,
          pagina: 1,
          limite: 25,
          total: clientesVivos.length,
          paginas: 1,
          resumen: {
            total: clientesVivos.length,
            conPuntos: clientesVivos.filter((c) => c.puntos > 0).length,
            puntosEnCirculacion: clientesVivos.reduce((t, c) => t + c.puntos, 0),
            porSegmento: { nuevo: 0, activo: 1, vip: 0, en_riesgo: 0, dormido: 1, perdido: 0 },
          },
        }),
      );
    if (req.method() === "DELETE" && /^\/clientes\/\d+\/pedidos\/\d+$/.test(path)) {
      clientesVivos = clientesVivos.map((c) => ({
        ...c,
        pedidos: c.pedidos.filter((p) => p.id !== id),
      }));
      return fulfill({ success: true, message: "Pedido eliminado" });
    }
    if (req.method() === "DELETE" && /^\/clientes\/\d+$/.test(path)) {
      clientesVivos = clientesVivos.filter((c) => c.id !== id);
      return fulfill({ success: true, message: "Cliente eliminado" });
    }
    if (path === "/clientes/recompra/sincronizar") return fulfill(envelope({ agregados: 0 }));
    if (path === "/clientes/recompra/config") return fulfill(envelope(config));
    if (path === "/clientes/recompra/estado")
      return fulfill(
        envelope({
          ...estado,
          activa: motor === "activa",
          config: {
            ...config,
            estado: motor,
            cupoDiario: opciones.cupoDiario ?? config.cupoDiario,
          },
        }),
      );
    if (path === "/clientes/recompra/pausar" || path === "/clientes/recompra/reanudar") {
      motor = path.endsWith("pausar") ? "pausada_manual" : "activa";
      return fulfill(envelope({ estado: motor }));
    }
    const segmento = url.searchParams.get("segmento");
    if (path === "/clientes/recompra/cola") {
      const items = [
        {
          id: 1,
          clienteId: 1,
          clienteNombre: "Ana",
          telefono: "5491112345678",
          segmento: "dormido",
          toque: 1,
          dueDate: now,
          fechaProyectada: today,
        },
      ].filter((c) => !segmento || c.segmento === segmento);
      return fulfill(
        envelope({
          items,
          total: items.length,
          paginas: items.length ? 1 : 0,
          pagina: 1,
          limite: 100,
        }),
      );
    }
    if (path === "/clientes/recompra/cola/1/mensaje") {
      // Sin decisiones, el default del motor; con decisiones, el mensaje que piden.
      const q = url.searchParams;
      const toque = Number(q.get("toque") || 1);
      const link = q.get("link") || "reactivacion";
      const descuento =
        link === "lo-mismo" ? 0 : Number(q.get("descuento") ?? [10, 15, 20][toque - 1]);
      return fulfill(
        envelope({
          clienteId: 1,
          clienteNombre: "Ana",
          segmento: q.get("segmento") || "dormido",
          descuento,
          toque,
          link,
          opciones: opcionesMensaje,
          texto: q.size
            ? textoToque(toque, descuento)
            : "Hola Ana 👋 Volvé a Brasa. https://my.piru.app/brasa/",
          waMeUrl: envio.puedeEnviar
            ? "https://api.whatsapp.com/send?phone=5491112345678&text=Hola%20Ana"
            : null,
          envio,
          horarioSugerido: opciones.horarioSugerido,
        }),
      );
    }
    if (path === "/clientes/recompra/cola/1/marcar-enviado")
      return fulfill(envelope({}));
    if (path === "/clientes/recompra/historial") {
      const items = [
        {
          id: 31,
          clienteId: 2,
          clienteNombre: "Beto",
          telefono: "5491187654321",
          segmento: "perdido",
          toque: 2,
          descuentoEnviado: 15,
          estadoDespacho: "entregado",
          fechaHora: hace(3),
        },
        {
          id: 32,
          clienteId: 3,
          clienteNombre: "Caro",
          telefono: "5491100000003",
          segmento: "en_riesgo",
          toque: 1,
          descuentoEnviado: 0,
          estadoDespacho: "fallido",
          fechaHora: hace(4),
        },
      ].filter((h) => !segmento || h.segmento === segmento);
      return fulfill(
        envelope({ items, total: items.length, paginas: items.length ? 1 : 0 }),
      );
    }
    if (path === "/clientes/recompra/programar/preview")
      return fulfill(
        envelope({
          candidatos: [
            candidato,
            {
              ...candidato,
              clienteId: 2,
              nombre: "Lucía",
              elegible: false,
              motivo: "Pidió no recibir mensajes",
            },
          ],
          busqueda: [],
          controlSugerido: [],
          resumen: {
            totalElegibles: 1,
            totalEnTanda: 0,
            cantidad: 20,
            cantidadMin: 1,
            cantidadMax: 500,
            cupoDiario: 20,
            porcentajeControl: 0,
          },
        }),
      );
    if (
      path === "/clientes/recompra/programar" ||
      path === "/clientes/recompra/config"
    )
      return fulfill(envelope({ ok: true, campanaId: 1 }));
    if (path === "/clientes/dias-flojos") {
      const franjas = [
        { id: "noche", nombre: "Noche", horaInicio: "19:00", horaFin: "06:00" },
      ];
      return fulfill(
        envelope({
          ventana: { desde: now, hasta: now, semanas: 8 },
          franjas,
          dias: [
            "Domingo",
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
          ].map((nombre, diaSemana) => ({
            nombre,
            diaSemana,
            abierto: diaSemana !== 0,
            pedidosPromedio: 3,
            ventasPromedio: 9000,
            franjas: franjas.map((f) => ({
              ...f,
              pedidosPromedio: 3,
              ventasPromedio: 9000,
            })),
          })),
          promedioDiaAbierto: 5,
          flojos: [
            {
              diaSemana: 2,
              nombre: "Martes · Noche",
              franja: "noche",
              pedidosPromedio: 3,
              pedidosFaltantes: 2,
            },
          ],
          suficientesDatos: true,
          semanasConPedidos: 8,
          candidatos: url.searchParams.has("dia")
            ? Array.from({ length: opciones.candidatos ?? 1 }, (_, i) => ({
                ...candidato,
                clienteId: i + 1,
                nombre: i ? `Cliente ${i + 1}` : candidato.nombre,
              }))
            : undefined,
        }),
      );
    }
    if (path === "/marketing/campanas" && req.method() === "GET")
      return fulfill(envelope(campanasVivas));
    if (req.method() === "DELETE" && /^\/marketing\/campanas\/\d+$/.test(path)) {
      // Con ventas atribuidas el backend la desactiva en lugar de borrarla.
      if (resumen.campanas.some((c) => c.id === id && c.metricas.ventas > 0)) {
        campanasVivas = campanasVivas.map((c) =>
          c.id === id ? { ...c, estado: "inactiva" } : c,
        );
        return fulfill({
          success: true,
          desactivada: true,
          data: campanasVivas.find((c) => c.id === id),
        });
      }
      campanasVivas = campanasVivas.filter((c) => c.id !== id);
      return fulfill({ success: true, message: "Campaña eliminada" });
    }
    if (req.method() === "POST" && /^\/marketing\/campanas\/\d+\/desactivar$/.test(path)) {
      const campanaId = Number(path.split("/")[3]);
      campanasVivas = campanasVivas.map((c) => c.id === campanaId ? { ...c, estado: "inactiva" } : c);
      return fulfill(envelope({}));
    }
    if (path === "/marketing/resumen") return fulfill(envelope(resumen));
    if (
      path === "/marketing/organico/resultados" ||
      /^\/marketing\/campanas\/\d+\/resultados$/.test(path)
    )
      return fulfill(envelope(growth));
    if (path === "/marketing/campanas/1" && req.method() === "PUT") {
      if ("slug" in req.postDataJSON())
        return fulfill({ message: "slug no se puede editar" }, 400);
      return fulfill(envelope(campana));
    }
    if (path === "/puntos/config")
      return fulfill(
        envelope({
          activo: true,
          pesosPorPunto: 100,
          puntosPrimerPedido: 10,
          puntosMinimosCanje: 50,
          permiteCanjeEnvioGratis: true,
          puntosEnvioGratis: 100,
          permiteCanjeDescuento: false,
          descuentoPuntosCosto: 100,
          descuentoTipo: "porcentaje",
          descuentoValor: 10,
          descuentoMontoMinimo: 0,
        }),
      );
    if (path === "/puntos/resumen")
      return fulfill(
        envelope({
          clientesConPuntos: 1,
          clientesConHistorial: 1,
          puntosEnCirculacion: 100,
          puntosOtorgados: 100,
          puntosCanjeados: 0,
          canjes: 0,
          movimientos: 1,
          canjesProducto: 0,
          canjesEnvio: 0,
          canjesDescuento: 0,
          puntosOtorgados30Dias: 100,
          canjes30Dias: 0,
        }),
      );
    if (path === "/puntos/clientes")
      return fulfill(
        envelope({ items: [{ ...cliente, canjes: 0 }], paginas: 1 }),
      );
    if (path === "/puntos/movimientos")
      return fulfill(envelope({ items: [], paginas: 1 }));
    if (path === "/puntos/productos/1") return fulfill(envelope({}));
    if (path === "/puntos/cliente/1/historial")
      return fulfill(
        envelope({
          cliente: { id: 1, nombre: "Ana", puntos: 100 },
          transacciones: [
            {
              id: 2,
              clienteId: 1,
              tipo: "suma_compra",
              puntos: 90,
              saldoResultante: 100,
              motivo: "Pedido #12",
              createdAt: hace(2),
            },
            {
              id: 1,
              clienteId: 1,
              tipo: "bonus_bienvenida",
              puntos: 10,
              saldoResultante: 10,
              motivo: "",
              createdAt: hace(40),
            },
          ],
        }),
      );
    if (path === "/codigo-descuento/create" && req.method() === "POST") {
      const nuevo = { ...cuponesVivos[0], ...req.postDataJSON(), id: 99, usosActuales: 0 };
      cuponesVivos.push(nuevo);
      return fulfill(envelope(nuevo), 201);
    }
    if (path === "/codigo-descuento") return fulfill(envelope(cuponesVivos));
    if (/^\/codigo-descuento\/\d+\/resultados$/.test(path))
      return fulfill(
        envelope({
          codigo: cuponesVivos.find((c) => c.id === id),
          filtros: {
            from: url.searchParams.get("from"),
            to: url.searchParams.get("to"),
            sucursalId: Number(url.searchParams.get("sucursalId")) || null,
          },
          metricas: {
            usos: id === 7 ? 3 : 0,
            clientes: id === 7 ? 1 : 0,
            // En Norte sólo pidió Beto.
            facturacionCobrada:
              id !== 7 ? 0 : url.searchParams.get("sucursalId") === "2" ? 6750 : 20250,
            ventasAntesDescuento: 0,
            montoDescontado: 0,
            ticketPromedio: 0,
          },
          clientes:
            id === 7
              ? [
                  {
                    id: 2,
                    nombre: "Beto",
                    telefono: "5491187654321",
                    usos: 1,
                    facturacion: 6750,
                    montoDescontado: 1012,
                    ultimoUsoAt: hace(1),
                  },
                ]
              : [],
          pedidos: [],
        }),
      );
    if (req.method() === "PUT" && /^\/codigo-descuento\/\d+$/.test(path)) {
      const cambios = req.postDataJSON();
      cuponesVivos = cuponesVivos.map((c) => (c.id === id ? { ...c, ...cambios } : c));
      return fulfill(envelope(cuponesVivos.find((c) => c.id === id)));
    }
    if (req.method() === "DELETE" && /^\/codigo-descuento\/\d+$/.test(path)) {
      // INVIERNO ya se usó en pedidos: la base no deja borrarlo.
      if (id === 8)
        return fulfill({ success: false, message: "Error interno del servidor" }, 500);
      cuponesVivos = cuponesVivos.filter((c) => c.id !== id);
      return fulfill({ success: true, message: "Código eliminado" });
    }
    // El resto del panel (perfil, módulos del menú, avisos…) no es parte de esta suite.
    if (!/^\/(clientes|marketing|codigo-descuento|puntos|modulos|metricas|producto|categoria)(\/|$)/.test(path))
      return fulfill(envelope(null));
    return fulfill({ message: `Sin fixture: ${path}` }, 500);
  });
  return {
    requests,
    posts,
    borrados,
    consultas,
    /** Los parámetros de la última consulta a `path`. */
    ultimaConsulta: (path: string) =>
      consultas.filter((c) => c.path === path).at(-1)?.params,
    autorizacion: (path: string) => autorizaciones.get(path),
  };
}

const ir = (page: Page, ruta: string) =>
  page.goto(`/tests/marketing.html?ruta=${encodeURIComponent(ruta)}`);

test("cada pantalla de Marketing carga dentro del panel, sin errores", async ({ page }) => {
  const m = await mock(page);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message + "\n" + (e.stack ?? "")));
  for (const [ruta, titulo] of [
    ["/dashboard/marketing", "Brasa"],
    ["/dashboard/marketing/hoy", "Tu semana de mensajes"],
    ["/dashboard/marketing/dias-flojos", "Llená los días flojos"],
    ["/dashboard/marketing/campanas", "Cada historia, su link"],
    ["/dashboard/marketing/clientes", "Tus clientes, con nombre"],
    ["/dashboard/marketing/puntos", "El club del local"],
    ["/dashboard/marketing/cupones", "Cupones que traen pedidos"],
    ["/dashboard/marketing/estadisticas", "Los números del local"],
  ]) {
    await ir(page, ruta);
    await expect(page.getByRole("heading", { name: titulo, exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Cargando" })).toHaveCount(0);
    await expect(page.locator(".marketing-app [role=alert]")).toHaveCount(0);
    await page.screenshot({ path: `node_modules/.cache/marketing-results/${ruta.split("/").pop()}.png`, fullPage: true });
  }
  expect(errores).toEqual([]);
  // Marketing usa la sesión del panel: no pide llaves de local ni pases.
  expect(m.requests.some((r) => r.startsWith("/marketer") || r.startsWith("/marketing-duenio"))).toBe(false);
  expect(m.autorizacion("/marketing-local")).toMatch(/^Bearer test\./);
});

test("los estilos de Marketing no se escapan al resto del panel", async ({ page }) => {
  await mock(page);
  await ir(page, "/dashboard/marketing/campanas");
  await expect(page.getByRole("heading", { name: "Cada historia, su link", exact: true })).toBeVisible();
  // Un `input`, un `h2` y un `.card` fuera de `.marketing-app` no reciben las reglas de Marketing;
  // los de adentro, sí.
  const medir = (dentro: boolean) =>
    page.evaluate((dentro) => {
      const raiz = dentro ? document.querySelector(".marketing-app")! : document.body;
      const caja = document.createElement("div");
      caja.innerHTML = '<input><h2>x</h2><div class="card">x</div>';
      raiz.appendChild(caja);
      const [input, h2, card] = Array.from(caja.children).map((el) => getComputedStyle(el));
      const r = { input: input.minHeight, h2: h2.fontWeight, card: card.borderRadius };
      caja.remove();
      return r;
    }, dentro);
  expect(await medir(true)).toEqual({ input: "44px", h2: "600", card: "20px" });
  const fuera = await medir(false);
  expect(fuera.input).not.toBe("44px");
  expect(fuera.card).not.toBe("20px");
  await expect(page.getByRole("button", { name: "Marketing" }).first()).toBeVisible();
});

test("los diálogos se montan dentro de Marketing, con su estilo", async ({ page }) => {
  await mock(page);
  await ir(page, "/dashboard/marketing/clientes");
  await page.getByText("Ana", { exact: true }).first().click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  expect(await dialogo.evaluate((el) => !!el.closest(".marketing-app"))).toBe(true);
});

test("la guía y el recorrido de Marketing", async ({ page }) => {
  await mock(page);
  await ir(page, "/dashboard/marketing/guia");
  await expect(page.getByRole("heading", { name: "Cómo funciona el marketing de tu local" })).toBeVisible();
  await expect(page.getByText(/marketer/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Ver el recorrido de 1 minuto" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Este es el marketing de tu local" })).toBeVisible();
});

test("en el celular la barra de secciones se desliza sin desbordar la página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await ir(page, "/dashboard/marketing/hoy");
  await expect(page.getByRole("heading", { name: "Tu semana de mensajes", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "node_modules/.cache/marketing-results/hoy-390.png", fullPage: true });
});
