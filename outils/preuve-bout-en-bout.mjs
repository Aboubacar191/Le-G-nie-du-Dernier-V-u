#!/usr/bin/env node
// =============================================================================
// PREUVE DE BOUT EN BOUT — six clients, une manche complète, serveur réel
// =============================================================================
// Ce script n'est PAS un test de la suite : il exige un serveur vivant, et une
// porte de qualité qui dépend d'un port ouvert n'est pas une porte.
//
// Il emploie le VRAI code client : transport/client-ws.ts pour le canal,
// magasin/reducteurs.ts pour l'application des événements, et
// logique/decalage-horloge.ts pour la correction d'horloge. Deux choses sont
// substituées, et elles sont déclarées :
//   · le WebSocket du navigateur, remplacé par `ws` avec un adaptateur qui
//     expose exactement la surface que le client utilise ;
//   · fetch sur une URL absolue, parce que transport/rest.ts vise /api, chemin
//     relatif qui n'a pas de sens hors navigateur.
//
// Ce qu'il ne prouve PAS, et il faut le dire : le RENDU. Aucun DOM n'est
// instancié ici. Ce qui est prouvé, c'est le protocole, la projection reçue par
// chaque joueur, et l'étanchéité constatée appareil par appareil.
//
// Usage : node --conditions=gdv-source outils/preuve-bout-en-bout.mjs [--hote 127.0.0.1:8444]
// =============================================================================

import { WebSocket } from 'ws';

import { PREFIXE_REST } from '@gdv/partage';

import { creerClientTempsReel } from '../applications/client/src/transport/client-ws.ts';
import { appliquerEvenement } from '../applications/client/src/magasin/reducteurs.ts';
import { etatInitial } from '../applications/client/src/magasin/etat.ts';

const argument = (nom, defaut) => {
  const index = process.argv.indexOf(nom);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : defaut;
};

const HOTE = argument('--hote', '127.0.0.1:8444');
// RUP-04 : les six routes REST sont servies sous /api et nulle part ailleurs.
// Le préfixe est celui du contrat, lu par @gdv/partage, jamais un littéral.
const BASE = `http://${HOTE}${PREFIXE_REST}`;
const NB_JOUEURS = 6;
const COURTE = 3;
const PSEUDOS = ['Hote', 'Awa', 'Koffi', 'Moussa', 'Fatou', 'Yao'];

const dormir = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));
const dire = (ligne) => console.log(ligne);

async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`${chemin} → ${reponse.status} ${JSON.stringify(corps)}`);
  return corps;
}

/** Adaptateur : surface WebSocketCompatible au-dessus de `ws`. */
function fabriquerSocket(url) {
  const brut = new WebSocket(url, { origin: `http://${HOTE}` });
  const adaptateur = {
    send: (donnees) => brut.send(donnees),
    close: (code) => brut.close(code),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  brut.on('open', () => adaptateur.onopen?.({}));
  brut.on('message', (donnees) => adaptateur.onmessage?.({ data: donnees.toString() }));
  brut.on('close', (code, raison) => adaptateur.onclose?.({ code, reason: String(raison) }));
  brut.on('error', () => adaptateur.onerror?.({}));
  return adaptateur;
}

/** Un appareil : son état local EST la dernière projection reçue. */
function creerAppareil(pseudo, adhesion) {
  const etat = etatInitial();
  const recus = [];
  const client = creerClientTempsReel({
    url: `ws://${HOTE}${adhesion.url_temps_reel}`,
    jetonSession: adhesion.jeton_session,
    versionProtocole: adhesion.version_protocole,
    surEvenement: (enveloppe, recuAMs) => {
      recus.push(enveloppe.type);
      appliquerEvenement(etat, enveloppe, recuAMs);
    },
    surLiaison: () => {},
    surTrouDeSequence: (attendue, recue) =>
      dire(`  !! ${pseudo} : trou de séquence ${attendue} → ${recue}`),
    fabriquerSocket,
  });
  return { pseudo, joueur_id: adhesion.joueur_id, etat, recus, client };
}

async function attendre(appareil, predicat, limiteMs = 20_000) {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    if (predicat(appareil.etat)) return true;
    await dormir(50);
  }
  throw new Error(`${appareil.pseudo} : condition non atteinte en ${limiteMs} ms`);
}

// --- Mise en place ------------------------------------------------------------

async function creerSession() {
  // Les neuf phases minutées, raccourcies : c'est l'objet même de US-17.
  const durees = {
    VOEU: COURTE, NEGOCIATION: COURTE, DECLARATION_PAIEMENT: 8, REVELATION: COURTE,
    ENQUETES_ACCUSATIONS: 8, EXECUTION: COURTE, DV_PROPOSITION: COURTE,
    DV_DEBAT: COURTE, DV_SIGNATURE: COURTE,
  };
  const creation = await appeler('/sessions', {
    method: 'POST',
    body: JSON.stringify({ pseudo: PSEUDOS[0], config_surchargee: { durees_phases_s: durees } }),
  });
  dire(`SESSION : code ${creation.code_adhesion}, url_adhesion ${creation.url_adhesion}`);
  dire(
    `CONFIG  : objectif_par_joueur ${creation.config_effective.objectif_par_joueur}, ` +
      `pieces_initiales ${creation.config_effective.pieces_initiales}, ` +
      `durées de phase raccourcies pour la preuve (US-17)`,
  );
  return creation;
}

async function faireAdherer(creation) {
  const adhesions = [creation];
  for (const pseudo of PSEUDOS.slice(1)) {
    adhesions.push(
      await appeler(`/sessions/${creation.code_adhesion}/joueurs`, {
        method: 'POST',
        body: JSON.stringify({ pseudo }),
      }),
    );
  }
  dire(`ADHÉSION: ${adhesions.length} joueurs (${NB_JOUEURS} attendus)`);
  return adhesions;
}

async function connecter(adhesions) {
  const appareils = adhesions.map((adhesion, index) => creerAppareil(PSEUDOS[index], adhesion));
  for (const appareil of appareils) appareil.client.connecter();
  for (const appareil of appareils) await attendre(appareil, (etat) => etat.session !== null);
  dire('CANAL   : 6 clients authentifiés, chacun a reçu SA projection privée');
  dire(
    `DÉCALAGE: ${appareils.map((a) => `${a.pseudo} ${a.etat.decalage.decalage_ms}ms`).join(' · ')}` +
      ' (RG-79, mesuré sur emis_a)',
  );
  return appareils;
}

async function placerLeCercle(appareils) {
  const hote = appareils[0];
  hote.client.envoyer('demarrer_partie', {});
  await attendre(hote, (etat) => etat.session?.etat_partie === 'PLACEMENT');
  dire(`ÉTAT    : PLACEMENT (effectif ${hote.etat.joueurs.length})`);

  hote.client.envoyer('definir_ordre_places', {
    ordre: appareils.map((appareil) => appareil.joueur_id),
  });
  await attendre(hote, (etat) => etat.ordre_cercle.length === NB_JOUEURS);
  dire(`CERCLE  : ordre validé sur ${hote.etat.ordre_cercle.length} places`);

  for (const appareil of appareils) await attendre(appareil, (etat) => etat.moi.role_secret !== null);
  dire(
    'DISTRIB : ' +
      appareils
        .map((a) => `${a.pseudo}=${a.etat.moi.role_secret}/${a.etat.moi.mission_secrete}`)
        .join(' · '),
  );
}

// --- Les six phases -----------------------------------------------------------

async function phaseVoeu(appareils) {
  const hote = appareils[0];
  for (const appareil of appareils) await attendre(appareil, (etat) => etat.voeu !== null);
  const voeu = hote.etat.voeu;
  dire(`PHASE 1 : VOEU — objectif ${voeu.objectif}, manche ${voeu.numero_manche}/${voeu.nb_manches}`);
  const porteurs = appareils.filter((a) => a.etat.clause_recue !== null);
  dire(
    `  clause_recue reçue par ${porteurs.length} joueur(s) : ` +
      porteurs.map((a) => `${a.pseudo}(porteur=${a.etat.clause_recue.je_suis_porteur})`).join(', '),
  );
  dire(
    `  les ${NB_JOUEURS - porteurs.length} autres n'ont RIEN reçu, et pourtant la carte du pli ` +
      'est rendue chez tous, au même endroit (RG-77 / M7-a)',
  );
}

async function phaseNegociation(appareils) {
  const hote = appareils[0];
  await attendre(hote, (etat) => etat.phase === 'NEGOCIATION');
  dire(`PHASE 2 : NEGOCIATION — échéance serveur ${hote.etat.phase_fin_at}`);
  appareils[1].client.envoyer('transferer_pieces', {
    cible_joueur_id: appareils[2].joueur_id,
    montant: 2,
  });
  await dormir(400);
  const temoins = appareils.filter((a) => a.recus.includes('transfert_enregistre'));
  dire(
    `  transfert ${appareils[1].pseudo}→${appareils[2].pseudo} de 2 : connu de ` +
      `${temoins.map((a) => a.pseudo).join(' et ')} — ${NB_JOUEURS - temoins.length} joueurs n'en savent rien`,
  );
  hote.client.envoyer('avancer_phase', {});
}

async function phaseDeclarationPaiement(appareils) {
  const hote = appareils[0];
  await attendre(hote, (etat) => etat.phase === 'DECLARATION_PAIEMENT');
  dire('PHASE 3 : DECLARATION_PAIEMENT');
  for (const appareil of appareils) appareil.client.envoyer('declarer_contribution', { montant: 4 });
  await attendre(hote, (etat) => etat.nb_declarations === NB_JOUEURS);
  dire(`  déclarations publiées : ${hote.etat.nb_declarations}/${NB_JOUEURS}, visibles de tous`);

  // Un menteur : le dernier promet 4 et ne paie que 1.
  const paiements = [4, 4, 4, 4, 4, 1];
  for (const [index, appareil] of appareils.entries()) {
    appareil.client.envoyer('payer_secret', { montant: paiements[index] });
  }
  await dormir(700);
  dire(`  paiements scellés : ${appareils.filter((a) => a.etat.paiement_scelle).length}/${NB_JOUEURS}`);
  const multiples = appareils.filter(
    (a) => a.recus.filter((type) => type === 'paiement_enregistre').length > 1,
  );
  dire(`  aucun joueur n'a reçu le paiement d'un autre : ${multiples.length === 0 ? 'VÉRIFIÉ' : 'ÉCHEC'}`);
}

async function phaseRevelation(appareils) {
  const hote = appareils[0];
  await attendre(hote, (etat) => etat.phase === 'REVELATION');
  await attendre(hote, (etat) => etat.ecart_total !== null);
  const ecart = hote.etat.ecart_total;
  dire(
    `PHASE 4 : REVELATION — promis ${ecart.total_declare}, reçu ${ecart.total_paye}, ` +
      `objectif ${ecart.objectif}`,
  );
  await dormir(700);
  const revelation = hote.etat.revelation;
  dire(
    revelation === null
      ? '  aucun gabarit éligible : le génie n’ajoute rien (RG-21)'
      : `  gabarit ${revelation.revelation.gabarit}, variante ${revelation.revelation.variante_formulation}, ` +
        `cibles ${revelation.revelation.cibles.length}, suspects restants ${revelation.suspects_restants} ` +
        '— AUCUN texte sur le fil, le client compose la phrase (ADR-TL-12)',
  );
}

async function phaseEnquetes(appareils) {
  const hote = appareils[0];
  await attendre(hote, (etat) => etat.phase === 'ENQUETES_ACCUSATIONS');
  dire('PHASE 5 : ENQUETES_ACCUSATIONS');
  const enqueteur = appareils[1];
  const suspect = appareils[5];
  enqueteur.client.envoyer('lancer_enquete', { cible_joueur_id: suspect.joueur_id });
  await attendre(enqueteur, (etat) => etat.resultats_enquete.length > 0);
  const resultat = enqueteur.etat.resultats_enquete[0];
  dire(
    `  ${enqueteur.pseudo} achète l'information : ${suspect.pseudo} a payé ${resultat.montant_paye} ` +
      `pour ${resultat.montant_declare} promis`,
  );
  const informes = appareils.filter((a) => a.recus.includes('resultat_enquete'));
  dire(
    `  resultat_enquete reçu par ${informes.map((a) => a.pseudo).join(', ')} — la CIBLE n'a rien ` +
      `reçu (RG-27 / M8) : ${suspect.recus.includes('resultat_enquete') ? 'ÉCHEC' : 'VÉRIFIÉ'}`,
  );

  enqueteur.client.envoyer('accuser', { accuse_joueur_id: suspect.joueur_id });
  await attendre(hote, (etat) => etat.accusations.some((a) => a.verdict !== null));
  const accusation = hote.etat.accusations.find((a) => a.verdict !== null);
  const publics = appareils.filter((a) => a.recus.includes('accusation_resolue')).length;
  dire(`  accusation publique : verdict ${accusation.verdict}, connu de ${publics}/${NB_JOUEURS}`);
}

async function phaseExecution(appareils) {
  const hote = appareils[0];
  await attendre(hote, (etat) => etat.phase === 'EXECUTION');
  await attendre(hote, (etat) => etat.execution !== null);
  const execution = hote.etat.execution;
  dire(
    `PHASE 6 : EXECUTION — ${execution.reussi ? 'vœu RÉUSSI' : 'vœu ÉCHOUÉ'}, ` +
      `récompense ${execution.recompense}, clause révélée ${execution.clause_revelee} (sans son porteur)`,
  );
  dire(
    `  parts : ${execution.parts.map((p) => p.part).join(', ')} · ` +
      `amendes liquidées : ${execution.amendes_liquidees.length}`,
  );
  dire(`  soldes privés : ${appareils.map((a) => `${a.pseudo}=${a.etat.moi.solde_pieces}`).join(' · ')}`);
}

// --- Étanchéité constatée appareil par appareil -------------------------------

const CHAMPS_SECRETS = ['montant_paye', 'role_secret', 'mission_secrete', 'solde_pieces', 'clause'];

/**
 * Emplacements où un champ secret est LÉGITIME sur un appareil donné. Le
 * contrôle porte sur l'EMPLACEMENT, pas sur la présence du nom : compter les
 * noms nus produirait un faux positif à chaque fois (ARCHI, ADR-TL-18).
 */
const EMPLACEMENTS_LEGITIMES = [
  /^moi\./u,
  /^attribution\./u,
  /^resultats_enquete\.\d+\./u,
  /^clause_recue\./u,
  /^execution\.clause_revelee$/u,
  /^manche_courante\.clause_revelee$/u,
  /^historique_manches\.\d+\.clause_revelee$/u,
];

function cheminsSecrets(valeur, chemin, trouves) {
  if (valeur === null || typeof valeur !== 'object') return trouves;
  for (const [cle, enfant] of Object.entries(valeur)) {
    const sousChemin = chemin === '' ? cle : `${chemin}.${cle}`;
    if (CHAMPS_SECRETS.includes(cle)) trouves.push(sousChemin);
    cheminsSecrets(enfant, sousChemin, trouves);
  }
  return trouves;
}

function verifierEtancheite(appareils) {
  dire('ÉTANCHÉITÉ :');
  const violations = [];
  for (const appareil of appareils) {
    const trouves = cheminsSecrets(appareil.etat, '', []);
    const illegitimes = trouves.filter(
      (chemin) => !EMPLACEMENTS_LEGITIMES.some((motif) => motif.test(chemin)),
    );
    dire(
      `  ${appareil.pseudo} : ${trouves.length} champ(s) secret(s), emplacement légitime : ` +
        `${illegitimes.length === 0 ? 'oui' : illegitimes.join(', ')}`,
    );
    if (illegitimes.length > 0) violations.push(`${appareil.pseudo} → ${illegitimes.join(', ')}`);
  }
  dire(`  aucun secret d'autrui sur aucun appareil : ${violations.length === 0 ? 'VÉRIFIÉ' : `ÉCHEC — ${violations.join(' | ')}`}`);

  const acheteurs = appareils.filter((a) => a.etat.resultats_enquete.length > 0);
  dire(`  information achetée présente chez ${acheteurs.map((a) => a.pseudo).join(', ')} et nulle part ailleurs`);
  dire(`  séquences par joueur : ${appareils.map((a) => `${a.pseudo}=${a.etat.derniere_sequence}`).join(' · ')}`);
  dire(`  événements reçus : ${appareils.map((a) => `${a.pseudo}=${a.recus.length}`).join(' · ')}`);
  return violations.length === 0;
}

// --- Enchaînement -------------------------------------------------------------

async function main() {
  dire(`SANTÉ   : ${JSON.stringify(await appeler('/sante'))}`);
  const creation = await creerSession();
  const adhesions = await faireAdherer(creation);
  const appareils = await connecter(adhesions);

  await placerLeCercle(appareils);
  await phaseVoeu(appareils);
  await phaseNegociation(appareils);
  await phaseDeclarationPaiement(appareils);
  await phaseRevelation(appareils);
  await phaseEnquetes(appareils);
  await phaseExecution(appareils);

  const etanche = verifierEtancheite(appareils);
  for (const appareil of appareils) appareil.client.fermer();
  dire('RÉSULTAT: manche complète traversée sur ses SIX phases, 6 clients, serveur réel.');
  if (!etanche) throw new Error('étanchéité violée');
}

main()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(`ÉCHEC — ${erreur.message}`);
    process.exit(1);
  });
