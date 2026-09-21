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

    /** Monta el motor encendido y espera la primera fila de la cola. */
    async function montar(page: Page, estado = 'activa') {
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url()).pathname
        if (url.endsWith('/clientes/recompra/estado')) {
          return route.fulfill({ json: { success: true, data: { activa: true, campana: { ...CAMPANA, estado }, plan: null, saldoMarketing: CAMPANA.saldoMarketing } } })
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
    }

    /** En mobile el detalle vive en la columna que se abre al elegir una fila. */
    async function abrirDetalle(page: Page) {
      await page.getByRole('button', { name: /Camila Duarte/ }).click()
      await expect(page.getByRole('button', { name: 'Marcar como enviado' })).toBeVisible()
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

    test('el ritmo es una métrica más y se edita ahí mismo', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      await abrirDetalle(page)

      for (const label of ['Contactados', 'Volvieron', 'Recuperado', 'En cola', 'Ritmo']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible()
      }
      // El ritmo es una métrica con su número y su acción, dentro de la misma fila.
      const ritmo = page.getByText('Ritmo', { exact: true }).locator('..')
      await expect(ritmo).toContainText('30')
      await expect(ritmo).toContainText('/día')
      // ...y ya no vive suelto en una fila propia.
      await expect(page.getByText(/clientes\/día/)).toHaveCount(0)

      await ritmo.getByRole('button', { name: 'Cambiar', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()
      await page.getByRole('button', { name: 'Listo' }).click()

      // Guardar recarga el motor entero: la pantalla vuelve a montarse desde
      // cero (heredado), así que en la columna única de mobile hay que reabrir
      // el detalle. El valor guardado sigue ahí.
      await abrirDetalle(page)
      await expect(ritmo).toContainText('30')
      await expect(ritmo.getByRole('button', { name: 'Cambiar', exact: true })).toBeVisible()
      expect(errors).toEqual([])
    })

    test('la explicación de los modos vive en "¿Cómo funciona?"', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await montar(page)
      // El texto del recuadro de Modo Manual que competía con la operación.
      await expect(page.getByText('Cada cliente llega con el mensaje de su segmento ya preparado')).toHaveCount(0)

      await abrirDetalle(page)
      await page.getByRole('button', { name: '¿Cómo funciona?' }).click()

      const dialogo = page.getByRole('dialog')

      // La ayuda es un recorrido: cada bloque explica una parte del motor.
      for (const titulo of [
        'A quién le habla',
        'El goteo: hasta 3 toques por cliente',
        'Cómo sale el mensaje',
        'Las tres decisiones de cada envío',
        'El grupo de control',
        'Cómo se leen las métricas de arriba',
        'Lo que el motor nunca hace',
      ]) {
        await expect(dialogo.getByRole('heading', { name: titulo })).toBeVisible()
      }

      // Los números son los del motor, no placeholders: la escalera arranca sin descuento y cierra
      // en 20% con vencimiento.
      await expect(dialogo).toContainText('Pasó 1,5 veces su intervalo habitual')
      await expect(dialogo).toContainText('Pasó 6 veces su intervalo habitual')
      await expect(dialogo).toContainText('Sin descuento')
      await expect(dialogo).toContainText('20%')
      await expect(dialogo).toContainText('vence en 48 hs')
      await expect(dialogo).toContainText('4 mensajes de marketing')
      // El modo activo se marca dentro de su tarjeta, y sólo en la suya.
      const manual = dialogo.getByRole('heading', { name: 'Manual', exact: true }).locator('../..')
      await expect(manual).toContainText('activo')
      const automatico = dialogo.getByRole('heading', { name: 'Automático', exact: true }).locator('../..')
      await expect(automatico).not.toContainText('activo')
      // Y el cupo y el saldo reales entran en la explicación del modo automático.
      await expect(automatico).toContainText('hasta 30 clientes por día')
      await expect(automatico).toContainText('120 mensajes')

      // La comparación con el control usa los números medidos del local.
      await expect(dialogo).toContainText('25%')
      await expect(dialogo).toContainText('7%')
      await expect(dialogo).toContainText('30 clientes sin contactar')

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
      await expect(dialogo).toContainText('no se configuran desde acá')
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
