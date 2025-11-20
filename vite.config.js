import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const backendUrl = 'https://fenerbahce-backend.onrender.com';
const appBase = '/fenerbahce-fan-hub/';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['pwa-192.png', 'pwa-512.png', 'pwa-maskable.png', 'vite.svg'],
      manifest: {
        name: 'Fenerbahçe Fan Hub',
        short_name: 'FB Hub',
        description: 'Fenerbahçe taraftarı için maç, kadro ve formasyon merkezi',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        scope: appBase,
        start_url: appBase,
        lang: 'tr',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: new RegExp(`${backendUrl}/api/(next-match|next-3-matches|squad)`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fb-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: new RegExp(`${backendUrl}/api/(player|team)-image/\\d+`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fb-image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: appBase
});
