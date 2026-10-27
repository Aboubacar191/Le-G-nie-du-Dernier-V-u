// Configuration Vite 6 + PWA (ADR-TL-06, ADR-TL-07, conventions.strategie_pwa).
//
// Objectif de la PWA : installabilité et rechargement instantané après
// verrouillage du téléphone ou passage d'ascenseur (US-16). PAS de jeu hors
// ligne : le serveur est l'arbitre, une partie hors ligne n'a aucun sens.
//
// Deux interdits structurants, écrits ici parce qu'ils ne se rattrapent pas
// ailleurs :
//  1. AUCUNE réponse de /api n'est mise en cache, à aucun moment. Mettre en
//     cache une projection privée la rendrait lisible après coup sur un
//     téléphone prêté — exactement ce que le GDD interdit.
//  2. La connexion temps réel (/tr) n'est jamais interceptée par le service
//     worker.

import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'generateSW',
      // « prompt » : le client REFUSE d'appliquer une mise à jour tant que
      // etat_partie n'est pas TERMINEE, ABANDONNEE ou SCORES. Un skipWaiting en
      // pleine phase DECLARATION_PAIEMENT remplacerait l'application sous les
      // doigts du joueur et lui ferait manquer sa déclaration.
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        navigateFallbackDenylist: [/^\/api/, /^\/tr/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@gdv/partage': fileURLToPath(
        new URL('../../paquets/partage/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
