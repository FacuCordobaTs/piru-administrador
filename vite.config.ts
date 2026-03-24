import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['piru192.png', 'piru512.png', 'piruappletouch.png'],
      manifest: {
        name: 'Piru Admin - Panel de Control',
        short_name: 'Piru Admin',
        theme_color: '#ff8a00',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'piru192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'piru512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'piruappletouch.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
