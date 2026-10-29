// SONDE — AXE 3 : machine à états de la manche, pipeline, invariant monétaire.
//
// Quatre mesures :
//   (A) ordre des phases sur une partie complète de 5 manches (RG-30) ;
//   (B) matrice commande × phase : 12 commandes confrontées aux 6 phases, et
//       vérification que l'état est INCHANGÉ après un refus (CA-43) ;
//   (C) les 17 étapes du pipeline, dans l'ordre, et sensibilité à l'ordre
//       (étape 13 avant étape 15) ;
//   (D) invariant monétaire RECALCULÉ ici, sans verifierInvariants : pour chaque
//       joueur, solde == somme de ses mouvements, et aucun solde négatif.

import { ETAPES, NOMBRE_ETAPES_PIPELINE, type EtatSession } from '@gdv/moteur';
import type { Phase, TypeCommande } from '@gdv/partage';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

const PHASES_ATTENDUES: readonly Phase[] = [
  'VOEU',
  'NEGOCIATION',
  'DECLARATION_PAIEMENT',
  'REVELATION',
  'ENQUETES_ACCUSATIONS',
  'EXECUTION',
];

const COMMANDES: readonly TypeCommande[] = [
  'definir_ordre_places',
  'demarrer_partie',
  'avancer_phase',
  'transferer_pieces',
  'proposer_pret',
  'repondre_pret',
  'declarer_contribution',
  'payer_secret',
  'lancer_enquete',
  'accuser',
  'signer_dernier_voeu',
  'abandonner_partie',
];

/** Charge plausible pour chaque commande : le refus doit venir de la PHASE, pas du schéma. */
const CHARGES: Readonly<Record<string, Record<string, unknown>>> = {
  definir_ordre_places: { ordre: ['J0', 'J1', 'J2', 'J3', 'J4', 'J5'] },
  demarrer_partie: {},
  avancer_phase: {},
  transferer_pieces: { cible_joueur_id: 'J1', montant: 1 },
  proposer_pret: { emprunteur_joueur_id: 'J1', principal: 1 },
  repondre_pret: { pret_id: 'qa-inexistant', accepte: true },
  declarer_contribution: { montant: 1 },
  payer_secret: { montant: 1 },
  lancer_enquete: { cible_joueur_id: 'J1' },
  accuser: { accuse_joueur_id: 'J1' },
  signer_dernier_voeu: { a_signe: true },
  abandonner_partie: { confirmation: true },
};

const ACTIONS_ATTENDUES: Readonly<Record<string, readonly TypeCommande[]>> = {
  VOEU: [],
  NEGOCIATION: ['transferer_pieces', 'proposer_pret', 'repondre_pret', 'avancer_phase'],
  DECLARATION_PAIEMENT: ['declarer_contribution', 'payer_secret'],
  REVELATION: [],
  ENQUETES_ACCUSATIONS: ['lancer_enquete', 'accuser'],
  EXECUTION: [],
};

// --- (A) Ordre des phases ----------------------------------------------------

titre('(A) Ordre des phases sur une partie de 5 manches (RG-30)');
const partie = new Banc({ joueurs: 6, graine: 'machine-etats' });
partie.demarrer();
const sequence: string[] = [];
for (let pas = 0; pas < 40; pas += 1) {
  sequence.push(`${String(partie.etat.manche_courante)}:${String(partie.etat.phase)}`);
  if (partie.etat.etat_partie === 'TERMINEE') break;
  partie.expirer();
}
mesure('séquence observée', sequence);
const phasesSeules = sequence
  .map((entree) => entree.split(':')[1])
  .filter((phase) => PHASES_ATTENDUES.includes(phase as Phase));
const attendue = Array.from({ length: 5 }, () => PHASES_ATTENDUES).flat();
verdict(
  'les 5 manches enchaînent exactement les 6 phases, sans saut ni retour',
  JSON.stringify(phasesSeules) === JSON.stringify(attendue),
  `observé ${phasesSeules.length} phases`,
);
mesure('état de partie final', partie.etat.etat_partie);
mesure('manches clôturées', partie.etat.manches.filter((manche) => manche.cloture).length);

// --- (B) Matrice commande × phase -------------------------------------------

titre('(B) Matrice commande × phase : toute action hors phase est REJETÉE (CA-43)');

function empreinte(etat: EtatSession): string {
  return JSON.stringify({
    phase: etat.phase,
    manche: etat.manche_courante,
    etat_partie: etat.etat_partie,
    soldes: etat.joueurs.map((joueur) => joueur.solde_pieces),
    contributions: etat.manches.map((manche) => manche.contributions.length),
    accusations: etat.manches.map((manche) => manche.accusations.length),
    enquetes: etat.manches.map((manche) => manche.enquetes.length),
    prets: etat.prets.length,
    mouvements: etat.mouvements.length,
  });
}

/** Couples (phase, commande) refusés, avec le constat d'état inchangé (CA-43). */
const inchange: [string, boolean][] = [];

for (const phase of PHASES_ATTENDUES) {
  const acceptees: string[] = [];
  const codes: Record<string, string> = {};
  for (const commande of COMMANDES) {
    // UNE TABLE NEUVE PAR COMMANDE : une commande acceptée modifierait la phase
    // et fausserait toutes les mesures suivantes.
    const banc = new Banc({ joueurs: 6, graine: `matrice-${phase}-${commande}` });
    banc.demarrer();
    banc.allerA(phase);
    const avant = empreinte(banc.etat);
    const resultat = banc.cmd('J0', commande, { ...CHARGES[commande] });
    if (resultat.ok) {
      acceptees.push(commande);
      codes[commande] = 'ACCEPTEE';
    } else {
      codes[commande] = (resultat.erreur as { code: string }).code;
      inchange.push([`${phase} / ${commande}`, avant === empreinte(banc.etat)]);
    }
  }
  mesure(`phase ${phase} — codes`, codes);
  const attenduesIci = [...(ACTIONS_ATTENDUES[phase] ?? [])];
  const horsTable = acceptees.filter((commande) => !attenduesIci.includes(commande as TypeCommande));
  verdict(
    `phase ${phase} : aucune commande hors de ACTIONS_PAR_PHASE acceptée`,
    horsTable.filter((commande) => commande !== 'abandonner_partie').length === 0,
    `acceptées : ${acceptees.join(', ')}`,
  );
}

mesure('refus dont l’état est resté strictement inchangé', [inchange.length, inchange.filter(([, ok]) => ok).length]);
verdict(
  'CA-43 — aucun refus ne modifie l’état',
  inchange.every(([, ok]) => ok),
  inchange.filter(([, ok]) => !ok).map(([nom]) => nom).join(', '),
);

titre('(B bis) Usurpation d’identité (CA-44) et commande inexistante');
const bancUsurpation = new Banc({ joueurs: 6, graine: 'usurpation' });
bancUsurpation.demarrer();
bancUsurpation.allerA('DECLARATION_PAIEMENT');
const usurpation = bancUsurpation.cmd('J1', 'declarer_contribution', {
  montant: 4,
  joueur_id: 'J2',
});
mesure('declarer_contribution avec joueur_id d’autrui', usurpation.ok ? 'ACCEPTEE' : (usurpation.erreur as { code: string }).code);
verdict('usurpation refusée', !usurpation.ok && (usurpation.erreur as { code: string }).code === 'USURPATION_IDENTITE');
const authentifier = bancUsurpation.cmd('J1', 'authentifier', { jeton: 'x' });
mesure('authentifier soumise comme commande de jeu', authentifier.ok ? 'ACCEPTEE' : (authentifier.erreur as { code: string }).code);
verdict('authentifier n’est pas une commande de jeu', !authentifier.ok);

// --- (C) Pipeline : 17 étapes dans l'ordre ----------------------------------

titre('(C) Pipeline : 17 étapes, ordre normatif (RG-40)');
mesure('NOMBRE_ETAPES_PIPELINE', NOMBRE_ETAPES_PIPELINE);
mesure('ETAPES.length', ETAPES.length);
const noms = ETAPES.map((etape) => etape.name);
mesure('ordre des étapes (noms de fonctions)', noms);
const nomsAttendus = Array.from({ length: 17 }, (_, index) => `etape${String(index + 1).padStart(2, '0')}`);
verdict('17 étapes', ETAPES.length === 17 && NOMBRE_ETAPES_PIPELINE === 17);
verdict('ordre etape01 → etape17', JSON.stringify(noms) === JSON.stringify(nomsAttendus));

titre('(C bis) Sensibilité à l’ordre : l’amende (13) est prélevée avant le prêt (15)');
const ordre = new Banc({ joueurs: 6, graine: 'ordre-13-avant-15' });
ordre.demarrer();
for (const joueur of ordre.joueurs) ordre.imposerRole(joueur, 'FAISEUR_CONTRATS');
ordre.imposerRole('J2', 'PRETEUR');
ordre.imposerClause('TRESOR_DES_HONNETES');
ordre.allerA('NEGOCIATION');
ordre.exiger('J2', 'proposer_pret', { emprunteur_joueur_id: 'J5', principal: 6 });
const pretId = ordre.etat.prets[0]?.id ?? '';
ordre.exiger('J5', 'repondre_pret', { pret_id: pretId, accepte: true });
ordre.allerA('DECLARATION_PAIEMENT');
for (const joueur of ordre.joueurs) ordre.exiger(joueur, 'declarer_contribution', { montant: 0 });
for (const joueur of ordre.joueurs) ordre.exiger(joueur, 'payer_secret', { montant: 0 });
ordre.allerA('EXECUTION');
ordre.expirer();
// Manche 2 : J5 se vide, mentira, et sera accusé. Son dû de prêt est de 9.
ordre.imposerClause('TRESOR_DES_HONNETES');
ordre.allerA('NEGOCIATION');
ordre.exiger('J5', 'transferer_pieces', { cible_joueur_id: 'J4', montant: 14 });
mesure('solde de J5 avant déclaration', ordre.solde('J5'));
ordre.allerA('DECLARATION_PAIEMENT');
const declarations = [0, 0, 0, 0, 0, 4];
ordre.joueurs.forEach((joueur, index) => {
  ordre.exiger(joueur, 'declarer_contribution', { montant: declarations[index] ?? 0 });
});
ordre.joueurs.forEach((joueur) => ordre.exiger(joueur, 'payer_secret', { montant: 0 }));
ordre.allerA('ENQUETES_ACCUSATIONS');
ordre.exiger('J0', 'accuser', { accuse_joueur_id: 'J5' });
const soldeAvantExecution = ordre.solde('J5');
mesure('solde de J5 à l’entrée de l’exécution', soldeAvantExecution);
ordre.allerA('EXECUTION');
const accusation = ordre.manche(2).accusations[0];
mesure('amende due / liquidée', [accusation?.montant_amende_du, accusation?.montant_amende_liquide]);
mesure('solde de l’accusateur J0 après exécution', ordre.solde('J0'));
const pretApres = ordre.etat.prets[0];
mesure('prêt après exécution', [pretApres?.rembourse, pretApres?.du_total, pretApres?.statut]);
verdict(
  'l’amende est servie avant le remboursement du prêt (étape 13 < étape 15)',
  (accusation?.montant_amende_liquide ?? 0) === Math.min(8, soldeAvantExecution) &&
    (pretApres?.rembourse ?? -1) === Math.max(0, soldeAvantExecution - (accusation?.montant_amende_liquide ?? 0)),
  `amende liquidée ${String(accusation?.montant_amende_liquide)} sur un solde de ${String(soldeAvantExecution)}, remboursement ${String(pretApres?.rembourse)}`,
);
verdict('aucun solde négatif après liquidation', ordre.etat.joueurs.every((joueur) => joueur.solde_pieces >= 0));

// --- (D) Invariant monétaire recalculé --------------------------------------

titre('(D) RG-41 / RG-42 recalculés indépendamment');

function controlerMonnaie(etat: EtatSession, etiquette: string): void {
  const negatifs = etat.joueurs.filter((joueur) => joueur.solde_pieces < 0).map((joueur) => joueur.id);
  const incoherents: string[] = [];
  for (const joueur of etat.joueurs) {
    const somme = etat.mouvements
      .filter((mouvement) => mouvement.joueur_id === joueur.id)
      .reduce((total, mouvement) => total + mouvement.delta, 0);
    if (somme !== joueur.solde_pieces) incoherents.push(`${joueur.id}:${String(somme)}≠${String(joueur.solde_pieces)}`);
  }
  verdict(`${etiquette} — aucun solde négatif (RG-41)`, negatifs.length === 0, negatifs.join(','));
  verdict(`${etiquette} — solde = somme des mouvements (RG-42)`, incoherents.length === 0, incoherents.join(','));
}

controlerMonnaie(partie.etat, 'partie de 5 manches');
controlerMonnaie(ordre.etat, 'scénario amende + prêt');

titre('(D bis) Vérification du journal : solde_apres cohérent à chaque ligne');
const cumul = new Map<string, number>();
const ruptures: string[] = [];
for (const mouvement of [...partie.etat.mouvements].sort((a, b) => a.sequence - b.sequence)) {
  const avant = cumul.get(mouvement.joueur_id) ?? 0;
  const apres = avant + mouvement.delta;
  cumul.set(mouvement.joueur_id, apres);
  if (mouvement.solde_apres !== apres) {
    ruptures.push(`${mouvement.joueur_id}#${String(mouvement.sequence)}`);
  }
  if (apres < 0) ruptures.push(`negatif:${mouvement.joueur_id}#${String(mouvement.sequence)}`);
}
mesure('mouvements journalisés', partie.etat.mouvements.length);
verdict('chaque solde_apres est le cumul exact des deltas', ruptures.length === 0, ruptures.join(','));

bilan('machine-etats');
