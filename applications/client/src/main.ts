// Point d'entrée de la PWA.
//
// Montage du magasin et du stockage, lecture du chemin d'entrée (la voie QR
// pré-remplit un code d'adhésion), puis reprise automatique d'une session
// mémorisée.
//
// Le service worker est enregistré en mode « prompt » : une mise à jour ne
// s'applique JAMAIS en pleine phase de jeu. Un skipWaiting en pleine phase
// DECLARATION_PAIEMENT remplacerait l'application sous les doigts du joueur et
// lui ferait manquer sa déclaration.

import { createApp, h } from 'vue';

import App from './app.vue';
import { fournirMagasin, fournirStockage } from './magasin/injection.ts';
import { creerMagasin } from './magasin/session.ts';
import { lireEntree } from './routeur/index.ts';
import './styles/jetons.css';
import './styles/global.css';

/** Version du protocole annoncée à l'authentification (API-GDV-001 / info). */
const VERSION_PROTOCOLE = '1.0.0';

const stockage = globalThis.localStorage;
const magasin = creerMagasin({ stockage, versionProtocole: VERSION_PROTOCOLE });

const entree = lireEntree(globalThis.location.pathname);
magasin.naviguer(entree.intention);
if (entree.code !== '') magasin.preremplirCode(entree.code);

// Reprise silencieuse : si un jeton est mémorisé, la session reprend sans que
// le joueur ait à le demander (US-16). Sinon, l'intention locale décide.
if (entree.intention === 'accueil') magasin.reprendre();

createApp({
  name: 'RacineGdv',
  setup() {
    fournirMagasin(magasin);
    fournirStockage(stockage);
    return () => h(App);
  },
}).mount('#app');
