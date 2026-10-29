// SONDE — AXE 2 : la matrice de gains du GDD, remesurée depuis le moteur réel.
//
// Cadre de référence NORMATIF (SPEC verification_matrice_gains.cadre_de_reference_normatif) :
//   6 joueurs, objectif 18, chacun déclare 4, les honnêtes paient 4, le menteur paie 1,
//   pouvoirs de rôle neutralisés, clause sans effet sur le cas mesuré.
//
// Aucun test des développeurs n'est réutilisé : les différences de solde sont
// relevées sur l'état du moteur, avant et après l'exécution.

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

const DECLARATION = 4;
const PAIEMENT_HONNETE = 4;
const PAIEMENT_MENTEUR = 1;

/** Tous les rôles identiques et sans effet monétaire : le bonus d'épices est neutralisé. */
function bancNeutre(): Banc {
  const banc = new Banc({ joueurs: 6, graine: 'matrice-gains-audit' });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  // CONSOLATION ne s'applique qu'à l'échec : inerte sur un vœu réussi.
  banc.imposerClause('CONSOLATION');
  return banc;
}

interface Resultat {
  readonly deltas: Record<string, number>;
  readonly banc: Banc;
}

function jouerManche(accusation: readonly [string, string] | null, paiements: readonly number[]): Resultat {
  const banc = bancNeutre();
  banc.allerA('DECLARATION_PAIEMENT');
  const avant: Record<string, number> = {};
  for (const joueur of banc.joueurs) avant[joueur] = banc.solde(joueur);
  banc.declarerPuisPayer(paiements.map((paye) => [DECLARATION, paye] as const));
  if (banc.etat.phase !== 'ENQUETES_ACCUSATIONS') banc.allerA('ENQUETES_ACCUSATIONS');
  if (accusation !== null) banc.exiger(accusation[0], 'accuser', { accuse_joueur_id: accusation[1] });
  banc.allerA('EXECUTION');
  const deltas: Record<string, number> = {};
  for (const joueur of banc.joueurs) deltas[joueur] = banc.solde(joueur) - (avant[joueur] ?? 0);
  return { deltas, banc };
}

const PAIEMENTS_UN_MENTEUR = [
  PAIEMENT_HONNETE,
  PAIEMENT_HONNETE,
  PAIEMENT_HONNETE,
  PAIEMENT_HONNETE,
  PAIEMENT_HONNETE,
  PAIEMENT_MENTEUR,
];

titre('Cadre normatif : 6 joueurs, objectif 18, déclarations 4, menteur J5 paie 1');
const impuni = jouerManche(null, PAIEMENTS_UN_MENTEUR);
const mancheImpuni = impuni.banc.manche(1);
mesure('objectif', mancheImpuni.objectif);
mesure('total_declare', mancheImpuni.total_declare);
mesure('total_paye', mancheImpuni.total_paye);
mesure('recompense', mancheImpuni.recompense);
mesure('parts', mancheImpuni.parts.map((part) => part.part));
mesure('reliquat_non_distribue', mancheImpuni.reliquat_non_distribue);
mesure('deltas de solde', impuni.deltas);

verdict('objectif = 18', mancheImpuni.objectif === 18, `obtenu ${String(mancheImpuni.objectif)}`);
verdict('total_paye = 21', mancheImpuni.total_paye === 21, `obtenu ${String(mancheImpuni.total_paye)}`);
verdict('recompense = 42', mancheImpuni.recompense === 42, `obtenu ${String(mancheImpuni.recompense)}`);
verdict('part de chacun = 7', mancheImpuni.parts.every((part) => part.part === 7));
verdict(
  'E[Verite] = +3 (les 5 honnêtes)',
  ['J0', 'J1', 'J2', 'J3', 'J4'].every((joueur) => impuni.deltas[joueur] === 3),
);
verdict('menteur impuni = +6', impuni.deltas.J5 === 6, `obtenu ${String(impuni.deltas.J5)}`);

titre('Menteur DÉMASQUÉ : J0 accuse J5 à juste titre');
const demasque = jouerManche(['J0', 'J5'], PAIEMENTS_UN_MENTEUR);
const mancheDemasque = demasque.banc.manche(1);
mesure('verdict', mancheDemasque.accusations.map((accusation) => accusation.verdict));
mesure('ampleur_mensonge (état interne)', mancheDemasque.accusations.map((a) => a.ampleur_mensonge));
mesure('amende liquidée', mancheDemasque.accusations.map((a) => a.montant_amende_liquide));
mesure('parts', mancheDemasque.parts.map((part) => [part.joueur_id, part.part, part.exclu_du_partage]));
mesure('deltas de solde', demasque.deltas);
verdict('menteur démasqué = −7', demasque.deltas.J5 === -7, `obtenu ${String(demasque.deltas.J5)}`);
verdict('part du démasqué = 0 (RG-15)', mancheDemasque.parts.find((p) => p.joueur_id === 'J5')?.part === 0);
verdict('amende = 6 (2 × ampleur 3)', mancheDemasque.accusations[0]?.montant_amende_liquide === 6);

const amendeRecue = demasque.banc.etat.mouvements.filter(
  (mouvement) => mouvement.joueur_id === 'J0' && mouvement.motif === 'amende_recue',
);
mesure('mouvements amende_recue de l’accusateur', amendeRecue.map((m) => m.delta));
verdict('accusation juste rapporte +6 à l’accusateur', amendeRecue.reduce((t, m) => t + m.delta, 0) === 6);

titre('FAUSSE accusation : J0 accuse J1, honnête');
const fausse = jouerManche(['J0', 'J1'], PAIEMENTS_UN_MENTEUR);
const mancheFausse = fausse.banc.manche(1);
mesure('verdict', mancheFausse.accusations.map((accusation) => accusation.verdict));
const penalite = fausse.banc.etat.mouvements.filter(
  (mouvement) => mouvement.joueur_id === 'J0' && mouvement.motif === 'penalite_fausse_accusation_payee',
);
mesure('mouvements de pénalité de l’accusateur', penalite.map((m) => m.delta));
verdict('verdict HONNETE', mancheFausse.accusations[0]?.verdict === 'HONNETE');
verdict('fausse accusation coûte −2', penalite.reduce((t, m) => t + m.delta, 0) === -2);

titre('Dérivation : E[Mensonge] = 6 − 13p, indifférence à p = 3/13');
const gainImpuni = impuni.deltas.J5 ?? 0;
const gainDemasque = demasque.deltas.J5 ?? 0;
const gainVerite = impuni.deltas.J0 ?? 0;
mesure('E[Mensonge](p) coefficients [constante, pente]', [gainImpuni, gainDemasque - gainImpuni]);
const seuil = (gainImpuni - gainVerite) / (gainImpuni - gainDemasque);
mesure('seuil d’indifférence mesuré', [gainImpuni - gainVerite, gainImpuni - gainDemasque, seuil]);
verdict('pente = −13', gainDemasque - gainImpuni === -13);
verdict('seuil = 3/13', Math.abs(seuil - 3 / 13) < 1e-12, `obtenu ${seuil.toFixed(6)}`);

titre('CA-26 : arrondi inférieur et reliquat non distribué');
const ca26 = jouerManche(null, [4, 4, 4, 4, 4, 0]);
// La 6e déclaration doit valoir 6 : on rejoue la manche avec une déclaration dissymétrique.
const banc26 = bancNeutre();
banc26.allerA('DECLARATION_PAIEMENT');
const declarations26 = [4, 4, 4, 4, 4, 6];
banc26.joueurs.forEach((joueur, index) => {
  banc26.exiger(joueur, 'declarer_contribution', { montant: declarations26[index] ?? 0 });
});
banc26.joueurs.forEach((joueur, index) => {
  banc26.exiger(joueur, 'payer_secret', { montant: index === 5 ? 0 : 4 });
});
banc26.allerA('EXECUTION');
const m26 = banc26.manche(1);
mesure('CA-26 total_paye', m26.total_paye);
mesure('CA-26 recompense', m26.recompense);
mesure('CA-26 parts', m26.parts.map((part) => part.part));
mesure('CA-26 reliquat', m26.reliquat_non_distribue);
verdict('CA-26 recompense = 40', m26.recompense === 40);
verdict(
  'CA-26 parts = [6,6,6,6,6,9]',
  JSON.stringify(m26.parts.map((part) => part.part)) === JSON.stringify([6, 6, 6, 6, 6, 9]),
);
verdict('CA-26 reliquat = 1', m26.reliquat_non_distribue === 1);
mesure('témoin CA-26 bis (tous déclarent 4, J5 paie 0)', ca26.banc.manche(1).parts.map((p) => p.part));

bilan('matrice-gains');
