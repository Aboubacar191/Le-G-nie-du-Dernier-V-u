// SONDE — critères d'acceptation CA-22 à CA-35 : accusations, clauses, exécution, prêts.

import type { Clause } from '@gdv/partage';

import { Banc, bilan, mesure, titre, verdict } from './banc.ts';

function table(graine: string, clause: Clause): Banc {
  const banc = new Banc({ joueurs: 6, graine });
  banc.demarrer();
  for (const joueur of banc.joueurs) banc.imposerRole(joueur, 'FAISEUR_CONTRATS');
  banc.imposerClause(clause);
  return banc;
}

titre('CA-22 — accusé déclaré 5 payé 2 : verdict public, amende 6, part nulle');
const ca22 = table('ca-22', 'CONSOLATION');
ca22.allerA('DECLARATION_PAIEMENT');
ca22.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [5, 2],
]);
if (ca22.etat.phase !== 'ENQUETES_ACCUSATIONS') ca22.allerA('ENQUETES_ACCUSATIONS');
ca22.exiger('J0', 'accuser', { accuse_joueur_id: 'J5' });
const verdicts22 = ca22.trames.filter((trame) => trame.type === 'accusation_resolue');
mesure('destinataires du verdict', verdicts22.map((trame) => trame.pour));
mesure('charge du verdict', verdicts22[0]?.charge);
const soldeAccuseAvant = ca22.solde('J5');
const soldeAccusateurAvant = ca22.solde('J0');
ca22.allerA('EXECUTION');
mesure('delta accusé / accusateur', [ca22.solde('J5') - soldeAccuseAvant, ca22.solde('J0') - soldeAccusateurAvant]);
mesure('amende liquidée', ca22.manche(1).accusations[0]?.montant_amende_liquide);
mesure('part de l’accusé', ca22.manche(1).parts.find((part) => part.joueur_id === 'J5'));
verdict(
  'CA-22',
  verdicts22.length === 6 &&
    ca22.manche(1).accusations[0]?.montant_amende_liquide === 6 &&
    ca22.manche(1).parts.find((part) => part.joueur_id === 'J5')?.part === 0,
);
verdict(
  'CA-22 — le verdict public ne porte ni ampleur ni montant',
  !Object.keys(verdicts22[0]?.charge ?? {}).some((cle) => /ampleur|montant/.test(cle)),
);

titre('CA-23 — accusé déclaré 3 payé 3 : verdict HONNETE, 2 pièces de l’accusateur vers l’accusé');
const ca23 = table('ca-23', 'CONSOLATION');
ca23.allerA('DECLARATION_PAIEMENT');
ca23.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [3, 3],
]);
if (ca23.etat.phase !== 'ENQUETES_ACCUSATIONS') ca23.allerA('ENQUETES_ACCUSATIONS');
ca23.exiger('J0', 'accuser', { accuse_joueur_id: 'J5' });
mesure('verdict', ca23.manche(1).accusations[0]?.verdict);
const avant23 = [ca23.solde('J0'), ca23.solde('J5')];
ca23.allerA('EXECUTION');
const mouvements23 = ca23.etat.mouvements.filter((m) => /penalite_fausse_accusation/.test(m.motif));
mesure('mouvements de pénalité', mouvements23.map((m) => [m.joueur_id, m.delta, m.motif]));
mesure('soldes avant / après', [avant23, [ca23.solde('J0'), ca23.solde('J5')]]);
verdict(
  'CA-23',
  ca23.manche(1).accusations[0]?.verdict === 'HONNETE' &&
    mouvements23.some((m) => m.joueur_id === 'J0' && m.delta === -2) &&
    mouvements23.some((m) => m.joueur_id === 'J5' && m.delta === 2),
);

titre('CA-24 — seconde accusation dans la même manche refusée');
const seconde = ca23.cmd('J0', 'accuser', { accuse_joueur_id: 'J1' });
const ca24 = table('ca-24', 'CONSOLATION');
ca24.allerA('ENQUETES_ACCUSATIONS');
ca24.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
const seconde24 = ca24.cmd('J0', 'accuser', { accuse_joueur_id: 'J2' });
mesure('seconde accusation', seconde24.ok ? 'ACCEPTEE' : (seconde24.erreur as { code: string }).code);
mesure('témoin hors phase', seconde.ok ? 'ACCEPTEE' : (seconde.erreur as { code: string }).code);
verdict('CA-24', !seconde24.ok && (seconde24.erreur as { code: string }).code === 'QUOTA_DEPASSE');

titre('CA-25 — amende 10 sur un solde de 3 : accusé à 0, accusateur +3, aucun négatif');
// TRESOR_DES_HONNETES est inerte sur un vœu échoué : sans cela, la consolation
// de l'étape 11 recréditerait l'accusé avant l'étape 13 et le plafond mesuré ne
// serait plus 3.
const ca25 = table('ca-25', 'TRESOR_DES_HONNETES');
ca25.allerA('NEGOCIATION');
ca25.exiger('J5', 'transferer_pieces', { cible_joueur_id: 'J4', montant: 4 });
ca25.allerA('DECLARATION_PAIEMENT');
ca25.declarerPuisPayer([
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [8, 3],
]);
if (ca25.etat.phase !== 'ENQUETES_ACCUSATIONS') ca25.allerA('ENQUETES_ACCUSATIONS');
// La déclaration est bornée par le solde (RG-08) : pour obtenir un solde de 3
// avec une ampleur de 5, l'accusé dépense 2 pièces en enquête après avoir payé.
ca25.exiger('J5', 'lancer_enquete', { cible_joueur_id: 'J0' });
ca25.exiger('J0', 'accuser', { accuse_joueur_id: 'J5' });
mesure('ampleur', ca25.manche(1).accusations[0]?.ampleur_mensonge);
mesure('solde de l’accusé avant exécution', ca25.solde('J5'));
const soldeAccusateur25 = ca25.solde('J0');
ca25.allerA('EXECUTION');
mesure('amende due / liquidée', [
  ca25.manche(1).accusations[0]?.montant_amende_du,
  ca25.manche(1).accusations[0]?.montant_amende_liquide,
]);
mesure('solde de l’accusé après', ca25.solde('J5'));
mesure('gain de l’accusateur', ca25.solde('J0') - soldeAccusateur25);
verdict(
  'CA-25',
  ca25.manche(1).accusations[0]?.montant_amende_du === 10 &&
    ca25.manche(1).accusations[0]?.montant_amende_liquide === 3 &&
    ca25.solde('J5') === 0 &&
    ca25.solde('J0') - soldeAccusateur25 === 3 &&
    ca25.etat.joueurs.every((joueur) => joueur.solde_pieces >= 0),
);

titre('CA-27 — total payé 17 pour un objectif de 18 : échec, aucune part, consolation');
const ca27 = table('ca-27', 'CONSOLATION');
ca27.allerA('DECLARATION_PAIEMENT');
ca27.declarerPuisPayer([
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 2],
]);
ca27.allerA('EXECUTION');
mesure('total payé / réussi', [ca27.manche(1).total_paye, ca27.manche(1).reussi]);
mesure('parts', ca27.manche(1).parts.map((part) => part.part));
mesure('consolation appliquée / total', [ca27.manche(1).consolation_appliquee, ca27.manche(1).total_consolation]);
const consolations = ca27.etat.mouvements.filter((m) => m.motif === 'consolation');
mesure('mouvements de consolation', consolations.map((m) => [m.joueur_id, m.delta]));
verdict(
  'CA-27',
  ca27.manche(1).reussi === false &&
    ca27.manche(1).parts.every((part) => part.part === 0) &&
    consolations.filter((m) => m.delta === 1).length === 6,
);

titre('CA-28 — GENIE_GARDE_UN_TIERS : plancher(40 × 2/3) = 26');
const ca28 = table('ca-28', 'GENIE_GARDE_UN_TIERS');
ca28.allerA('DECLARATION_PAIEMENT');
ca28.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 0],
]);
ca28.allerA('EXECUTION');
mesure('total payé / récompense', [ca28.manche(1).total_paye, ca28.manche(1).recompense]);
verdict('CA-28', ca28.manche(1).total_paye === 20 && ca28.manche(1).recompense === 26);

titre('CA-29 — TRESOR_DES_HONNETES : 60 sans menteur, 40 avec');
const ca29sans = table('ca-29-sans', 'TRESOR_DES_HONNETES');
ca29sans.allerA('DECLARATION_PAIEMENT');
ca29sans.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [2, 2],
  [2, 2],
]);
ca29sans.allerA('EXECUTION');
mesure('sans menteur : total / multiplicateur / récompense', [
  ca29sans.manche(1).total_paye,
  ca29sans.manche(1).multiplicateur_applique,
  ca29sans.manche(1).recompense,
]);
const ca29avec = table('ca-29-avec', 'TRESOR_DES_HONNETES');
ca29avec.allerA('DECLARATION_PAIEMENT');
ca29avec.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 0],
]);
ca29avec.allerA('EXECUTION');
mesure('avec menteur : total / multiplicateur / récompense', [
  ca29avec.manche(1).total_paye,
  ca29avec.manche(1).multiplicateur_applique,
  ca29avec.manche(1).recompense,
]);
verdict('CA-29', ca29sans.manche(1).recompense === 60 && ca29avec.manche(1).recompense === 40);

titre('CA-30 — LE_PLUS_GENEREUX : poids doublé, somme des parts <= récompense');
const ca30 = table('ca-30', 'LE_PLUS_GENEREUX');
ca30.allerA('DECLARATION_PAIEMENT');
ca30.declarerPuisPayer([
  [4, 4],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3],
]);
ca30.allerA('EXECUTION');
const sommeParts = ca30.manche(1).parts.reduce((total, part) => total + part.part, 0);
mesure('parts / somme / récompense', [ca30.manche(1).parts.map((p) => p.part), sommeParts, ca30.manche(1).recompense]);
verdict(
  'CA-30',
  sommeParts <= Number(ca30.manche(1).recompense) &&
    (ca30.manche(1).parts.find((p) => p.joueur_id === 'J0')?.part ?? 0) >
      (ca30.manche(1).parts.find((p) => p.joueur_id === 'J1')?.part ?? 0),
);

titre('CA-31 — PRIME_AU_DELATEUR : amende 12, et la clause reste inconnue avant l’étape 16');
const ca31 = table('ca-31', 'PRIME_AU_DELATEUR');
ca31.allerA('NEGOCIATION');
ca31.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J5', montant: 5 });
ca31.allerA('DECLARATION_PAIEMENT');
ca31.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [5, 2],
]);
if (ca31.etat.phase !== 'ENQUETES_ACCUSATIONS') ca31.allerA('ENQUETES_ACCUSATIONS');
ca31.exiger('J0', 'accuser', { accuse_joueur_id: 'J5' });
const avantExecution31 = ca31.pour('J2').filter((trame) => JSON.stringify(trame.charge).includes('PRIME_AU_DELATEUR'));
mesure('trames citant la clause reçues par J2 AVANT l’exécution', avantExecution31.map((t) => t.type));
ca31.allerA('EXECUTION');
mesure('amende due / liquidée', [
  ca31.manche(1).accusations[0]?.montant_amende_du,
  ca31.manche(1).accusations[0]?.montant_amende_liquide,
]);
const apresExecution31 = ca31.pour('J2').filter((trame) => JSON.stringify(trame.charge).includes('PRIME_AU_DELATEUR'));
mesure('trames citant la clause APRÈS l’exécution', apresExecution31.map((t) => t.type));
verdict(
  'CA-31',
  ca31.manche(1).accusations[0]?.montant_amende_liquide === 12 &&
    avantExecution31.length === 0 &&
    apresExecution31.length === 1,
);

titre('CA-33 — un non-PRETEUR ne peut pas émettre de prêt');
const ca33 = table('ca-33', 'CONSOLATION');
ca33.allerA('NEGOCIATION');
const refusPret = ca33.cmd('J1', 'proposer_pret', { emprunteur_joueur_id: 'J2', principal: 4 });
mesure('code', refusPret.ok ? 'ACCEPTEE' : (refusPret.erreur as { code: string }).code);
mesure('message (ne doit nommer aucun rôle)', refusPret.ok ? '' : (refusPret.erreur as { message: string }).message);
verdict('CA-33', !refusPret.ok && (refusPret.erreur as { code: string }).code === 'ACTION_NON_AUTORISEE_ROLE');

titre('CA-34 — prêt de 4 à la manche 2, 6 prélevés à la manche 3');
const ca34 = table('ca-34', 'CONSOLATION');
ca34.imposerRole('J0', 'PRETEUR');
ca34.allerA('EXECUTION');
ca34.expirer();
ca34.imposerClause('TRESOR_DES_HONNETES');
ca34.allerA('NEGOCIATION');
ca34.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
const pret34 = ca34.etat.prets[0]?.id ?? '';
ca34.exiger('J1', 'repondre_pret', { pret_id: pret34, accepte: true });
mesure('du_total', ca34.etat.prets[0]?.du_total);
ca34.allerA('EXECUTION');
ca34.expirer();
ca34.imposerClause('LE_PLUS_GENEREUX');
const soldeAvant34 = [ca34.solde('J0'), ca34.solde('J1')];
ca34.allerA('EXECUTION');
mesure('soldes avant / après la manche 3', [soldeAvant34, [ca34.solde('J0'), ca34.solde('J1')]]);
mesure('prêt après prélèvement', [ca34.etat.prets[0]?.rembourse, ca34.etat.prets[0]?.statut]);
const preleve34 = ca34.etat.mouvements.filter((m) => m.motif === 'remboursement_pret');
mesure('mouvements de remboursement', preleve34.map((m) => [m.joueur_id, m.delta]));
verdict(
  'CA-34',
  ca34.etat.prets[0]?.du_total === 6 &&
    preleve34.some((m) => m.joueur_id === 'J1' && m.delta === -6) &&
    preleve34.some((m) => m.joueur_id === 'J0' && m.delta === 6),
);

titre('CA-35 — un joueur à 0 pièce n’est pas éliminé');
const ca35 = table('ca-35', 'CONSOLATION');
ca35.allerA('NEGOCIATION');
ca35.exiger('J5', 'transferer_pieces', { cible_joueur_id: 'J4', montant: 12 });
mesure('solde de J5', ca35.solde('J5'));
ca35.allerA('ENQUETES_ACCUSATIONS');
const accuse35 = ca35.cmd('J5', 'accuser', { accuse_joueur_id: 'J0' });
mesure('J5 à 0 pièce peut accuser', accuse35.ok);
ca35.allerA('EXECUTION');
ca35.expirer();
ca35.allerA('NEGOCIATION');
const recoit35 = ca35.cmd('J4', 'transferer_pieces', { cible_joueur_id: 'J5', montant: 3 });
mesure('J5 peut recevoir un transfert', recoit35.ok);
mesure('solde de J5 à la manche suivante', ca35.solde('J5'));
mesure('J5 est-il encore dans la session ?', ca35.etat.joueurs.some((joueur) => joueur.id === 'J5'));
verdict('CA-35', accuse35.ok && recoit35.ok && ca35.etat.joueurs.some((joueur) => joueur.id === 'J5'));

bilan('criteres-b');
