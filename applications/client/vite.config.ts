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

/** Port d'écoute du serveur de développement (.env.exemple : PORT=8443). */
const PORT_SERVEUR = process.env.PORT ?? '8443';

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
            // ANO-10 — le MOTIF, et lui seul, est corrigé ici.
            //
            // Ce qui était écrit : urlPattern: /^\/api\//. Workbox exécute le
            // motif sur url.href et non sur le chemin — node_modules/
            // workbox-routing/RegExpRoute.js : regExp.exec(url.href). Mesures du
            // QA : 'https://hote.exemple/api/sessions' → false,
            // 'http://127.0.0.1:5173/api/configuration/defauts' → false,
            // '/api/sessions' → true. La règle ne correspondait donc à AUCUNE
            // URL réelle, et l'engagement « aucune réponse de /api n'est mise en
            // cache » ne tenait plus que par l'absence fortuite de toute autre
            // règle de cache. Ce n'est pas un détail de configuration : une
            // projection privée en cache resterait lisible sur un téléphone
            // prêté après la partie.
            //
            // Un prédicat sur url.pathname est insensible à l'origine, donc
            // juste en développement sur réseau local comme en production.
            //
            // CONTRAINTE : cette fonction est SÉRIALISÉE dans le service worker
            // généré (workbox-build / runtime-caching-converter). Elle doit
            // rester AUTONOME — pas d'import, pas de constante extérieure, pas
            // de fermeture : un identifiant libre deviendrait un ReferenceError
            // dans sw.js, c'est-à-dire la même panne silencieuse d'un cran plus
            // loin. C'est pourquoi le littéral '/api/' est écrit ici au lieu
            // d'être partagé avec BASE_REST de src/transport/rest.ts. Le test
            // manifeste-pwa.test.ts évalue le prédicat extrait de ce fichier,
            // sans portée extérieure, ce qui prouve l'autonomie en même temps
            // que le comportement.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
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
    // Même ORIGINE pour le client, les six routes REST et le canal temps réel :
    // c'est l'hypothèse du contrat (servers : https://{hote}/api, canal
    // wss://{hote}/tr) et c'est aussi ce que la CSP de index.html autorise.
    //
    // La réécriture retire le préfixe /api : le serveur du nœud S4 enregistre
    // ses routes à la RACINE alors que API-GDV-001 / servers les déclare sous
    // /api. L'écart est consigné dans RAPPORT-FRONTEND-001, pas corrigé ici :
    // le serveur n'est pas dans le périmètre de ce nœud.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${PORT_SERVEUR}`,
        changeOrigin: false,
        rewrite: (chemin) => chemin.replace(/^\/api/u, ''),
      },
      '/tr': {
        target: `ws://127.0.0.1:${PORT_SERVEUR}`,
        ws: true,
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
