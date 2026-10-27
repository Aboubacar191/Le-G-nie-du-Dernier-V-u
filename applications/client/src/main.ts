// Point d'entrée de la PWA.
//
// AMORCE — nœud S5 (dev-frontend) : montage du routeur, du magasin et du
// transport temps réel, puis enregistrement du service worker en mode
// « prompt » (une mise à jour ne s'applique jamais en pleine phase de jeu).

import { createApp } from 'vue';

import App from './app.vue';
import './styles/jetons.css';

createApp(App).mount('#app');
