#!/usr/bin/env node
// =============================================================================
// PREUVE RESPONSIVE — zéro débordement de page, zéro chevauchement de cartes
// =============================================================================
// Ce n'est PAS un test de la suite : il exige un serveur ET un client vivants
// (comme outils/preuve-bout-en-bout.mjs), et une porte de qualité qui dépend
// d'un port ouvert n'est pas une porte.
//
// Trouvé par cette preuve, dans cet ordre, au fil d'un même après-midi :
//   1. une boucle de reconnexion infinie (ordre d'émission serveur, corrigé
//      dans applications/serveur/src/temps-reel/serveur-ws.ts) ;
//   2. ECR-17 (paiement secret) débordait de 130 à 496px à effectif maximal,
//      avant que la coquille soit bornée et que la liste publique défile ;
//   3. les cartes du cercle (VOEU, NEGOCIATION, …) se chevauchaient à effectif
//      maximal — un plancher tactile (Fitts) appliqué à tort à une carte de
//      LECTURE SEULE, et une hauteur de carte jamais bornée par
//      CercleDesPlaces.vue, qui ne bornait que la largeur.
//
// Ce que cette preuve NE vérifie PAS : la lisibilité esthétique du contenu
// tronqué à effectif maximal (overflow: hidden coupe le texte qui dépasse,
// plutôt que de le faire déborder sur la carte voisine — c'est le compromis
// retenu, pas un idéal). Une revue visuelle humaine reste utile au-delà de
// cette preuve mécanique.
//
// Usage : node --conditions=gdv-source outils/preuve-responsive.mjs [--hote 127.0.0.1:8443] [--client http://localhost:5173]
// Sortie : 0 = toutes les assertions tiennent, 1 = au moins une a échoué.
// =============================================================================

import { chromium } from 'playwright';
import { WebSocket } from 'ws';

const argument = (nom, defaut) => {
  const index = process.argv.indexOf(nom);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : defaut;
};

const HOTE = argument('--hote', '127.0.0.1:8443');
const URL_CLIENT = argument('--client', 'http://localhost:5173');
const BASE_REST = `http://${HOTE}/api`;

// Pseudos longs, délibérément : c'est le pire cas réel, pas une moyenne.
const PSEUDOS = [
  'Alexandrine', 'Barthelemy', 'Celestine', 'Dagobert',
  'Esperanza', 'Fitzgerald', 'Guillemette', 'Hieronymus',
];

const dormir = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));
const dire = (ligne) => console.log(ligne);

let echecs = 0;
function verifier(condition, libelle) {
  if (condition) {
    dire(`  ✔ ${libelle}`);
  } else {
    dire(`  ✘ ${libelle}`);
    echecs += 1;
  }
}

async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${BASE_REST}${chemin}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`${chemin} → ${reponse.status} ${JSON.stringify(corps)}`);
  return corps;
}

function creerSocketBrut(url) {
  return new Promise((resoudre, rejeter) => {
    const brut = new WebSocket(url, { origin: `http://${HOTE}` });
    brut.on('open', () => resoudre(brut));
    brut.on('error', rejeter);
  });
}

function envoyer(ws, type, charge) {
  ws.send(JSON.stringify({ id_correlation: crypto.randomUUID(), type, charge }));
}

/**
 * Crée une session à 8 joueurs et retourne les adhésions, SANS connecter
 * personne. Le dernier joueur de la liste est réservé à la mesure (voir
 * creerTablee) : lui seul sera connecté par le navigateur, jamais par une
 * socket de script — avoir les deux à la fois pour un même joueur_id s'est
 * révélé non fiable à la mesure (deux connexions concurrentes).
 */
async function creerSession(dureesPhasesS) {
  const creation = await appeler('/sessions', {
    method: 'POST',
    body: JSON.stringify({ pseudo: PSEUDOS[0], config_surchargee: { durees_phases_s: dureesPhasesS } }),
  });
  const adhesions = [creation];
  for (const pseudo of PSEUDOS.slice(1)) {
    adhesions.push(await appeler(`/sessions/${creation.code_adhesion}/joueurs`, {
      method: 'POST',
      body: JSON.stringify({ pseudo }),
    }));
  }
  return adhesions;
}

/** Connecte tous les joueurs SAUF le dernier (réservé au navigateur). */
async function connecterScripts(adhesions) {
  const sockets = [];
  for (const adhesion of adhesions.slice(0, -1)) {
    const ws = await creerSocketBrut(`ws://${HOTE}${adhesion.url_temps_reel}`);
    envoyer(ws, 'authentifier', {
      jeton_session: adhesion.jeton_session,
      version_protocole: adhesion.version_protocole,
    });
    sockets.push({ ws, adhesion });
  }
  await dormir(500);
  return sockets;
}

function jetonDe(adhesion, estHote) {
  return {
    session_id: adhesion.session_id,
    jeton_session: adhesion.jeton_session,
    joueur_id: adhesion.joueur_id,
    est_hote: estHote,
    url_temps_reel: adhesion.url_temps_reel,
  };
}

async function ouvrirPage(navigateur, viewport, jeton) {
  const page = await (await navigateur.newContext({ viewport })).newPage();
  await page.addInitScript((j) => localStorage.setItem('gdv.session', JSON.stringify(j)), jeton);
  page.on('pageerror', (e) => dire(`  [erreur page] ${e.message}`));
  await page.goto(URL_CLIENT);
  await page.waitForTimeout(1200);
  return page;
}

/** Zéro débordement de .coquille__ecran — le filet de secours ne doit jamais se tendre. */
async function ecranTientSansScroll(page) {
  return page.evaluate(() => {
    const e = globalThis.document.querySelector('.coquille__ecran');
    if (e === null) return { s: null, c: null };
    return { s: e.scrollHeight, c: e.clientHeight };
  });
}

/** Aucune paire de .cercle__place ne doit se chevaucher (rectangles disjoints). */
async function cerclesSansChevauchement(page) {
  return page.evaluate(() => {
    const rects = Array.from(globalThis.document.querySelectorAll('.cercle__place')).map((p) => p.getBoundingClientRect());
    const chevauche = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    let paires = 0;
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        if (chevauche(rects[i], rects[j])) paires += 1;
      }
    }
    return { nb: rects.length, pairesChevauchantes: paires };
  });
}

// --- Scénario 1 : ECR-17 (paiement secret), le pire cas déjà mesuré --------

async function scenarioPaiementSecret(navigateur) {
  dire('\nSCÉNARIO 1 — ECR-17 (paiement secret), effectif maximal, 3 largeurs de téléphone');
  const VIEWPORTS = [
    { nom: 'iPhone-SE-petit', width: 320, height: 568 },
    { nom: 'iPhone-SE-actuel', width: 375, height: 667 },
    { nom: 'Grand-telephone', width: 430, height: 932 },
  ];

  const adhesions = await creerSession({ VOEU: 3, NEGOCIATION: 3, DECLARATION_PAIEMENT: 120 });
  const sockets = await connecterScripts(adhesions);
  const hote = sockets[0];
  const mesure = adhesions[adhesions.length - 1];

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1000);
  await dormir(3500); // VOEU
  envoyer(hote.ws, 'avancer_phase', {}); // NEGOCIATION -> DECLARATION_PAIEMENT
  await dormir(500);

  // Déclaration envoyée UNE SEULE fois (RG-70 : une seconde est refusée),
  // pour que CE joueur bascule côté serveur vers ECR-17 — puis chaque
  // viewport reconnecte et voit ce même état déjà déclaré.
  const mesureWs = await creerSocketBrut(`ws://${HOTE}${mesure.url_temps_reel}`);
  envoyer(mesureWs, 'authentifier', { jeton_session: mesure.jeton_session, version_protocole: mesure.version_protocole });
  await dormir(300);
  envoyer(mesureWs, 'declarer_contribution', { montant: 3 });
  await dormir(400);
  mesureWs.close();
  await dormir(300);

  for (const vp of VIEWPORTS) {
    const page = await ouvrirPage(navigateur, vp, jetonDe(mesure, false));
    const { s, c } = await ecranTientSansScroll(page);
    verifier(s !== null && s <= c + 1, `${vp.nom} (${vp.width}×${vp.height}) — ECR-17 tient dans son budget (${s}/${c}px)`);
    await page.close();
  }

  for (const { ws } of sockets) ws.close();
}

// --- Scénario 2 : cercle à effectif maximal, VOEU et NEGOCIATION -----------

async function scenarioCercleSansChevauchement(navigateur) {
  dire('\nSCÉNARIO 2 — cercle à effectif maximal (VOEU, NEGOCIATION) : aucune carte ne doit en chevaucher une autre');
  const adhesions = await creerSession({ VOEU: 5, NEGOCIATION: 20 });
  const sockets = await connecterScripts(adhesions);
  const hote = sockets[0];
  const mesure = adhesions[adhesions.length - 1];

  const page = await ouvrirPage(navigateur, { width: 375, height: 667 }, jetonDe(mesure, false));

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1200);

  await dormir(5500); // VOEU (5s) expire — transition AUTOMATIQUE, aucune commande.
  const resultatVoeu = await cerclesSansChevauchement(page);
  verifier(
    resultatVoeu.nb === 8 && resultatVoeu.pairesChevauchantes === 0,
    `VOEU — ${resultatVoeu.nb} cartes, ${resultatVoeu.pairesChevauchantes} paire(s) chevauchante(s)`,
  );

  // NEGOCIATION suit VOEU AUTOMATIQUEMENT elle aussi (le minuteur de VOEU
  // l'a déjà déclenchée avant cette mesure) : avancer_phase ne sert qu'à
  // EN SORTIR vers DECLARATION_PAIEMENT (RG-72), pas à y entrer — l'envoyer
  // ici sauterait la mesure de NEGOCIATION elle-même.
  await dormir(1000);
  const resultatNego = await cerclesSansChevauchement(page);
  verifier(
    resultatNego.nb === 8 && resultatNego.pairesChevauchantes === 0,
    `NEGOCIATION — ${resultatNego.nb} cartes, ${resultatNego.pairesChevauchantes} paire(s) chevauchante(s)`,
  );

  await page.close();
  for (const { ws } of sockets) ws.close();
}

async function main() {
  dire('SANTÉ   :', JSON.stringify(await appeler('/sante')));
  const navigateur = await chromium.launch();
  try {
    await scenarioPaiementSecret(navigateur);
    // QUOTA_ADHESION (securite/limitation-debit.ts) : 10 adhesions par minute
    // et par IP. Chaque scénario en consomme 7 (8 joueurs moins l'hôte, qui
    // passe par /sessions et non par /sessions/:code/joueurs) — les enchaîner
    // sans attendre dépasserait le quota. La porte est voulue : on attend,
    // on ne la désarme pas pour ce script.
    await dormir(65_000);
    await scenarioCercleSansChevauchement(navigateur);
  } finally {
    await navigateur.close();
  }

  dire(`\n${echecs === 0 ? 'RÉSULTAT : toutes les assertions tiennent.' : `RÉSULTAT : ${echecs} assertion(s) en échec.`}`);
  if (echecs > 0) process.exit(1);
}

main().catch((erreur) => {
  console.error('ÉCHEC —', erreur.message, erreur.stack);
  process.exit(1);
});
