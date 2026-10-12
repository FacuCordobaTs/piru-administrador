import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ALTA = '/RegisterInternoFacu-74c183d9-59b1-4bca-9d12-048c8a2eed94'
const jwt = (payload: object) => `e30.${Buffer.from(JSON.stringify({ id: 901, scope: 'restaurante', exp: Math.floor(Date.now() / 1000) + 7200, ...payload })).toString('base64url')}.test`
const token = jwt({ altaInterna: true })
const local = { id: 901, nombre: 'Brasa', username: 'brasa', telefono: '5493511234567', origen: 'outbound', completedOnboarding: false, usarColorUnico: true }
const productos = [
  { localId: 'pizza', nombre: 'Pizza', descripcion: 'Muzzarella y tomate', precio: null, categoria: 'Pizzas', variantes: [{ nombre: 'Grande', precio: 12000 }], variantesSecundarias: [{ nombre: 'Especial', precio: 1500 }], extras: [{ nombre: 'Aceitunas', precio: 500 }], extrasSecundarios: [{ nombre: 'Salsa picante', precio: 0 }] },
  { localId: 'empanada', nombre: 'Empanada', descripcion: '', precio: 1500, categoria: 'Pizzas' },
]

async function preparar(page: Page, phase?: string, data: object = {}) {
  const requests: { path: string; method: string; body: any }[] = []
  let completed = false
  let failTrial = false
  let nextId = 10
  const errores: string[] = []
  page.on('pageerror', error => errores.push(error.message))
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace(/^\/api/, '')
    const body = req.postDataJSON()
    requests.push({ path, method: req.method(), body })
    let res: any = { success: true, data: [] }
    if (path === '/interno/login') res = { data: { token: jwt({ scope: 'interno' }) } }
    if (path === '/interno/locales/crear-telefono') res = { token, restaurante: local, claimUrl: 'https://admin.piru.app/mi-tienda/test-claim' }
    // Una tienda recién armada no tiene suscripción: el panel igual le queda abierto al fundador.
    if (path === '/restaurante/profile') res = { success: true, data: { restaurante: { ...local, completedOnboarding: completed }, productos: [], mesas: [], suscripcion: { accesoPanel: false, sinSuscripcion: true, estado: null } } }
    if (path === '/categoria') res = { success: true, categorias: [{ id: 1, nombre: 'Pizzas', esBebida: false }] }
    if (path === '/ingrediente') res = { success: true, ingredientes: [] }
    if (path === '/agregado') res = { success: true, agregados: [] }
    if (path === '/ingrediente/create' || path === '/agregado/create') res = { success: true, data: { id: nextId++ } }
    if (path === '/producto/create' || path === '/producto/update') res = { success: true, productoId: body.id ?? nextId++, imagenUrl: body.image ? 'https://images.example/pizza.png' : undefined, variantes: body.variantes.map((v: object & { id?: number }) => ({ ...v, id: v.id ?? nextId++ })), variantesSecundarias: body.variantesSecundarias.map((v: object & { id?: number }) => ({ ...v, id: v.id ?? nextId++ })) }
    if (path === '/producto') res = { success: true, productos: phase === 'prueba' ? [{
      id: 10, nombre: 'Pizza', descripcion: 'Muzzarella y tomate', precio: '12000',
      variantes: [{ id: 101, nombre: 'Grande', precio: '12000' }, { id: 102, nombre: 'Chica', precio: '10000' }],
      variantesSecundarias: [{ id: 201, nombre: 'Especial', precio: '1500' }],
      agregadosPrimarios: [{ id: 501, nombre: 'Aceitunas', precio: '500' }],
      agregadosSecundarios: [{ id: 502, nombre: 'Salsa picante', precio: '0' }],
    }] : [] }
    if (path === '/suscripcion') res = { success: true, data: { suscripcionBase: { precioMensual: '40000' } } }
    if (path === '/onboarding/terminar-alta') {
      if (failTrial) { await route.fulfill({ status: 409, json: { message: 'Terminá de configurar la tienda antes de cerrar el alta' } }); return }
      completed = true
    }
    await route.fulfill({ json: res })
  })
  await page.route('**/public/updates/latest.json', route => route.fulfill({ json: { version: '1.0', platforms: {} } }))
  if (phase) await page.addInitScript(({ token, local, phase, data, productos }) => {
    if (!localStorage.getItem('piru-auth-storage')) localStorage.setItem('piru-auth-storage', JSON.stringify({ state: { token, restaurante: local, isAuthenticated: true }, version: 0 }))
    if (!localStorage.getItem('piru_onboarding_data:901')) localStorage.setItem('piru_onboarding_data:901', JSON.stringify({ nombre: 'Brasa', username: 'brasa', cartaDetectada: { categorias: [{ nombre: 'Pizzas', productos }] }, ...data }))
    if (!localStorage.getItem('piru_onboarding_data:901:phase')) localStorage.setItem('piru_onboarding_data:901:phase', phase)
    sessionStorage.setItem('piru:alta-claim:901', 'https://admin.piru.app/mi-tienda/test-claim')
  }, { token, local, phase, data, productos })
  return { requests, errores, failTrial: () => { failTrial = true }, allowTrial: () => { failTrial = false } }
}

async function captura(page: Page, name: string) {
  if (!process.env.ALTA_SHOTS) return
  await mkdir(process.env.ALTA_SHOTS, { recursive: true })
  await page.screenshot({ path: join(process.env.ALTA_SHOTS, `${name}.png`), fullPage: true })
}

test('pegar imágenes carga y reemplaza el logo usando la misma validación que los archivos', async ({ page }) => {
  await preparar(page, 'preparativos')
  await page.goto('/onboarding')
  const uploader = page.getByRole('group', { name: 'Cargador de imagen', exact: true })
  await uploader.getByRole('button', { name: /pegá con Ctrl/ }).click()
  await expect(uploader).toBeFocused()
  const pegar = async (color: string, tipo = 'image/png', size = 0) => uploader.evaluate((el, { color, tipo, size }) => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 80, 80)
    const src = canvas.toDataURL()
    const bytes = Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([size ? new Uint8Array(size) : bytes], 'pegada.png', { type: tipo }))
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
    return src
  }, { color, tipo, size })
  const primero = await pegar('#238F52')
  await expect(uploader.getByRole('img')).toHaveAttribute('src', primero)
  const segundo = await pegar('#FF1133')
  await expect(uploader.getByRole('img')).toHaveAttribute('src', segundo)
  await pegar('#000000', 'image/gif')
  await expect(page.getByText('Formato no válido', { exact: true })).toBeVisible()
  await expect(uploader.getByRole('img')).toHaveAttribute('src', segundo)
  await pegar('#000000', 'image/png', 5 * 1024 * 1024 + 1)
  await expect(page.getByText('Imagen muy grande', { exact: true })).toBeVisible()
  await expect(uploader.getByRole('img')).toHaveAttribute('src', segundo)
  expect(await uploader.evaluate(el => {
    const data = new DataTransfer(); data.setData('text/plain', 'texto')
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
    el.dispatchEvent(event); return event.defaultPrevented
  })).toBe(false)
})

test('pegar la foto afecta sólo al producto elegido y se guarda igual que una imagen subida', async ({ page }) => {
  const mock = await preparar(page, 'revision')
  await page.goto('/onboarding')
  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(2, { timeout: 20000 })
  const uploader = cards.nth(0).getByRole('group', { name: 'Cargador de imagen', exact: true })
  await uploader.getByRole('button', { name: 'Pegar: Ctrl + V', exact: true }).click()
  await expect(uploader).toBeFocused()
  const src = await uploader.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#D17839'; ctx.fillRect(0, 0, 80, 80)
    const src = canvas.toDataURL(), bytes = Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0))
    const data = new DataTransfer(); data.items.add(new File([bytes], 'producto.png', { type: 'image/png' }))
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
    return src
  })
  await expect(uploader.getByRole('img')).toHaveAttribute('src', src)
  await expect(cards.nth(1).getByRole('group', { name: 'Cargador de imagen' }).getByRole('img')).toHaveCount(0)
  await cards.nth(0).getByRole('button', { name: 'Guardar producto', exact: true }).click()
  await expect(cards.nth(0).getByRole('button', { name: 'Guardado', exact: true })).toBeVisible()
  expect(mock.requests.find(r => r.path === '/producto/create')?.body.image).toBe(src)
  // Tampoco puede cambiar una imagen mientras el formulario está guardando.
  await uploader.evaluate(el => {
    el.closest('fieldset')!.disabled = true
    const data = new DataTransfer(); data.items.add(new File(['otra'], 'otra.png', { type: 'image/png' }))
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
  })
  await expect(uploader.getByRole('img')).toHaveAttribute('src', 'https://images.example/pizza.png')
  expect(mock.errores).toEqual([])
})

test('el público entra por login; el alta pide interno una vez y crea con sólo el teléfono', async ({ page }) => {
  const mock = await preparar(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Crear cuenta', { exact: true })).toHaveCount(0)
  for (const path of ['/register', '/register-email']) { await page.goto(path); await expect(page).toHaveURL(/\/login$/) }
  await page.goto(ALTA)
  await page.getByLabel('Contraseña de interno').fill('contraseña-de-prueba')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByLabel('WhatsApp del local').fill('9 351 123 4567')
  await captura(page, 'registro-desktop')
  await page.getByRole('button', { name: 'Crear tienda y configurar' }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  expect(mock.requests.find(r => r.path === '/interno/locales/crear-telefono')?.body).toEqual({ telefono: '5493511234567' })
  expect(mock.requests.some(r => r.path.includes('/auth/register'))).toBe(false)
  expect(mock.errores).toEqual([])
})

for (const mobile of [false, true]) {
  test(`logo y colores: toma el hexadecimal dentro del recorrido (${mobile ? 'celular' : 'escritorio'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await preparar(page, 'preparativos')
    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Colores de la tienda' })).toBeVisible()
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const ctx = c.getContext('2d')!; ctx.fillStyle = '#238F52'; ctx.fillRect(0, 0, 120, 120); return c.toDataURL().split(',')[1] })
    await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    const canvas = page.getByLabel('Logo para seleccionar color')
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(120)
    await canvas.click({ position: { x: 50, y: 50 } })
    await expect(page.getByLabel('Hexadecimal de color primario')).toHaveValue('#238F52')
    await page.getByLabel('Usar un solo color').uncheck()
    await page.getByLabel('Aplicar color del logo a').selectOption('colorSecundario')
    await canvas.click({ position: { x: 50, y: 50 } })
    await expect(page.getByLabel('Hexadecimal de color secundario')).toHaveValue('#238F52')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await captura(page, `colores-${mobile ? 'mobile' : 'desktop'}`)
  })

  test(`guarda sólo un producto, con imagen y ambos grupos, sin remontar los demás (${mobile ? 'celular' : 'escritorio'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    const mock = await preparar(page, 'revision')
    await page.goto('/onboarding')
    const cards = page.getByTestId('producto-editor')
    await expect(cards).toHaveCount(2)
    await cards.nth(1).getByLabel('Nombre', { exact: true }).fill('Empanada sin guardar')
    await cards.nth(0).getByLabel('Nombre', { exact: true }).fill('Pizza especial')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ5kAAAAASUVORK5CYII=', 'base64')
    await cards.nth(0).locator('input[type=file]').setInputFiles({ name: 'pizza.png', mimeType: 'image/png', buffer: png })
    await captura(page, `productos-${mobile ? 'mobile' : 'desktop'}`)
    await cards.nth(0).getByRole('button', { name: 'Guardar producto' }).click()
    await expect(cards.nth(0).getByRole('button', { name: 'Guardado', exact: true })).toBeVisible()
    const created = mock.requests.filter(r => r.path === '/producto/create')
    expect(created).toHaveLength(1)
    expect(created[0].body.variantesSecundarias).toEqual([{ nombre: 'Especial', precio: 1500 }])
    expect(created[0].body.agregadoIdsSecundarios).toHaveLength(1)
    expect(created[0].body.image).toMatch(/^data:image\/png/)
    await expect(cards.nth(1).getByLabel('Nombre', { exact: true })).toHaveValue('Empanada sin guardar')
    await cards.nth(0).getByLabel('Nombre', { exact: true }).fill('Pizza final')
    await cards.nth(0).getByRole('button', { name: 'Guardar producto' }).click()
    await expect(cards.nth(0).getByRole('button', { name: 'Guardado', exact: true })).toBeVisible()
    expect(mock.requests.filter(r => r.path === '/producto/create')).toHaveLength(1)
    const update = mock.requests.find(r => r.path === '/producto/update')!
    expect(update.body.nombre).toBe('Pizza final'); expect(update.body.image).toBeUndefined()
    expect(update.body.variantes[0].id).toBeDefined()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(mock.errores).toEqual([])
  })
}

test('el alta se cierra antes de salir sin iniciar la prueba; si falla permite reintentar y conserva los links', async ({ page }) => {
  const mock = await preparar(page, 'plan')
  mock.failTrial()
  await page.goto('/onboarding')
  await expect(page.getByRole('button', { name: 'Copiar link de demo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar link de reclamo' })).toBeVisible()
  // La prueba arranca en el reclamo, no acá: la pantalla lo dice y no ofrece empezarla.
  await expect(page.getByText(/arranca cuando el dueño verifica su WhatsApp/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Empezar la prueba/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Terminar y dejar la tienda lista' }).click()
  await expect(page.getByText('Terminá de configurar la tienda antes de cerrar el alta', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/onboarding$/)
  mock.allowTrial()
  await page.getByRole('button', { name: 'Terminar y dejar la tienda lista' }).click()
  // Sin suscripción (accesoPanel: false) el fundador entra al panel igual: no cae en /suscribir.
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(mock.requests.filter(r => r.path === '/onboarding/terminar-alta')).toHaveLength(2)
  expect(mock.requests.filter(r => /iniciar-prueba|suscripcion\/checkout/.test(r.path))).toHaveLength(0)
  expect(mock.errores).toEqual([])
})

test('guarda los colores y mantiene el recorrido abierto hasta cerrar el alta', async ({ page }) => {
  const mock = await preparar(page, 'whatsapps', { colorPrimario: '#238F52', colorSecundario: '#FFFFEE', usarColorUnico: false })
  await page.goto('/onboarding')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByTestId('producto-editor')).toHaveCount(2)
  const config = mock.requests.find(r => r.path === '/onboarding/complete')!
  expect(config.body).toMatchObject({ colorPrimario: '#238F52', colorSecundario: '#FFFFEE', usarColorUnico: false, finalizar: false })
  await page.reload()
  await expect(page.getByTestId('producto-editor')).toHaveCount(2)
})

test('el pedido de prueba conserva dos variantes y ambos grupos de extras', async ({ page }) => {
  const mock = await preparar(page, 'prueba')
  await page.goto('/onboarding')
  await page.getByRole('button', { name: /Pizza.*12000|Pizza.*12\.000/ }).click()
  await page.getByLabel('Variante principal').selectOption('102')
  await page.getByLabel('Aceitunas', { exact: false }).check()
  await page.getByLabel('Salsa picante', { exact: false }).check()
  await page.getByRole('button', { name: 'Agregar · $12.000', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: /Ver Pedido/ }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar y pedir', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Te llegó el pedido' })).toBeVisible()
  expect(mock.requests.find(r => r.path === '/pedido-unificado/create')?.body.items).toEqual([{
    productoId: 10, cantidad: 1, varianteId: 102, varianteSecundariaId: 201, ingredientesExcluidos: [],
    agregados: [{ id: 501, nombre: 'Aceitunas', precio: '500' }, { id: 502, nombre: 'Salsa picante', precio: '0' }],
  }])
  expect(mock.errores).toEqual([])
})
