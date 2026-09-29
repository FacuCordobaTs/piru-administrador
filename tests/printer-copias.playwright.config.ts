import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// `globalSetup` calienta el servidor de desarrollo: el primer pedido a `vite dev` compila el grafo
// entero (~1 minuto medido acá) y sin eso el primer test vencía por tiempo en el `goto`.
// El timeout sube por si el precalentamiento no llega a completarse: los tests en sí tardan ~1s.
export default defineConfig({
    ...base,
    testMatch: 'printer-copias.spec.ts',
    globalSetup: './printer-copias.warmup.ts',
    timeout: 120000,
})
