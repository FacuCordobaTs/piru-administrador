import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({ ...base, testMatch: ['productos-evento.spec.ts', 'pos-catalogo-ui.spec.ts'] })
