import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const DEFAULT_BACKEND_ORIGIN = 'https://us-central1-fb-hub-ed9de.cloudfunctions.net';
const APP_BASE = '/fenerbahce-fan-hub/';
const APP_VERSION = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version;

const normalizeBaseUrl = (value = '') => value.replace(/\/+$/g, '');
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = normalizeBaseUrl(env.VITE_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN);
  const backendPattern = escapeRegex(backendOrigin);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        includeAssets: [
          'pwa-192.png',
          'pwa-512.png',
          'pwa-maskable.png',
          'vite.svg'
        ],
        manifest: {
          name: 'Fenerbahçe Fan Hub',
          short_name: 'FB Hub',
          description: 'Fenerbahçe taraftarı için maç, kadro ve formasyon merkezi',
          theme_color: '#0f172a',
          background_color: '#020617',
          display: 'standalone',
          scope: APP_BASE,
          start_url: APP_BASE,
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
          importScripts: [`${APP_BASE}firebase-messaging-sw.js`],
          globIgnores: ['**/firebase-messaging-sw.js', '**/firebase-messaging-sw-template.js'],
          runtimeCaching: [
            {
              urlPattern: new RegExp(`${backendPattern}/api/(next-match|next-3-matches|squad)`),
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
              urlPattern: new RegExp(`${backendPattern}/api/(player|team)-image/\\d+`),
              handler: 'CacheFirst',
              options: {
                cacheName: `fb-image-cache-${APP_VERSION}`,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24
                },
                cacheableResponse: {
                  statuses: [200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION)
    },
    base: APP_BASE
  };
});
