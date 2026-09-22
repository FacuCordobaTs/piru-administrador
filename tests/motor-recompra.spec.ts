import { test, expect, type Page } from '@playwright/test'

/**
 * Motor de Recompra: la pantalla que el local usa todos los días.
 *
 * Fija lo que se cambió a pedido del operador: sin la tab "Base" (la base
 * completa ya no se lista acá), sin el badge "Pausado sin saldo", el segmento
 * elegido con un select en vez de píldoras, el ritmo dentro de la fila de
 * métricas (no suelto abajo), la explicación de los modos sólo detrás de
 * "¿Cómo funciona?" y el diálogo de "Cambiar mensaje" sin scroll horizontal:
 * el link de la tienda es una palabra larguísima y estiraba el diálogo.
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
     * Monta el motor con tandas vivas y espera la primera fila de la cola. Devuelve el cuerpo del
     * último `POST /recompra/programar`, para poder mirar qué se pidió sin depender de la respuesta.
     */
    async function montar(page: Page, estado = 'activa') {
      const captura: { programacion: Record<string, unknown> | null; config: Record<string, unknown> | null } = {
        programacion: null,
        config: null,
      }
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url()).pathname
        if (url.endsWith('/clientes/recompra/estado')) {
          return route.fulfill({
            json: {
              success: true,
              data: {
                activa: true,
                config: { ...CONFIG, estado },
                campana: { ...CAMPANA, estado },
                programaciones: [TANDA],
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
          captura.programacion = route.request().postDataJSON()
          // La respuesta se deriva del pedido: así lo que muestra la pantalla de resultado es lo que
          // el asistente pidió, y no un número puesto a mano que podría tapar una divergencia.
          const p = (captura.programacion ?? {}) as {
            cantidad?: number; toqueHasta?: number; porcentajeControl?: number
            segmento?: string | null; incluirIds?: number[]
          }
          // Los agregados a mano entran ADEMÁS de la cantidad pedida: es lo que devuelve el backend y
          // lo que el asistente ya anticipó en el resumen.
          const cantidad = (p.cantidad ?? 0) + (p.incluirIds?.length ?? 0)
          const control = Math.round(cantidad * (p.porcentajeControl ?? CONFIG.porcentajeControl) / 100)
          return route.fulfill({
            json: {
              success: true,
              data: {
                ok: true, campanaId: 4, cantidad, control, filasCreadas: cantidad, omitidos: [],
                porSegmento: [{ segmento: p.segmento ?? 'dormido', contactar: cantidad, control }],
                primerDespachoAt: '2026-09-25T21:00:00.000Z',
                cupoDiario: CONFIG.cupoDiario,
                diasToque2: CONFIG.diasToque2,
                diasToque3: CONFIG.diasToque3,
                porcentajeControl: p.porcentajeControl ?? CONFIG.porcentajeControl,
                toqueHasta: p.toqueHasta ?? 1,
              },
            },
          })
        }
        if (url.endsWith('/clientes/recompra/config')) {
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
      await page.goto('/tests/motor-recompra.html')
      await expect(page.getByRole('button', { name: /Camila Duarte/ })).toBeVisible()
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
      await expect(page.getByRole('button', { name: /Programar envío/ })).toBeVisible()
    }

    test('no quedan ni la tab "Base" ni el badge "Pausado sin saldo"', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      // El estado que antes rotulaba "Pausado sin saldo".
      await montar(page, 'pausada_sin_saldo')

      await expect(page.getByRole('button', { name: 'Base', exact: true })).toHaveCount(0)
      await expect(page.getByText('Pausado sin saldo')).toHaveCount(0)

      await abrirDetalle(page)
      // El badge sigue diciendo que está pausado: lo que se fue es el "sin saldo".
      await expect(page.getByText('Pausado', { exact: true })).toBeVisible()
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

    test('el ritmo es del local y se ajusta desde la configuración del motor', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montar(page)
      await abrirMotor(page)

      for (const label of ['Contactados', 'Volvieron', 'Recuperado', 'En cola', 'Ritmo']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible()
      }
      // El ritmo es una métrica con su número y su acción, dentro de la misma fila.
      const ritmo = page.getByText('Ritmo', { exact: true }).locator('..')
      await expect(ritmo).toContainText('30')
      await expect(ritmo).toContainText('/día')
      // ...y ya no vive suelto en una fila propia.
      await expect(page.getByText(/clientes\/día/)).toHaveCount(0)

      // El cupo tiene una sola fuente: la configuración del motor, que es del
      // LOCAL porque el cupo protege el número y pueden correr varias tandas.
      await ritmo.getByRole('button', { name: 'Ajustar' }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo.getByRole('heading', { name: 'Configuración del motor' })).toBeVisible()
      // El piso de 48 hs no se puede bajar desde la UI y se explica por qué.
      await expect(dialogo).toContainText('El mínimo son 2 días (48 hs)')

      const campoCupo = dialogo.getByText('Cupo diario').locator('../..')
      await expect(campoCupo).toContainText('30')
      await campoCupo.getByRole('button', { name: '+' }).click()
      await campoCupo.getByRole('button', { name: '+' }).click()
      await expect(campoCupo).toContainText('40')

      await dialogo.getByRole('button', { name: 'Guardar' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      // Lo que viajó es la config entera, no sólo el cupo: los días y el % de
      // control son los defaults de las tandas nuevas.
      expect(captura.config).toEqual({
        cupoDiario: 40, modo: 'manual', diasToque2: 2, diasToque3: 2, porcentajeControl: 10,
      })
      expect(errors).toEqual([])
    })

    test('las tandas programadas se ven arriba, con lo que falta y su próximo despacho', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirMotor(page)

      // La tanda viva dice a quiénes agarró, cuánto salió y cuándo vuelve a salir algo.
      await expect(page.getByText('Tandas programadas')).toBeVisible()
      // Se busca dentro del panel de tandas: el nombre del segmento también está en cada fila de la cola.
      const seccion = page.getByText('Tandas programadas').locator('../..')
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

    test('el asistente programa a quiénes, cuántos y hasta qué toque', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montar(page)
      await abrirMotor(page)

      await page.getByRole('button', { name: /Programar envío/ }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo.getByRole('heading', { name: 'Programar envío' })).toBeVisible()
      // Los pasos son los que pidió el local: a quiénes, la lista, los toques y el control.
      for (const paso of ['1 · A quiénes', '2 · La lista', '3 · Toques', '4 · Grupo de control']) {
        await expect(dialogo.getByText(paso)).toBeVisible()
      }

      // La cantidad y el recorte de la lista son la misma cuenta que hace el backend.
      const cantidadInput = dialogo.locator('input[type="number"]')
      await cantidadInput.fill('5')
      const resumen = dialogo.getByText('Vas a programar').locator('..')
      await expect(resumen).toContainText('5 mensajes')
      await expect(resumen).toContainText('1 en el grupo de control')
      await expect(resumen).toContainText('un mensaje por cliente')

      // Con 5 pedidos y 8 candidatos: los primeros 5 reciben, el 6º queda de control y los dos
      // últimos esperan su turno, sin tilde.
      const tildes = dialogo.getByRole('checkbox')
      await expect(tildes).toHaveCount(8)
      const fila = (nombre: string) => dialogo.getByText(nombre, { exact: true }).locator('../../..')
      await expect(fila('Gonzalo Ibarra')).toContainText('Control')
      await expect(fila('Helena Vargas')).toContainText('Espera')

      // Destildar al control lo saca del lote —no lo convierte en contactado— y el que sigue pasa a
      // ser el control: la cuenta no baja.
      await tildes.nth(5).click()
      await expect(fila('Gonzalo Ibarra')).toContainText('Espera')
      await expect(fila('Helena Vargas')).toContainText('Control')
      await expect(resumen).toContainText('5 mensajes')
      // Volver a tildarlo deshace el movimiento, sin quedar como agregado a mano.
      await tildes.nth(5).click()
      await expect(fila('Gonzalo Ibarra')).toContainText('Control')
      await expect(fila('Helena Vargas')).toContainText('Espera')

      // Destildar a uno del lote lo saca de la tanda y entra el siguiente: la cuenta no baja.
      await tildes.nth(0).click()
      await expect(fila('Camila Duarte')).toContainText('Espera')
      await expect(resumen).toContainText('5 mensajes')
      await expect(resumen).not.toContainText('agregaste vos')

      // Tildar a uno que esperaba lo agrega ADEMÁS de la cantidad pedida.
      await tildes.nth(7).click()
      await expect(fila('Iván Ríos')).toContainText('A mano')
      await expect(resumen).toContainText('6 mensajes')
      await expect(resumen).toContainText('5 de la lista + 1 que agregaste vos')

      // "1º y 2º" agrega el recordatorio y su intervalo, con el piso de 48 hs a la vista.
      await dialogo.getByRole('button', { name: /1º y 2º/ }).click()
      await expect(dialogo).toContainText('El mínimo son 2 días (48 hs)')
      await expect(resumen).toContainText('un mensaje por cliente y un recordatorio a los 2 días')

      await dialogo.getByRole('button', { name: 'Programar 6 mensajes' }).click()

      // Lo que viajó: la cantidad pedida, el que se sacó del lote, el agregado a mano aparte, y los
      // días del 2º toque sólo porque la tanda llega hasta ahí.
      expect(captura.programacion).toEqual({
        segmento: null,
        cantidad: 5,
        toqueHasta: 2,
        diasToque2: 2,
        diasToque3: null,
        porcentajeControl: 10,
        incluirIds: [48],
        excluirIds: [41],
      })

      // El resultado lo dice el backend, no el asistente.
      await expect(dialogo.getByRole('heading', { name: 'Programado' })).toBeVisible()
      await expect(dialogo).toContainText('No salió ningún mensaje todavía')
      await expect(dialogo).toContainText('Cada cliente llega hasta el 2º toque')
      await dialogo.getByRole('button', { name: 'Ver las tandas' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)

      expect(errors).toEqual([])
    })

    test('el segmento elegido acota la lista y viaja en la programación', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      const captura = await montar(page)
      await abrirMotor(page)

      await page.getByRole('button', { name: /Programar envío/ }).click()
      const dialogo = page.getByRole('dialog')

      await dialogo.getByRole('button', { name: /^Perdidos/ }).click()
      // Sólo quedan los perdidos: los dormidos ya no se listan.
      const tildes = dialogo.getByRole('checkbox')
      await expect(tildes).toHaveCount(3)
      await expect(dialogo.getByText('Bruno Sosa', { exact: true })).toBeVisible()
      await expect(dialogo.getByText('Camila Duarte', { exact: true })).toHaveCount(0)

      await dialogo.locator('input[type="number"]').fill('2')
      await dialogo.getByRole('button', { name: 'Programar 2 mensajes' }).click()

      // Sin toques extra, los días no viajan: no se escriben como si fueran a usarse.
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
