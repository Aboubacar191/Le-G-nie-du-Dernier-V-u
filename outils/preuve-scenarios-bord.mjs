#!/usr/bin/env node
// =============================================================================
// PREUVE SCÉNARIOS DE BORD — contre un serveur ET un client VIVANTS, jamais
// un mock (même philosophie que preuve-bout-en-bout.mjs et preuve-responsive.mjs).
//
// Couvre les quatre scénarios que les parties précédentes de l'audit n'avaient
// pas encore exercés en conditions réelles :
//   1. déconnexion PUIS reconnexion en cours de partie — et surtout : le
//      résumé global de fin de partie (nb_manches_closes, nb_voeux_exauces,
//      nb_mensonges_demasques — voir magasin/etat.ts) ne doit ni perdre ni
//      DOUBLER le mensonge démasqué avant la déconnexion, une fois la
//      resynchronisation complète reçue après coup ;
//   2. mensonges SIMULTANÉS : deux menteurs, deux accusateurs, même manche —
//      le compteur cumulé doit les compter tous les deux, sans quota qui en
//      avale un ;
//   3. solde nul : une déclaration qui dépasserait un solde tombé à zéro est
//      REFUSÉE (RG-08), une déclaration de zéro est acceptée et jugée
//      honnête (ampleur nulle) ;
//   4. abandon par l'hôte : AUCUNE fuite (RG-76) — ni rôle, ni mission, ni
//      score n'apparaît jamais sur un abandon.
//
// Usage : node --conditions=gdv-source outils/preuve-scenarios-bord.mjs
//         [--hote 127.0.0.1:8443] [--client http://localhost:5173]
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

const PSEUDOS = ['Alexandrine', 'Barthelemy', 'Celestine', 'Dagobert', 'Esperanza'];

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
  const id = crypto.randomUUID();
  ws.send(JSON.stringify({ id_correlation: id, type, charge }));
  return id;
}

/** Attend la PREMIÈRE trame d'un type donné, ou null après un délai. */
function attendreType(ws, type, delaiMs = 3000) {
  return new Promise((resoudre) => {
    const minuteur = setTimeout(() => {
      ws.off('message', surMessage);
      resoudre(null);
    }, delaiMs);
    function surMessage(trame) {
      const message = JSON.parse(trame.toString());
      if (message.type === type) {
        clearTimeout(minuteur);
        ws.off('message', surMessage);
        resoudre(message.charge);
      }
    }
    ws.on('message', surMessage);
  });
}

async function creerSession(configSurchargee) {
  const creation = await appeler('/sessions', {
    method: 'POST',
    body: JSON.stringify({ pseudo: PSEUDOS[0], config_surchargee: configSurchargee }),
  });
  const adhesions = [creation];
  for (const pseudo of PSEUDOS.slice(1)) {
    const corps = await appeler(`/sessions/${creation.code_adhesion}/joueurs`, {
      method: 'POST',
      body: JSON.stringify({ pseudo }),
    });
    adhesions.push(corps);
  }
  return adhesions;
}

async function connecterTous(adhesions) {
  const sockets = [];
  for (const adhesion of adhesions) {
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

async function ouvrirPage(navigateur, jeton) {
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.addInitScript((j) => localStorage.setItem('gdv.session', JSON.stringify(j)), jeton);
  page.on('pageerror', (e) => dire(`  [erreur page] ${e.message}`));
  await page.goto(URL_CLIENT);
  await page.waitForTimeout(1200);
  return page;
}

async function declarerEtPayer(ws, declare, paye) {
  envoyer(ws, 'declarer_contribution', { montant: declare });
  await dormir(200);
  envoyer(ws, 'payer_secret', { montant: paye });
  await dormir(200);
}

/** Joue VOEU→NEGOCIATION→DECLARATION_PAIEMENT→REVELATION→ENQUETES_ACCUSATIONS→EXECUTION. */
async function jouerUneManche(hote, contributions) {
  await dormir(2500); // VOEU → NEGOCIATION automatique.
  envoyer(hote.ws, 'avancer_phase', {}); // NEGOCIATION → DECLARATION_PAIEMENT.
  await dormir(500);
  for (const { ws, declare, paye } of contributions) {
    await declarerEtPayer(ws, declare, paye);
  }
  await dormir(3500); // DECLARATION_PAIEMENT → REVELATION automatique.
  await dormir(2500); // REVELATION → ENQUETES_ACCUSATIONS automatique.
}

// --- Scénario 1 : déconnexion puis reconnexion, résumé sans perte NI double compte --

async function scenarioDeconnexionReconnexion(navigateur) {
  dire('\nSCÉNARIO 1 — déconnexion en cours de partie, puis reconnexion : le résumé ne perd rien et ne double rien');
  const adhesions = await creerSession({
    nb_manches: 2,
    durees_phases_s: {
      VOEU: 2, NEGOCIATION: 2, DECLARATION_PAIEMENT: 3, REVELATION: 2, ENQUETES_ACCUSATIONS: 4, EXECUTION: 2,
    },
  });
  const sockets = await connecterTous(adhesions.slice(0, -1));
  const mesure = adhesions[adhesions.length - 1];
  const [hote, menteur, accusateur, honnete] = sockets;

  const page = await ouvrirPage(navigateur, jetonDe(mesure, false));

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1000);

  await jouerUneManche(hote, [
    { ws: menteur.ws, declare: 3, paye: 1 }, // MENTEUR, ampleur 2.
    { ws: hote.ws, declare: 2, paye: 2 },
    { ws: accusateur.ws, declare: 2, paye: 2 },
    { ws: honnete.ws, declare: 2, paye: 2 },
  ]);
  envoyer(accusateur.ws, 'accuser', { accuse_joueur_id: menteur.adhesion.joueur_id });
  await dormir(500); // accusation_declaree ET accusation_resolue (MENTEUR) partent IMMÉDIATEMENT.
  await dormir(4000); // ENQUETES_ACCUSATIONS → EXECUTION automatique (manche 1 close).
  await dormir(2500); // EXECUTION → ouverture de la manche 2 (nb_manches=2).

  // DÉCONNEXION puis RECONNEXION : un rechargement complet de page force une
  // ré-authentification depuis le jeton stocké (magasin.reprendre(), main.ts),
  // donc une étatCompletPrive FRAÎCHE — exactement le chemin qui doit
  // recalculer le résumé EN BLOC depuis historique_manches (reducteurs-session.ts)
  // sans jamais l'ajouter à ce qui avait déjà été compté en direct avant la
  // coupure (reducteurs-manche.ts) : l'un REMPLACE l'autre, par construction.
  await page.reload();
  await page.waitForTimeout(1200);

  // Manche 2 : tout le monde honnête, pour isoler le compte à UN SEUL menteur
  // détecté sur l'ensemble de la partie.
  await jouerUneManche(hote, [hote, menteur, accusateur, honnete].map((s) => ({ ws: s.ws, declare: 1, paye: 1 })));
  await dormir(4000); // ENQUETES_ACCUSATIONS → EXECUTION (manche 2 close, dernière : nb_manches=2).
  await dormir(2500); // EXECUTION → SCORES (apresCloture, plus de manche suivante).

  const resultat = await page.evaluate(() => ({
    extraitResume: (globalThis.document.querySelector('.scores__resume')?.textContent ?? '').trim(),
  }));
  dire(`  (rendu final : "${resultat.extraitResume}")`);
  verifier(
    resultat.extraitResume.includes('2') && resultat.extraitResume.includes('1 mensonge'),
    'après reconnexion, le résumé affiche 2 manches closes et EXACTEMENT 1 mensonge démasqué (ni perdu, ni doublé)',
  );

  await page.close();
  for (const { ws } of sockets) ws.close();
}

// --- Scénario 2 : deux menteurs, deux accusateurs, même manche ------------------

async function scenarioMensongesSimultanes(navigateur) {
  dire('\nSCÉNARIO 2 — deux mensonges démasqués SIMULTANÉMENT, par deux accusateurs distincts, même manche');
  const adhesions = await creerSession({
    nb_manches: 1,
    durees_phases_s: { VOEU: 2, NEGOCIATION: 2, DECLARATION_PAIEMENT: 3, REVELATION: 2, ENQUETES_ACCUSATIONS: 4, EXECUTION: 2 },
  });
  const sockets = await connecterTous(adhesions.slice(0, -1));
  const mesure = adhesions[adhesions.length - 1];
  const [hote, menteurA, menteurB, accusateur] = sockets;

  const page = await ouvrirPage(navigateur, jetonDe(mesure, false));

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1000);

  await jouerUneManche(hote, [
    { ws: menteurA.ws, declare: 3, paye: 1 }, // MENTEUR, ampleur 2.
    { ws: menteurB.ws, declare: 2, paye: 0 }, // MENTEUR, ampleur 2.
    { ws: hote.ws, declare: 1, paye: 1 },
    { ws: accusateur.ws, declare: 1, paye: 1 },
  ]);

  // RG-19 : un seul accusateur ne peut porter qu'UNE accusation par manche —
  // c'est pourquoi DEUX accusateurs distincts sont nécessaires ici.
  envoyer(accusateur.ws, 'accuser', { accuse_joueur_id: menteurA.adhesion.joueur_id });
  await dormir(300);
  envoyer(hote.ws, 'accuser', { accuse_joueur_id: menteurB.adhesion.joueur_id });
  await dormir(500);

  await dormir(4000);
  await dormir(2500);

  const resultat = await page.evaluate(() => (
    (globalThis.document.querySelector('.scores__resume')?.textContent ?? '').trim()
  ));
  dire(`  (rendu : "${resultat}")`);
  verifier(resultat.includes('2 mensonge'), 'les DEUX mensonges démasqués sont comptés, aucun avalé par le quota');

  await page.close();
  for (const { ws } of sockets) ws.close();
}

// --- Scénario 3 : solde nul — refus RG-08, puis déclaration de zéro acceptée ----

async function scenarioSoldeNul() {
  dire('\nSCÉNARIO 3 — solde tombé à zéro : une déclaration qui le dépasserait est REFUSÉE, zéro est accepté');
  const adhesions = await creerSession({
    nb_manches: 1,
    durees_phases_s: { VOEU: 2, NEGOCIATION: 3, DECLARATION_PAIEMENT: 3, REVELATION: 2, ENQUETES_ACCUSATIONS: 3, EXECUTION: 2 },
  });
  const sockets = await connecterTous(adhesions);
  const [hote, appauvri] = sockets;

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1000);

  await dormir(2500); // VOEU → NEGOCIATION.

  // RG-08/RG-41 : un transfert du PRINCIPAL ENTIER (12, la dotation par
  // défaut) à l'hôte ramène le solde de « appauvri » exactement à zéro —
  // zéro n'est pas négatif, donc autorisé (contrairement à un transfert de 13).
  envoyer(appauvri.ws, 'transferer_pieces', { cible_joueur_id: hote.adhesion.joueur_id, montant: 12 });
  const refusTransfert = await attendreType(appauvri.ws, 'erreur', 1500);
  verifier(refusTransfert === null, 'le transfert du solde ENTIER (12, pas plus) est ACCEPTÉ, pas refusé');

  envoyer(hote.ws, 'avancer_phase', {});
  await dormir(500);

  envoyer(appauvri.ws, 'declarer_contribution', { montant: 1 });
  const refusDeclaration = await attendreType(appauvri.ws, 'erreur', 1500);
  verifier(
    refusDeclaration?.code === 'MONTANT_INVALIDE',
    'déclarer 1 avec un solde de 0 est REFUSÉ en MONTANT_INVALIDE (RG-08), pas accepté silencieusement',
  );

  envoyer(appauvri.ws, 'declarer_contribution', { montant: 0 });
  await dormir(200);
  envoyer(appauvri.ws, 'payer_secret', { montant: 0 });
  const refusPaiement = await attendreType(appauvri.ws, 'erreur', 1500);
  verifier(refusPaiement === null, 'déclarer 0 puis payer 0 est ACCEPTÉ (RG-32 : non-soumission vaut déjà 0, mais 0 explicite doit l’être aussi)');

  for (const { ws } of sockets) ws.close();
}

// --- Scénario 4 : abandon par l'hôte — RG-76 (aucune fuite) --------------------

async function scenarioAbandonHote(navigateur) {
  dire('\nSCÉNARIO 4 — abandon par l\'hôte : aucune fuite de rôle/mission/score (RG-76)');
  const adhesions = await creerSession({
    nb_manches: 1,
    durees_phases_s: { VOEU: 3, NEGOCIATION: 60, DECLARATION_PAIEMENT: 30, REVELATION: 20, ENQUETES_ACCUSATIONS: 60, EXECUTION: 30 },
  });
  const sockets = await connecterTous(adhesions.slice(0, -1));
  const mesure = adhesions[adhesions.length - 1];
  const [hote] = sockets;

  const page = await ouvrirPage(navigateur, jetonDe(mesure, false));

  envoyer(hote.ws, 'demarrer_partie', {});
  await dormir(400);
  envoyer(hote.ws, 'definir_ordre_places', { ordre: adhesions.map((a) => a.joueur_id) });
  await dormir(1000); // En VOEU : chacun a déjà reçu rôle, mission, clause (secrets PRIVÉS distribués).

  envoyer(hote.ws, 'abandonner_partie', { confirmation: true });
  await dormir(800);

  const resultat = await page.evaluate(() => {
    const corps = globalThis.document.body.textContent ?? '';
    return {
      aucunRole: !/INSPECTEUR_TRESOR|MARCHAND_EPICES|FAISEUR_CONTRATS|PRETEUR/u.test(corps),
      aucunTableauScores: globalThis.document.querySelector('.scores__table') === null,
    };
  });
  verifier(resultat.aucunRole, 'aucun rôle secret ne fuit sur l’écran d’abandon (RG-76)');
  verifier(resultat.aucunTableauScores, 'aucun tableau de scores ne s’affiche sur un abandon (RG-76 : révélation réservée à SCORES)');

  for (const { ws } of sockets) ws.close();
  await page.close();
}

async function main() {
  dire(`SANTÉ   : ${JSON.stringify(await appeler('/sante'))}`);
  const navigateur = await chromium.launch();
  try {
    await scenarioDeconnexionReconnexion(navigateur);
    await dormir(20_000); // QUOTA_ADHESION : laisse retomber le débit avant la prochaine salve de rejoint.
    await scenarioMensongesSimultanes(navigateur);
    await dormir(20_000);
    await scenarioSoldeNul();
    await dormir(20_000);
    await scenarioAbandonHote(navigateur);
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
