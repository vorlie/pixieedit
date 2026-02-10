import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pixie_icon.svg'],
      manifest: {
        name: 'PixieEdit',
        short_name: 'PixieEdit',
        description: 'Privacy-first, browser-only professional photo editor.',
        theme_color: '#1C1B1F',
        background_color: '#1C1B1F',
        icons: [
          {
            src: 'pixie_icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pixie_icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
