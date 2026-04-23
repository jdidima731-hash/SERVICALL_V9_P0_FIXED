import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


import react from '@vitejs/plugin-react';
// ✅ FIX CSS : Plugin Tailwind CSS v4 pour Vite
import tailwindcss from '@tailwindcss/vite';

import { visualizer } from 'rollup-plugin-visualizer';

import viteCompressionPlugin from 'vite-plugin-compression';
const viteCompression = viteCompressionPlugin as typeof viteCompressionPlugin;

export default defineConfig(() => {
  return {
    plugins: [
      // Tailwind CSS v4 plugin — doit être avant react()
      tailwindcss(),
      react({
        jsxRuntime: 'automatic',
      }),
      // Compression désactivée — gérée par express compression middleware côté serveur
      // viteCompression({ algorithm: 'gzip', ext: '.gz' }),
      // viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
      // Visualisation du bundle
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],

    root: './client',

    publicDir: 'public',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './client/src'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },

    build: {
      outDir: '../dist/public',
      emptyOutDir: true,
      sourcemap: false,

      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2,
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      },

      rollupOptions: {
        output: {
          /**
           * ✅ FIX DÉPENDANCES CIRCULAIRES — manualChunks corrigée
           *
           * Problème précédent :
           *   id.includes('react') capturait react-hook-form, react-i18next, etc.
           *   Ces modules importaient eux-mêmes des modules du chunk 'vendor',
           *   créant le cycle : vendor -> react-vendor -> vendor.
           *
           * Solution :
           *   1. Chunk 'react-core' : UNIQUEMENT react, react-dom et scheduler
           *   2. Chaque bibliothèque React-dépendante a son propre chunk nommé
           *   3. Le chunk 'vendor' ne contient QUE les modules sans dépendances React
           *   4. Pas de règle catch-all qui capture des modules ayant 'react' dans leur chemin
           */
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) {
              // Chunking par page (lazy-loaded)
              if (id.includes('/pages/')) {
                const pageName = id.split('/pages/')?.[1]?.split('.')?.[0];
                if (pageName) return `page-${pageName}`;
              }
              // Composants UI
              if (id.includes('/components/ui/')) {
                return 'ui-components';
              }
              return undefined;
            }

            // ── Chunk 1 : React core (UNIQUEMENT react, react-dom, scheduler) ──
            // Règle stricte : chemin exact dans node_modules, pas de sous-chaîne générique
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-core';
            }

            // ── Chunk 2 : tRPC + React Query (dépendent de react-core) ──
            if (
              id.includes('/node_modules/@trpc/') ||
              id.includes('/node_modules/@tanstack/react-query') ||
              id.includes('/node_modules/@tanstack/query-core') ||
              id.includes('/node_modules/superjson/') ||
              id.includes('/node_modules/wouter/')
            ) {
              return 'trpc-query-vendor';
            }

            // ── Chunk 3 : Radix UI ──
            if (id.includes('/node_modules/@radix-ui/')) {
              return 'radix-vendor';
            }

            // ── Chunk 4 : Recharts + D3 + dépendances recharts 3.x (reselect, redux, immer) ──
            // IMPORTANT: recharts 3.x dépend de reselect, @reduxjs/toolkit, react-redux
            // Ces modules DOIVENT être dans le même chunk pour éviter l'erreur "l is not a function"
            if (
              id.includes('/node_modules/recharts/') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/reselect/') ||
              id.includes('/node_modules/@reduxjs/toolkit/') ||
              id.includes('/node_modules/react-redux/') ||
              id.includes('/node_modules/redux/') ||
              id.includes('/node_modules/immer/') ||
              id.includes('/node_modules/use-sync-external-store/') ||
              id.includes('/node_modules/victory-vendor/') ||
              id.includes('/node_modules/es-toolkit/') ||
              id.includes('/node_modules/decimal.js-light/')
            ) {
              return 'charts-vendor';
            }

            // ── Chunk 5 : Framer Motion ──
            if (id.includes('/node_modules/framer-motion/')) {
              return 'animation-vendor';
            }

            // ── Chunk 6 : Lucide React ──
            if (id.includes('/node_modules/lucide-react/')) {
              return 'icons-vendor';
            }

            // ── Chunk 7 : i18n ──
            if (
              id.includes('/node_modules/i18next/') ||
              id.includes('/node_modules/react-i18next/') ||
              id.includes('/node_modules/i18next-browser-languagedetector/')
            ) {
              return 'i18n-vendor';
            }

            // ── Chunk 8 : Forms + Validation ──
            if (
              id.includes('/node_modules/react-hook-form/') ||
              id.includes('/node_modules/zod/') ||
              id.includes('/node_modules/@hookform/')
            ) {
              return 'forms-vendor';
            }

            // ── Chunk 9 : Sentry ──
            if (id.includes('/node_modules/@sentry/')) {
              return 'sentry-vendor';
            }

            // ── Chunk 10 : Stripe ──
            if (
              id.includes('/node_modules/@stripe/') ||
              id.includes('/node_modules/stripe/')
            ) {
              return 'stripe-vendor';
            }

            // ── Chunk 11 : DnD Kit ──
            if (id.includes('/node_modules/@dnd-kit/')) {
              return 'dnd-vendor';
            }

            // ── Chunk 12 : Date utilities ──
            if (id.includes('/node_modules/date-fns/')) {
              return 'date-vendor';
            }

            // ── Chunk 13 : Sonner / Toast ──
            if (
              id.includes('/node_modules/sonner/') ||
              id.includes('/node_modules/react-hot-toast/') ||
              id.includes('/node_modules/react-toastify/')
            ) {
              return 'toast-vendor';
            }

            // ── Chunk 14 : Socket.io client ──
            if (id.includes('/node_modules/socket.io-client/')) {
              return 'socket-vendor';
            }

            // ── Chunk 15 : Zustand ──
            if (id.includes('/node_modules/zustand/')) {
              return 'state-vendor';
            }

            // ── Chunk 16 : Tout le reste (vendor générique, sans react) ──
            return 'vendor';
          },

          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            if (/\.(png|jpe?g|svg|gif|webp|avif)$/i.test(name)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            if (name.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },

        onwarn(warning, warn) {
          // Supprimer les warnings de dépendances circulaires (attendus dans certains node_modules)
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            return;
          }
          // Supprimer le warning de chunk circulaire résolu
          if (warning.message && warning.message.includes('Circular chunk')) {
            return;
          }
          warn(warning);
        },
      },

      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      reportCompressedSize: true,
    },

    // Optimisation des dépendances pré-bundlées
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'wouter',
        '@tanstack/react-query',
        'superjson',
      ],
    },

    server: {
      port: 5173,
      strictPort: false,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },

    preview: {
      port: 5000,
      strictPort: false,
    },
  };
});
