import { test, expect, type Page } from '@playwright/test'

/**
 * Motor de Recompra: la pantalla que el local usa todos los días.
 *
 * Fija lo que se cambió a pedido del operador: sin la tab "Base" (la base
 * completa ya no se lista acá), sin el badge de estado ni el interruptor
 * Automático/Manual, el segmento elegido con un select en vez de píldoras, el
 * ritmo dentro de la fila de métricas (no suelto abajo), la explicación de los
 * modos sólo detrás de "¿Cómo funciona?" y el diálogo de "Cambiar mensaje" sin
 * scroll horizontal: el link de la tienda es una palabra larguísima y estiraba
 * el diálogo.
 *
 * El tablero —el que se ve mientras hay una tanda viva— sólo MUESTRA y cancela:
 * no ofrece preparar ni configurar nada. Programar pasa por la pantalla sin
 * tandas, donde el flujo de envío ES la pantalla: ocho pasos, un valor por paso,
 * que arrancan eligiendo Manual o Automático, con la lista de clientes en una
 * caja de alto fijo que scrollea por dentro. Nada se guarda hasta el botón final,
 * y ahí van dos llamadas en orden: la config del local y después la tanda; al
 * volver no hay pantalla de resultado, la pantalla muestra el tablero con la
 * tanda nueva. En Manual el vocabulario no promete un envío programado.
 *
 * La ayuda del motor es un diálogo grande que scrollea por dentro: explica los
 * segmentos, el goteo, los dos modos, las tres decisiones y la protección de la
 * base, con los números reales del local. Se fija que el scroll sea interno (la
 * página no scrollea) y que el pie quede siempre a la vista.
 */

// Una URL de micro-campaña como la que emite `urlMicroCampana`: sin un solo
// espacio donde cortar. Es el caso que rompía el layout.
const URL_TIENDA =
  'https://my.piru.app/lomitosdelbarrio/c/reactivacion?tk=v1.9fK2sQ%2F7mZ0XyT4bW6pR1aD3eF7gH0jK2lM5nO8qS4uV6wY%3D%3D'

/** El texto que devuelve el endpoint para una combinación: el cuerpo y el link, como el real. */
const textoDe = (toque: number, descuento: number) => [
  'Hola Camila 👋 hace 54 días que no te vemos por Lomitos del Barrio.',
  `Toque ${toque} · ${descuento}% OFF en tu próximo pedido.`,
  '',
  URL_TIENDA,
].join('\n')

const TEXTO = textoDe(2, 10)

const OPCIONES = {
  segmentos: [
    { codigo: 'primer_pedido', nombre: 'Primer pedido', esDelCliente: false, esActual: false },
    { codigo: 'en_riesgo', nombre: 'En riesgo', esDelCliente: false, esActual: false },
    { codigo: 'dormido', nombre: 'Dormidos', esDelCliente: true, esActual: true },
    { codigo: 'perdido', nombre: 'Perdidos', esDelCliente: false, esActual: false },
  ],
  toques: [
    { toque: 1, titulo: '1º toque', descripcion: 'Relato y antojo. Lleva la foto del favorito.', descuento: 5, expiraHoras: 48, esActual: false, esDeLaEscalera: false },
    { toque: 2, titulo: '2º toque', descripcion: 'Recordatorio corto.', descuento: 10, expiraHoras: 48, esActual: true, esDeLaEscalera: true },
    { toque: 3, titulo: '3º toque', descripcion: 'Cierre: último llamado.', descuento: 15, expiraHoras: 48, esActual: false, esDeLaEscalera: false },
  ],
  links: [
    { modalidad: 'lo-mismo', titulo: 'Lo mismo', descripcion: 'Abre su último pedido tal como estaba', esActual: false },
    { modalidad: 'reactivacion', titulo: 'Reactivación', descripcion: 'Abre la tienda con el descuento elegido', esActual: true },
  ],
  descuentos: { min: 0, max: 30, sugeridos: [5, 10, 15], recomendado: 10 },
}

const CAMPANA = {
  estado: 'activa',
  modo: 'manual',
  cupoDiario: 30,
  enviadosHoy: 4,
  totalEnviados: 12,
  enCola: 148,
  contactados: 12,
  toquesEnviados: 12,
  volvieron: 3,
  plataRecuperada: 45200,
  control: 30,
  controlVolvieron: 2,
  tasaContactados: 0.25,
  tasaControl: 0.066,
  saldoMarketing: 120,
  activadaAt: '2026-09-01T12:00:00.000Z',
  pausadaAt: null,
}

/** La config del LOCAL: cupo, modo, días y control ya no viven en la campaña. */
const CONFIG = {
  restauranteId: 1,
  estado: 'activa',
  modo: 'manual',
  cupoDiario: 30,
  diasToque2: 2,
  diasToque3: 2,
  porcentajeControl: 10,
  ultimoDrenajeDia: null,
  avisoSinSaldoAt: null,
}

/** Una tanda programada viva: lo que ahora dice qué está agendado y cuánto falta. */
const TANDA = {
  id: 3,
  origen: 'programada',
  estado: 'activa',
  segmento: 'dormido',
  cantidadObjetivo: 50,
  toqueHasta: 2,
  diasToque2: 2,
  diasToque3: 2,
  porcentajeControl: 10,
  programadaAt: '2026-09-20T12:00:00.000Z',
  contactados: 12,
  control: 5,
  enviados: 12,
  pendientes: 38,
  fallidos: 0,
  mensajesObjetivo: 100,
  proximoDespachoAt: '2026-09-22T23:00:00.000Z',
}

const PLAN = {
  totalDetectados: 148,
  totalContactar: 133,
  totalControl: 15,
  porSegmento: [{ segmento: 'dormido', detectados: 148, facturacionEnJuego: 2100000 }],
  primerSegmento: 'dormido',
  cupoSugerido: 30,
  saldoMarketing: 120,
  diasCubiertos: 5,
  enTanda: 0,
}

/** Un candidato del asistente: el backend los manda ya en orden de prioridad. */
const candidato = (
  clienteId: number, nombre: string, segmento: string, totalGastado: number,
): Record<string, unknown> => ({
  clienteId, nombre, telefono: `11456789${String(clienteId).padStart(2, '0')}`, segmento,
  diasDesdeUltimo: 40 + clienteId, totalGastado, ticketPromedio: Math.round(totalGastado / 4),
  toquesDesdeUltimoPedido: 0, proximoNivel: 1, horarioSugerido: 'Viernes 21:00 hs',
  dueDate: '2026-09-25T21:00:00.000Z', elegible: true,
})

// Ocho, para que la lista tenga con qué reemplazar al que se destilda y quién quede de control.
const CANDIDATOS = [
  candidato(41, 'Camila Duarte', 'dormido', 38200),
  candidato(42, 'Bruno Sosa', 'perdido', 21400),
  candidato(43, 'Delfina Ruiz', 'dormido', 15800),
  candidato(44, 'Ezequiel Molina', 'perdido', 43100),
  candidato(45, 'Florencia Paz', 'dormido', 9800),
  candidato(46, 'Gonzalo Ibarra', 'perdido', 27300),
  candidato(47, 'Helena Vargas', 'dormido', 12600),
  candidato(48, 'Iván Ríos', 'dormido', 30500),
]

/** El resumen del preview, derivado de los candidatos: así no puede quedar desincronizado. */
const resumenPreview = (segmento: string | null) => {
  const delSegmento = CANDIDATOS.filter(c => c.segmento === segmento)
  const conteo = (seg: string) => CANDIDATOS.filter(c => c.segmento === seg).length
  const facturacion = (seg: string) =>
    CANDIDATOS.filter(c => c.segmento === seg).reduce((acc, c) => acc + (c.totalGastado as number), 0)
  return {
    porSegmento: ['primer_pedido', 'en_riesgo', 'dormido', 'perdido']
      .filter(seg => conteo(seg) > 0)
      .map(seg => ({ segmento: seg, elegibles: conteo(seg), facturacionEnJuego: facturacion(seg) })),
    totalElegibles: segmento ? delSegmento.length : CANDIDATOS.length,
    totalEnTanda: 0,
    cantidad: 0, cantidadMin: 1, cantidadMax: 500,
    cupoDiario: 30, enviadosHoy: 4, cupoRestanteHoy: 26,
    saldoMarketing: 120, modo: 'manual',
    diasToque2: 2, diasToque3: 2, diasMinEntreToques: 2, porcentajeControl: 10,
    horarioSilencio: false,
  }
}

const FILA = {
  id: 7, clienteId: 41, clienteNombre: 'Camila Duarte', telefono: '1145678901',
  segmento: 'dormido', poblacion: 'stock', rol: 'contactado', toque: 2,
  prioridad: 2, dueDate: null, fechaProyectada: '2026-09-20', posicionPrioridad: 1,
  horarioSugerido: '20:00', totalGastado: 38200,
  ultimoPedidoAt: '2026-07-28T23:30:00.000Z', createdAt: '2026-09-18T10:00:00.000Z',
}

const MENSAJE = {
  clienteId: 41, clienteNombre: 'Camila Duarte', telefono: '1145678901',
  segmento: 'dormido', tiempoSinPedir: '54 días', productoFavorito: 'bife de chorizo con papas rústicas',
  incentivo: '10% OFF en tu próximo pedido', descuento: 10, codigoDescuento: 'VOLVE10',
  nivel: 2, toque: 2, toquePlanificado: 2, plantillaWhatsapp: 'recompra_dormido_2',
  conImagen: false, link: 'reactivacion', descuentoOrigen: 'escalon', expiraHoras: 48,
  segmentoFila: 'dormido',
  receta: { codigo: 'dormido', nombre: 'Dormidos', descripcion: '', textoBase: '', esRecomendada: true, esSeleccionada: true, descuento: 10, expiraHoras: 48, nivel: 2 },
  recetas: [],
  opciones: OPCIONES,
  urlTienda: URL_TIENDA,
  texto: TEXTO,
  waMeUrl: `https://wa.me/5491145678901?text=${encodeURIComponent(TEXTO)}`,
  horarioSugerido: '20:00',
}

/**
 * El copy del modo del local mockeado (`CONFIG.modo`). Es la expectativa independiente del
 * `COPY_ENVIO` de la pantalla: si la implementación cambiara el vocabulario de un modo, esto no la
 * seguiría.
 */
const COPY = {
  final: (n: number) => `Preparar ${n} mensaje${n === 1 ? '' : 's'}`,
}

/** Los ocho pasos del flujo, en orden: es el `data-paso` que expone cada uno. */
const PASOS = ['modo', 'cupo', 'dias', 'a-quienes', 'lista', 'toques', 'control', 'resumen'] as const

/** Cuánto se desborda horizontalmente lo que se mide, en píxeles. */
async function desbordeHorizontal(page: Page) {
  return page.evaluate(() => {
    const raiz = document.documentElement
    const dialogo = document.querySelector<HTMLElement>('[role="dialog"]')
    const caja = document.querySelector<HTMLElement>('[role="dialog"] .whitespace-pre-wrap')
    return {
      pagina: raiz.scrollWidth - raiz.clientWidth,
      dialogo: dialogo ? dialogo.scrollWidth - dialogo.clientWidth : 0,
      texto: caja ? caja.scrollWidth - caja.clientWidth : 0,
    }
  })
}

for (const width of [1440, 390]) {
  test.describe(`${width < 768 ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: { width, height: 1000 } })

    /**
     * Las rutas del motor. `captura.orden` guarda el orden en que se tocó el backend: lo que se fija
     * con eso es que nada viaje hasta el botón final y que la config vaya ANTES que la tanda.
     */
    async function rutas(page: Page, { estado = 'activa', sinTandas = false } = {}) {
      const captura: {
        programacion: Record<string, unknown> | null
        config: Record<string, unknown> | null
        orden: string[]
      } = { programacion: null, config: null, orden: [] }
      // Programar una tanda la hace existir: al recargar, la pantalla deja de estar "sin tandas" y
      // vuelve al tablero. Es lo que reemplaza a la pantalla de resultado que ya no existe.
      let creada = false
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url()).pathname
        if (url.endsWith('/clientes/recompra/estado')) {
          const hayTanda = !sinTandas || creada
          return route.fulfill({
            json: {
              success: true,
              data: {
                activa: hayTanda,
                config: { ...CONFIG, estado },
                campana: hayTanda ? { ...CAMPANA, estado } : null,
                programaciones: hayTanda ? [TANDA] : [],
                plan: PLAN,
                saldoMarketing: CAMPANA.saldoMarketing,
              },
            },
          })
        }
        if (url.endsWith('/clientes/recompra/programar/preview')) {
          const q = new URL(route.request().url()).searchParams
          const segmento = q.get('segmento')
          return route.fulfill({
            json: {
              success: true,
              data: {
                segmento,
                candidatos: segmento ? CANDIDATOS.filter(c => c.segmento === segmento) : CANDIDATOS,
                controlSugerido: [],
                busqueda: [],
                resumen: resumenPreview(segmento),
              },
            },
          })
        }
        if (url.endsWith('/clientes/recompra/programar') && route.request().method() === 'POST') {
          captura.orden.push('programar')
          creada = true
          captura.programacion = route.request().postDataJSON()
          // Lo que se mira es el PEDIDO, así que la respuesta es lo mínimo: el flujo ya no tiene una
          // pantalla de resultado que muestre lo que el backend contestó.
          return route.fulfill({ json: { success: true, data: { ok: true, campanaId: 4 } } })
        }
        if (url.endsWith('/clientes/recompra/config')) {
          captura.orden.push('config')
          captura.config = route.request().postDataJSON()
          const pedido = (captura.config ?? {}) as { cupoDiario?: number }
          return route.fulfill({
            json: { success: true, data: { config: { ...CONFIG, cupoDiario: pedido.cupoDiario ?? CONFIG.cupoDiario } } },
          })
        }
        if (url.endsWith('/clientes/recompra/cola')) {
          return route.fulfill({ json: { success: true, data: { items: [FILA], pagina: 1, limite: 25, total: 1, paginas: 1 } } })
        }
        if (/\/clientes\/recompra\/cola\/\d+\/mensaje$/.test(url)) {
          // La vista previa se rearma con cada cambio: el texto sale de las decisiones pedidas.
          const q = new URL(route.request().url()).searchParams
          const toque = Number(q.get('toque') ?? 2)
          const descuento = Number(q.get('descuento') ?? 10)
          return route.fulfill({ json: { success: true, data: { ...MENSAJE, toque, descuento, texto: textoDe(toque, descuento) } } })
        }
        if (url.endsWith('/clientes/recompra/historial')) {
          return route.fulfill({ json: { success: true, data: { items: [], pagina: 1, limite: 25, total: 0, paginas: 0 } } })
        }
        return route.fulfill({ json: { success: true, data: {} } })
      })
      return captura
    }

    /** Monta el motor con tandas vivas y espera la primera fila de la cola. */
    async function montar(page: Page, estado = 'activa') {
      const captura = await rutas(page, { estado })
      await page.goto('/tests/motor-recompra.html')
      await expect(page.getByRole('button', { name: /Camila Duarte/ })).toBeVisible()
      return captura
    }

    /** Monta el motor sin ninguna tanda: la pantalla que ES el flujo, sin tablero. */
    async function montarSinTandas(page: Page) {
      const captura = await rutas(page, { sinTandas: true })
      await page.goto('/tests/motor-recompra.html')
      await expect(page.getByText('148 clientes para recuperar')).toBeVisible()
      return captura
    }

    /** En mobile el detalle vive en la columna que se abre al elegir una fila. */
    async function abrirDetalle(page: Page) {
      await page.getByRole('button', { name: /Camila Duarte/ }).click()
      await expect(page.getByRole('button', { name: 'Marcar como enviado' })).toBeVisible()
    }

    /** La columna del motor (tandas, métricas y ayuda) sin depender de elegir una fila. */
    async function abrirMotor(page: Page) {
      if ((page.viewportSize()?.width ?? 0) < 1280) {
        await page.getByRole('button', { name: /Motor y Detalle/ }).click()
      }
      // En el tablero no hay botón que abra nada: lo que se espera es el panel de tandas.
      await expect(page.getByText('Tandas programadas')).toBeVisible()
    }

    /** El flujo tal como se monta en la pantalla sin tandas: no hay nada que abrir. */
    async function flujoEnPantalla(page: Page) {
      const flujo = page.getByTestId('asistente-envio')
      await expect(flujo).toBeVisible()
      await expect(flujo).toHaveAttribute('data-paso', PASOS[0])
      return flujo
    }

    /**
     * Lleva el flujo al paso pedido (por índice): para adelante con "Siguiente" y para atrás con
     * "Atrás". Después de cada clic espera el paso nuevo: sin eso, lo que se mida o se escriba
     * después podría caer en el paso anterior.
     */
    async function irAPaso(page: Page, destino: number) {
      const flujo = page.getByTestId('asistente-envio')
      for (;;) {
        const actual = PASOS.indexOf((await flujo.getAttribute('data-paso')) as typeof PASOS[number])
        if (actual === destino) return flujo
        await flujo.getByRole('button', { name: actual < destino ? 'Siguiente' : 'Atrás' }).click()
        await expect(flujo).toHaveAttribute('data-paso', PASOS[actual < destino ? actual + 1 : actual - 1])
      }
    }

    /**
     * Confirma el último paso y espera a que la tanda haya viajado. Es la única forma segura de mirar
     * lo que viajó: el flujo manda la config y RECIÉN DESPUÉS la tanda, así que apenas vuelve el clic
     * todavía no salió la segunda llamada —y no hay pantalla de resultado que esperar, porque el
     * flujo se cierra y la pantalla vuelve al tablero—.
     */
    async function confirmar(page: Page, boton: string, captura: { orden: string[] }) {
      await page.getByTestId('asistente-envio').getByRole('button', { name: boton }).click()
      await expect.poll(() => captura.orden.includes('programar')).toBe(true)
    }

    test('el tablero no ofrece programar, configurar ni cambiar de modo', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      // El estado que antes rotulaba "Pausado sin saldo", con la campaña en modo Manual.
      await montar(page, 'pausada_sin_saldo')
      await abrirMotor(page)

      // La tab "Base" no lista la base completa, y el badge de estado ya no existe.
      await expect(page.getByRole('button', { name: 'Base', exact: true })).toHaveCount(0)
      await expect(page.getByText('Pausado sin saldo')).toHaveCount(0)
      await expect(page.getByText('Pausado', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Activo', { exact: true })).toHaveCount(0)

      // Tampoco el interruptor Automático/Manual ni la atribución con el grupo de control.
      await expect(page.getByRole('button', { name: /^Automático/ })).toHaveCount(0)
      await expect(page.getByText('Atribución honesta')).toHaveCount(0)
      await expect(page.getByText('Modo Manual · Sin costo de créditos')).toHaveCount(0)

      // Los tres accesos a programar/configurar que tenía el tablero: el botón de la cabecera del
      // panel, el "Config" de cada tanda y el "Configuración" de arriba. Programar sólo es posible
      // sin tandas vivas, o sea después de cancelarlas.
      await expect(page.getByTestId('abrir-envio')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Config/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Configuración' })).toHaveCount(0)

      // Lo que sí queda: cancelar la tanda, que es la única acción del panel.
      await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()
      expect(errors).toEqual([])
    })

    test('el segmento se elige con un select, no con píldoras', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)

      const select = page.getByRole('combobox', { name: 'Segmento de clientes' })
      await expect(select).toBeVisible()
      await expect(select).toContainText('Todos los segmentos')
      // Las píldoras que listaban los segmentos ya no existen.
      await expect(page.getByRole('button', { name: 'En riesgo', exact: true })).toHaveCount(0)

      await select.click()
      await page.getByRole('option', { name: 'Perdidos' }).click()
      await expect(select).toContainText('Perdidos')
      expect(errors).toEqual([])
    })

    test('el ritmo es del local y se muestra sin acción para ajustarlo', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirMotor(page)

      for (const label of ['Contactados', 'Volvieron', 'Recuperado', 'En cola', 'Ritmo']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible()
      }
      // El ritmo es una métrica con su número, dentro de la misma fila...
      const ritmo = page.getByText('Ritmo', { exact: true }).locator('..')
      await expect(ritmo).toContainText('30')
      await expect(ritmo).toContainText('/día')
      // ...y ya no vive suelto en una fila propia.
      await expect(page.getByText(/clientes\/día/)).toHaveCount(0)

      // No se ajusta desde el tablero: el cupo se decide en el flujo, que es donde se elige la tanda
      // que lo va a usar. En el tablero se lee y nada más.
      await expect(ritmo.getByRole('button')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('las tandas programadas se ven arriba, con lo que falta y su próximo despacho', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirMotor(page)

      // La tanda viva dice a quiénes agarró, cuánto salió y cuándo vuelve a salir algo.
      await expect(page.getByText('Tandas programadas')).toBeVisible()
      // Se busca dentro del panel de tandas: el nombre del segmento también está en cada fila de la cola
      // y en el detalle del cliente. El rótulo es hijo directo de la sección, que es la que los acota.
      const seccion = page.getByText('Tandas programadas').locator('..')
      const tanda = seccion.getByText('Dormidos', { exact: true }).locator('../../..')
      await expect(tanda).toContainText('En curso')
      await expect(tanda).toContainText('12')
      await expect(tanda).toContainText('de 50 contactados')
      await expect(tanda).toContainText('38 en cola')
      await expect(tanda).toContainText('hasta el 2º toque')
      await expect(tanda).toContainText('Próximo despacho')
      // Cancelar sólo tiene sentido mientras quede algo por salir.
      await expect(tanda.getByRole('button', { name: 'Cancelar' })).toBeVisible()

      expect(errors).toEqual([])
    })

    test('el flujo de envío va paso por paso y no guarda nada hasta el final', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montarSinTandas(page)
      const flujo = await flujoEnPantalla(page)

      // Paso 1: el modo. Arranca en el del local y se elige entre las dos tarjetas grandes.
      for (const nombre of ['Manual', 'Automático']) {
        await expect(flujo.getByRole('button', { name: new RegExp(`^${nombre}`) })).toBeVisible()
      }
      await expect(flujo.getByRole('button', { name: /^Manual/ })).toHaveAttribute('aria-pressed', 'true')
      await expect(flujo.getByRole('progressbar', { name: 'Progreso del asistente' })).toHaveAttribute('aria-valuenow', '1')

      // Paso 2: el cupo. Subirlo queda en el paso, no en el backend.
      await irAPaso(page, 1)
      const cupo = flujo.getByRole('group', { name: 'Cupo diario' })
      await cupo.getByRole('button', { name: '+' }).click()
      await cupo.getByRole('button', { name: '+' }).click()
      await expect(cupo).toContainText('40')

      // Paso 3: los días entre toques. El piso de 48 hs no es copy: es el mínimo del control, así que
      // con los 2 días del local el "−" queda muerto.
      await irAPaso(page, 2)
      const dias = flujo.getByRole('group', { name: 'Días hasta el 2º toque' })
      await expect(dias.getByRole('button', { name: '−' })).toBeDisabled()
      await dias.getByRole('button', { name: '+' }).click()
      await expect(dias).toContainText('3')
      await expect(dias.getByRole('button', { name: '−' })).toBeEnabled()

      // Paso 4: a quiénes y cuántos. La cantidad es la misma cuenta que hace el backend.
      await irAPaso(page, 3)
      await flujo.locator('input[type="number"]').fill('5')
      // El segmento que se elige acá es el que acota la lista del paso siguiente.
      await expect(flujo.getByRole('button', { name: /^Dormidos/ })).toBeVisible()

      // Paso 5: la lista. Con 5 pedidos y 8 candidatos, los primeros 5 reciben, el 6º queda de control
      // y los dos últimos esperan su turno, sin tilde.
      await irAPaso(page, 4)
      const tildes = flujo.getByRole('checkbox')
      await expect(tildes).toHaveCount(8)
      const fila = (nombre: string) => flujo.getByText(nombre, { exact: true }).locator('../../..')
      await expect(fila('Gonzalo Ibarra')).toContainText('Control')
      await expect(fila('Helena Vargas')).toContainText('Espera')

      // Destildar al control lo saca del lote —no lo convierte en contactado— y el que sigue pasa a
      // ser el control: la cuenta no baja.
      await tildes.nth(5).click()
      await expect(fila('Gonzalo Ibarra')).toContainText('Espera')
      await expect(fila('Helena Vargas')).toContainText('Control')
      // Volver a tildarlo deshace el movimiento, sin quedar como agregado a mano.
      await tildes.nth(5).click()
      await expect(fila('Gonzalo Ibarra')).toContainText('Control')
      await expect(fila('Helena Vargas')).toContainText('Espera')

      // Destildar a uno del lote lo saca de la tanda y entra el siguiente: la cuenta no baja.
      await tildes.nth(0).click()
      await expect(fila('Camila Duarte')).toContainText('Espera')

      // Tildar a uno que esperaba lo agrega ADEMÁS de la cantidad pedida.
      await tildes.nth(7).click()
      await expect(fila('Iván Ríos')).toContainText('A mano')

      // Paso 6: hasta qué toque. "1º y 2º" agrega el recordatorio y muestra los días elegidos.
      await irAPaso(page, 5)
      await flujo.getByRole('button', { name: /1º y 2º/ }).click()
      await expect(flujo).toContainText('El 2º toque sale 3 días después del primero')

      // Paso 7: el control, con la cuenta del lote a la vista: 10% de 6 es 1.
      await irAPaso(page, 6)
      await expect(flujo).toContainText('% apartado del lote · 1 cliente')

      // Nada viajó todavía: el flujo no escribe hasta el botón final, ni la config ni la tanda.
      await irAPaso(page, 7)
      expect(captura.orden).toEqual([])

      // Paso 8: el resumen. Dice lo que va a pasar y que la config del local también se guarda.
      const resumen = flujo.getByText(/^Vas a /).locator('..')
      await expect(resumen).toContainText('6 mensajes')
      await expect(resumen).toContainText('5 de la lista + 1 que agregaste vos')
      await expect(resumen).toContainText('1 en el grupo de control')
      await expect(resumen).toContainText('un mensaje por cliente y un recordatorio a los 3 días')
      await expect(flujo).toContainText('Al confirmar también se guardan los valores del local')

      await confirmar(page, COPY.final(6), captura)

      // Lo que viajó, y en qué orden: primero la config del local —sólo porque cambió— y después la
      // tanda. Al revés, un fallo dejaría la tanda agendada con el modo viejo.
      expect(captura.orden).toEqual(['config', 'programar'])
      expect(captura.config).toEqual({
        cupoDiario: 40, diasToque2: 3, diasToque3: 2, porcentajeControl: 10, modo: 'manual',
      })
      expect(captura.programacion).toEqual({
        segmento: null,
        cantidad: 5,
        toqueHasta: 2,
        diasToque2: 3,
        diasToque3: null,
        porcentajeControl: 10,
        incluirIds: [48],
        excluirIds: [41],
      })

      // No hay pantalla de resultado: confirmar cierra el flujo y la pantalla vuelve al tablero —el
      // mock da la tanda por creada—, que es donde se lee lo que quedó agendado y cuándo sale.
      await abrirMotor(page)
      await expect(page.getByTestId('asistente-envio')).toHaveCount(0)

      expect(errors).toEqual([])
    })

    test('en modo Manual el flujo no promete un envío programado', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montarSinTandas(page)
      const flujo = await flujoEnPantalla(page)

      // El modo y el paso final hablan de PREPARAR: en Manual no se agenda ningún envío, los mensajes
      // los prepara el motor y los manda el dueño desde su WhatsApp.
      await expect(flujo.getByRole('button', { name: /^Manual/ })).toHaveAttribute('aria-pressed', 'true')
      await expect(flujo.getByRole('button', { name: /Programar/ })).toHaveCount(0)

      // Sin tocar nada: los 8 candidatos entran (la cantidad por defecto es mayor que la lista) y el
      // 10% de control redondea a 1.
      await irAPaso(page, 7)
      await expect(flujo).toContainText('Vas a preparar')
      await confirmar(page, COPY.final(8), captura)

      // Confirmar cierra el flujo y lleva al tablero, sin pantalla intermedia que repita lo decidido.
      await abrirMotor(page)
      await expect(page.getByTestId('asistente-envio')).toHaveCount(0)
      await expect(page.getByText('Listo para enviar')).toHaveCount(0)
      await expect(page.getByText('Ver los mensajes')).toHaveCount(0)

      expect(captura.orden).toEqual(['programar'])
      expect(errors).toEqual([])
    })

    test('elegir Automático en el paso 1 cambia el vocabulario y el modo que viaja', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montarSinTandas(page)
      const flujo = await flujoEnPantalla(page)

      await flujo.getByRole('button', { name: /^Automático/ }).click()
      await expect(flujo.getByRole('button', { name: /^Automático/ })).toHaveAttribute('aria-pressed', 'true')

      await irAPaso(page, 7)
      // Mismo flujo, otro vocabulario: ahora sí se programa un envío.
      await confirmar(page, 'Programar 8 mensajes', captura)

      // La config viaja con el modo nuevo, y antes que la tanda.
      expect(captura.orden).toEqual(['config', 'programar'])
      expect(captura.config).toEqual({
        cupoDiario: 30, diasToque2: 2, diasToque3: 2, porcentajeControl: 10, modo: 'automatico',
      })
      // Y la pantalla vuelve al tablero, como en cualquier confirmación.
      await abrirMotor(page)
      expect(errors).toEqual([])
    })

    test('la lista de clientes tiene alto fijo y scrollea por dentro', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montarSinTandas(page)
      const flujo = await flujoEnPantalla(page)
      await irAPaso(page, 4)

      const caja = flujo.locator('[data-lista-lote]')
      await expect(caja).toBeVisible()
      const alto = () => caja.evaluate(el => el.clientHeight)
      const llego = await caja.evaluate(el => {
        const scroll = el.querySelector<HTMLElement>('[data-scroll-lote]')!
        return { alto: el.clientHeight, contenido: scroll.scrollHeight, visible: scroll.clientHeight }
      })

      // La caja mide mucho menos que su contenido: hay para scrollear adentro.
      expect(llego.contenido).toBeGreaterThan(llego.visible)
      expect(llego.visible).toBe(llego.alto)
      if (width === 1440) expect(llego.alto).toBeLessThan(420)
      // ...y la página no scrollea en horizontal por la lista.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)

      // Con otro segmento la lista se acorta, pero la caja mide lo mismo: el alto no depende de
      // cuántos clientes haya, así que el pie con el botón de confirmar no se corre.
      const lleno = await alto()
      await irAPaso(page, 3)
      await flujo.getByRole('button', { name: /^Perdidos/ }).click()
      await irAPaso(page, 4)
      await expect(flujo.getByRole('checkbox')).toHaveCount(3)
      expect(await alto()).toBe(lleno)

      expect(errors).toEqual([])
    })

    test('sin tandas el flujo ya está en la pantalla, sin diálogo que abrir', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montarSinTandas(page)

      // La pantalla arranca en el paso 1: no hay botón que lo abra ni diálogo de por medio.
      const flujo = page.getByTestId('asistente-envio')
      await expect(flujo).toBeVisible()
      await expect(flujo).toHaveAttribute('data-paso', 'modo')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByText('148 clientes para recuperar')).toBeVisible()

      // Sin nada que cancelar no hay "Cancelar", y en el paso 1 tampoco hay "Atrás"...
      await expect(flujo.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
      await expect(flujo.getByRole('button', { name: 'Atrás' })).toHaveCount(0)
      // ...hasta que se avanza.
      await flujo.getByRole('button', { name: 'Siguiente' }).click()
      await expect(flujo).toHaveAttribute('data-paso', 'cupo')
      await expect(flujo.getByRole('button', { name: 'Atrás' })).toBeVisible()
      await expect(flujo.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)

      expect(errors).toEqual([])
    })

    test('el segmento elegido acota la lista y viaja en la programación', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montarSinTandas(page)
      const flujo = await flujoEnPantalla(page)

      await irAPaso(page, 3)
      await flujo.getByRole('button', { name: /^Perdidos/ }).click()
      await irAPaso(page, 4)
      // Sólo quedan los perdidos: los dormidos ya no se listan.
      const tildes = flujo.getByRole('checkbox')
      await expect(tildes).toHaveCount(3)
      await expect(flujo.getByText('Bruno Sosa', { exact: true })).toBeVisible()
      await expect(flujo.getByText('Camila Duarte', { exact: true })).toHaveCount(0)

      await irAPaso(page, 3)
      await flujo.locator('input[type="number"]').fill('2')
      await irAPaso(page, 7)
      await confirmar(page, COPY.final(2), captura)

      // Sin toques extra, los días no viajan: no se escriben como si fueran a usarse. Y como la config
      // del local no cambió, el `PUT` de la config no se hace.
      expect(captura.orden).toEqual(['programar'])
      expect(captura.programacion).toEqual({
        segmento: 'perdido',
        cantidad: 2,
        toqueHasta: 1,
        diasToque2: null,
        diasToque3: null,
        porcentajeControl: 10,
        incluirIds: [],
        excluirIds: [],
      })
      expect(errors).toEqual([])
    })

    test('la explicación del motor vive en "¿Cómo funciona?"', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      // El texto del recuadro de Modo Manual que competía con la operación.
      await expect(page.getByText('Cada cliente llega con el mensaje de su segmento ya preparado')).toHaveCount(0)

      await abrirMotor(page)
      await page.getByRole('button', { name: '¿Cómo funciona?' }).click()

      const dialogo = page.getByRole('dialog')

      // La ayuda es un recorrido: cada bloque explica una parte del motor.
      for (const titulo of [
        'Vos programás, el motor envía',
        'A quién le habla',
        'Hasta 3 intentos',
        'Cómo sale el mensaje',
        'Medición y límites',
      ]) {
        await expect(dialogo.getByRole('heading', { name: titulo })).toBeVisible()
      }

      // Lo primero que dice es lo que cambió: nada sale sin una tanda programada.
      await expect(dialogo).toContainText('El motor no sale a buscar clientes por su cuenta')
      await expect(dialogo).toContainText('Vos elegís a quiénes y cuántos')
      // La escalera sigue siendo la del motor: arranca sin descuento y cierra en 20% con vencimiento.
      await expect(dialogo).toContainText('Sin descuento')
      await expect(dialogo).toContainText('20%')
      await expect(dialogo).toContainText('vence en 48 hs')
      await expect(dialogo).toContainText('4 mensajes de marketing')
      // El piso de 48 hs entre toques y el alcance configurable de la tanda.
      await expect(dialogo).toContainText('Hasta 3 mensajes por cliente, con al menos 48 horas')
      await expect(dialogo).toContainText('Cada tanda elige hasta qué toque llega')
      // El modo activo se marca dentro de su tarjeta, y sólo en la suya.
      const manual = dialogo.getByRole('heading', { name: 'Manual', exact: true }).locator('../..')
      await expect(manual).toContainText('activo')
      const automatico = dialogo.getByRole('heading', { name: 'Automático', exact: true }).locator('../..')
      await expect(automatico).not.toContainText('activo')
      // Y el cupo y el saldo reales entran en la explicación del modo automático.
      await expect(automatico).toContainText('hasta 30 por día')
      await expect(automatico).toContainText('hoy tenés 120')

      // La comparación con el control usa los números medidos del local.
      await expect(dialogo).toContainText('25%')
      await expect(dialogo).toContainText('7%')
      await expect(dialogo).toContainText('Un 10% de cada tanda queda sin contactar')

      // `animations: 'disabled'` termina el fade de entrada antes de capturar.
      if (width === 1440) await page.screenshot({ path: 'tests/motor-recompra-ayuda.png', animations: 'disabled' })
      await page.getByRole('button', { name: 'Entendido' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('la ayuda es un diálogo grande y scrollea por dentro, no por la página', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)
      await page.getByRole('button', { name: '¿Cómo funciona?' }).click()

      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toBeVisible()

      const caja = await page.evaluate(() => {
        const d = document.querySelector<HTMLElement>('[role="dialog"]')!
        // El cuerpo scrolleable es el hijo que declara el overflow.
        const cuerpo = d.querySelector<HTMLElement>('.overflow-y-auto')!
        return {
          ancho: d.clientWidth,
          alto: d.clientHeight,
          altoVista: window.innerHeight,
          cuerpoDesborde: cuerpo.scrollHeight - cuerpo.clientHeight,
          desbordeDialogo: d.scrollWidth - d.clientWidth,
          desbordePagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })

      // Bastante más ancho que el `sm:max-w-md` (448px) que tenía antes.
      if (width === 1440) expect(caja.ancho).toBeGreaterThan(600)
      // Nunca más alto que la ventana...
      expect(caja.alto).toBeLessThanOrEqual(caja.altoVista)
      // ...y el contenido sobra de verdad: hay para scrollear adentro.
      expect(caja.cuerpoDesborde).toBeGreaterThan(0)
      // Sin scroll horizontal, ni en el diálogo ni en la página.
      expect(caja.desbordeDialogo).toBeLessThanOrEqual(1)
      expect(caja.desbordePagina).toBeLessThanOrEqual(1)

      // La cabecera y el pie quedan fuera del scroll: se ven siempre.
      await expect(dialogo.getByRole('heading', { name: 'Cómo funciona el motor' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Entendido' })).toBeVisible()

      // Bajando hasta el final, el pie sigue a la vista y aparece el último bloque.
      await page.evaluate(() => {
        const cuerpo = document.querySelector<HTMLElement>('[role="dialog"] .overflow-y-auto')!
        cuerpo.scrollTop = cuerpo.scrollHeight
      })
      await expect(dialogo.getByRole('heading', { name: 'Medición y límites' })).toBeVisible()
      await expect(dialogo).toContainText('Hoy volvieron')
      await expect(page.getByRole('button', { name: 'Entendido' })).toBeVisible()

      if (width === 1440) await page.screenshot({ path: 'tests/motor-recompra-ayuda-scroll.png', animations: 'disabled' })
      expect(errors).toEqual([])
    })

    test('el detalle del cliente muestra las tres decisiones elegidas', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      const caja = page.getByText('Mensaje, link y descuento').locator('..')
      await expect(caja.getByText('Voz', { exact: true }).locator('..')).toContainText('Dormidos')
      await expect(caja.getByText('Toque', { exact: true }).locator('..')).toContainText('2º toque')
      await expect(caja.getByText('Link', { exact: true }).locator('..')).toContainText('Reactivación · 10% OFF')

      // Cambiarlas en el diálogo se refleja en el detalle sin volver a abrirlo.
      await page.getByRole('button', { name: /Cambiar mensaje/ }).click()
      const dialogo = page.getByRole('dialog')
      await dialogo.getByRole('button', { name: /3º toque/ }).click()
      await dialogo.getByRole('button', { name: '15%', exact: true }).click()
      await page.getByRole('button', { name: 'Usar este mensaje' }).click()

      await expect(caja.getByText('Toque', { exact: true }).locator('..')).toContainText('3º toque')
      await expect(caja.getByText('Link', { exact: true }).locator('..')).toContainText('15% OFF')
      expect(errors).toEqual([])
    })

    test('el mensaje se previsualiza siempre y se rearma con cada cambio', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      await page.getByRole('button', { name: /Cambiar mensaje/ }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toBeVisible()

      // La vista previa está a la vista sin abrir nada.
      const vista = dialogo.locator('.whitespace-pre-wrap')
      await expect(vista).toBeVisible()
      await expect(vista).toContainText('Toque 2')

      // Cambiar una opción rearma el mensaje solo (`toque` viaja a la vista previa).
      await dialogo.getByRole('button', { name: /3º toque/ }).click()
      await expect(vista).toContainText('Toque 3')
      // ...y el descuento a mano también.
      await dialogo.getByRole('button', { name: '15%', exact: true }).click()
      await expect(vista).toContainText('15% OFF')

      expect(errors).toEqual([])
    })

    test('"Cambiar mensaje" no scrollea en horizontal y el link va acortado', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      await page.getByRole('button', { name: /Cambiar mensaje/ }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toBeVisible()

      const vista = dialogo.locator('.whitespace-pre-wrap')
      await expect(vista).toBeVisible()
      // El link se muestra cortado con puntos suspensivos...
      await expect(vista).toContainText('…')
      await expect(vista).not.toContainText('%3D%3D')
      // ...y el link entero sigue disponible para abrirlo o verlo.
      const link = vista.locator('a')
      await expect(link).toHaveAttribute('href', URL_TIENDA)
      await expect(link).toHaveAttribute('title', URL_TIENDA)

      const desborde = await desbordeHorizontal(page)
      expect(desborde.dialogo).toBeLessThanOrEqual(1)
      expect(desborde.pagina).toBeLessThanOrEqual(1)
      expect(desborde.texto).toBeLessThanOrEqual(1)

      if (width === 1440) await page.screenshot({ path: 'tests/motor-recompra-dialogo.png', animations: 'disabled' })
      else await page.screenshot({ path: 'tests/motor-recompra-dialogo-390.png', animations: 'disabled' })

      await page.getByRole('button', { name: 'Cancelar' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test('el atajo del mensaje lleva a las campañas del motor en Adquisición', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      await page.getByRole('button', { name: /Cambiar mensaje/ }).click()
      const dialogo = page.getByRole('dialog')
      // El atajo vive en el paso del mensaje, al lado del título.
      await dialogo.getByRole('button', { name: 'Entender cómo funciona el link' }).click()

      // El diálogo se cierra porque el destino es otra tab del workspace, y la tab queda en la
      // mitad de Campañas: ahí están `lo-mismo` y `reactivacion` explicadas.
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByTestId('destino-clientes')).toHaveText('?tab=adquisicion&vista=campanas')
      expect(errors).toEqual([])
    })

    test('"Marcar como enviado" se pinta naranja', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      const boton = page.getByRole('button', { name: 'Marcar como enviado' })
      const clases = await boton.evaluate(el => el.className)
      expect(clases).toContain('bg-orange-500')

      // El color se comprueba sobre el estilo calculado, no sobre la clase: el
      // navegador puede devolverlo en `oklch`, así que se pinta en un canvas
      // para leerlo en RGB.
      const { color, r, g, b } = await boton.evaluate(el => {
        const color = getComputedStyle(el).backgroundColor
        const lienzo = document.createElement('canvas')
        lienzo.width = lienzo.height = 1
        const ctx = lienzo.getContext('2d')!
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data)
        return { color, r, g, b }
      })
      expect(color).not.toBe('rgba(0, 0, 0, 0)') // se pintó de verdad
      expect(r).toBeGreaterThan(200)
      expect(g).toBeGreaterThan(60)
      expect(g).toBeLessThan(r)
      expect(b).toBeLessThan(80)

      if (width === 1440) await page.screenshot({ path: 'tests/motor-recompra.png', animations: 'disabled' })
      expect(errors).toEqual([])
    })
  })
}
