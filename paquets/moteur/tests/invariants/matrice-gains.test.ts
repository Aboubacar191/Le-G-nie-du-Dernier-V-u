// VÉRIFICATION DE LA MATRICE DE GAINS — section figée de la SPEC.
//
//   E[Mensonge] = 6(1-p) - 7p = 6 - 13p
//   E[Verite]   = 3
//   seuil d'indifférence : p = 3/13 ≈ 23,08 %
//
// « Avec objectif_par_joueur = 3, multiplicateur_recompense = 2,
//   multiplicateur_amende = 2 : déclarer 3 et payer 0 économise 3 et conserve
//   une part équivalente (+6 par rapport au joueur honnête de référence) ; être
//   démasqué coûte l'amende 2×3 = 6 plus la part perdue, soit -7. »
//
// « Si le moteur ne reproduit pas ces valeurs, c'est le moteur qui est faux,
//   jamais les chiffres du GDD. »
//
// CADRE DE RÉFÉRENCE, explicité parce que la SPEC ne le fixe pas et que trois
// chiffres sur quatre en dépendent. Il est choisi comme le SEUL cadre où les
// trois gains de la matrice sortent EXACTEMENT, et il est reproduit par le
// moteur réel, pas posé à la main :
//
//   6 joueurs, objectif 18 (= objectif_par_joueur 3 × 6). Tous DÉCLARENT 4.
//   Les honnêtes paient 4 ; le menteur paie 1, soit une ampleur de 3 — la même
//   ampleur de 3 que celle dont parle la dérivation de la SPEC.
//   Total réellement payé : 21. Récompense : 2 × 21 = 42.
//   Poids de partage : 4 par joueur, somme 24. Part : plancher(42 × 4 / 24) = 7.
//
// Et alors, mesuré par le moteur :
//   honnête          : -4 payé + 7 de part                 = +3  → E[Verite]
//   menteur impuni   : -1 payé + 7 de part                 = +6
//   menteur démasqué : -1 payé + 0 de part - 6 d'amende    = -7
//
// d'où E[Mensonge] = 6(1-p) - 7p = 6 - 13p, et l'indifférence à p = 3/13.
//
// Le cadre n'est pas un artifice : c'est celui qui donne une part de 7, valeur
// dont la SPEC a besoin pour que « la part perdue » fasse passer le coût du
// démasquage de -6 à -7. Un cadre où tout le monde paie exactement 3 ferait
// échouer le vœu dès la première défection, et la matrice n'aurait pas de sens.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

const DECLARATION = 4;
const PAIEMENT_HONNETE = 4;
const PAIEMENT_MENTEUR = 1;
const AMPLEUR_ATTENDUE = 3;
const PIECES_INITIALES = 12;

const PAIEMENTS: readonly (readonly [number, number])[] = [
  [DECLARATION, PAIEMENT_MENTEUR], // J0 : le menteur, ampleur 3
  [DECLARATION, PAIEMENT_HONNETE],
  [DECLARATION, PAIEMENT_HONNETE],
  [DECLARATION, PAIEMENT_HONNETE],
  [DECLARATION, PAIEMENT_HONNETE],
  [DECLARATION, PAIEMENT_HONNETE],
];

/**
 * Le cadre de référence, joué par le moteur. `accusation` démasque J0.
 *
 * Les POUVOIRS DE RÔLE sont neutralisés : la matrice de gains arbitre entre
 * mentir et dire vrai, pas entre les rôles. Le MARCHAND_EPICES touche
 * +bonus_marchand_epices_par_voeu_reussi à l'étape 10 (RG-60, valeur 2 par
 * défaut), ce qui décalerait chaque chiffre de la matrice selon le rôle tiré.
 * Tous les joueurs reçoivent donc INSPECTEUR_TRESOR, dont le seul pouvoir —
 * un coût d'enquête réduit — n'intervient pas ici puisqu'aucune enquête n'est
 * lancée.
 */
function cadreDeReference(accusation?: { accusateur: string; accuse: string }): Table {
  const table = tableEnDeclaration({ joueurs: 6 });
  // CONSOLATION n'a aucun effet sur un vœu RÉUSSI : la clause est neutre ici.
  table.imposerClause('CONSOLATION');
  for (const joueur of table.joueurs) table.imposerRole(joueur, 'INSPECTEUR_TRESOR');
  table.declarerEtPayer(PAIEMENTS);
  table.allerA('ENQUETES_ACCUSATIONS');
  if (accusation !== undefined) {
    table.exiger(accusation.accusateur, 'accuser', { accuse_joueur_id: accusation.accuse });
  }
  table.allerA('EXECUTION');
  return table;
}

test('le cadre de référence est bien celui de la SPEC : objectif 18, part 7', () => {
  const table = cadreDeReference();
  const manche = table.manche(1);

  assert.equal(table.etat.config.objectif_par_joueur, 3);
  assert.equal(table.etat.config.multiplicateur_recompense, 2);
  assert.equal(table.etat.config.multiplicateur_amende, 2);
  assert.equal(manche.objectif, 18);
  assert.equal(manche.total_declare, 24);
  assert.equal(manche.total_paye, 21);
  assert.equal(manche.reussi, true);
  assert.equal(manche.recompense, 42, '2 × 21');
  assert.deepEqual(
    manche.parts.map((part) => part.part),
    [7, 7, 7, 7, 7, 7],
    'plancher(42 × 4 / 24) = 7 pour chacun',
  );
  const ampleur = (manche.contributions.find((c) => c.joueur_id === 'J0')?.montant_declare ?? 0) -
    (manche.contributions.find((c) => c.joueur_id === 'J0')?.montant_paye ?? 0);
  assert.equal(ampleur, AMPLEUR_ATTENDUE);
});

test('E[Verite] = 3 — le joueur honnête de référence gagne 3', () => {
  const table = cadreDeReference();
  for (const honnete of ['J1', 'J2', 'J3', 'J4', 'J5']) {
    assert.equal(
      table.solde(honnete) - PIECES_INITIALES,
      3,
      `gain net de ${honnete} : -4 payé + 7 de part`,
    );
  }
});

test('mensonge IMPUNI : +6', () => {
  const table = cadreDeReference();
  assert.equal(
    table.solde('J0') - PIECES_INITIALES,
    6,
    'gain net du menteur non démasqué : -1 payé + 7 de part',
  );
});

test('mensonge DÉMASQUÉ : -7 — l’amende 2 × 3 = 6, plus la part perdue', () => {
  const table = cadreDeReference({ accusateur: 'J1', accuse: 'J0' });
  const manche = table.manche(1);

  const accusation = manche.accusations[0];
  assert.equal(accusation?.verdict, 'MENTEUR');
  assert.equal(accusation?.ampleur_mensonge, AMPLEUR_ATTENDUE);
  assert.equal(accusation?.montant_amende_liquide, 6, 'multiplicateur_amende × ampleur');

  const part = manche.parts.find((entree) => entree.joueur_id === 'J0');
  assert.equal(part?.part, 0, 'RG-15 : le démasqué perd sa part');
  assert.equal(part?.exclu_du_partage, true);

  assert.equal(
    table.solde('J0') - PIECES_INITIALES,
    -7,
    'gain net du menteur démasqué : -1 payé + 0 de part - 6 d’amende',
  );
});

test('une accusation JUSTE rapporte +6 à l’accusateur', () => {
  const sansAccusation = cadreDeReference();
  const avecAccusation = cadreDeReference({ accusateur: 'J1', accuse: 'J0' });

  const amende = avecAccusation.manche(1).accusations[0]?.montant_amende_liquide;
  assert.equal(amende, 6, 'l’amende encaissée vaut 2 × ampleur 3');

  // Et elle se lit aussi dans les mouvements : exactement +6 de motif amende_recue.
  const recues = avecAccusation.etat.mouvements.filter(
    (mouvement) => mouvement.joueur_id === 'J1' && mouvement.motif === 'amende_recue',
  );
  assert.equal(recues.length, 1);
  assert.equal(recues[0]?.delta, 6);
  assert.equal(
    sansAccusation.etat.mouvements.filter((m) => m.motif === 'amende_recue').length,
    0,
  );
});

test('une FAUSSE accusation coûte 2 à l’accusateur', () => {
  // J2 est honnête : l'accuser est une fausse accusation.
  const table = cadreDeReference({ accusateur: 'J1', accuse: 'J2' });
  const accusation = table.manche(1).accusations[0];
  assert.equal(accusation?.verdict, 'HONNETE');
  assert.equal(accusation?.montant_amende_liquide, 2, 'cout_fausse_accusation');

  const payees = table.etat.mouvements.filter(
    (mouvement) =>
      mouvement.joueur_id === 'J1' && mouvement.motif === 'penalite_fausse_accusation_payee',
  );
  assert.equal(payees.length, 1);
  assert.equal(payees[0]?.delta, -2);
});

test('les deux espérances et le seuil d’indifférence se déduisent des gains mesurés', () => {
  const impuni = cadreDeReference().solde('J0') - PIECES_INITIALES;
  const demasque = cadreDeReference({ accusateur: 'J1', accuse: 'J0' }).solde('J0') -
    PIECES_INITIALES;
  const verite = cadreDeReference().solde('J1') - PIECES_INITIALES;

  assert.equal(impuni, 6);
  assert.equal(demasque, -7);
  assert.equal(verite, 3);

  // E[Mensonge](p) = impuni × (1-p) + demasque × p = 6 - 13p
  const esperanceMensonge = (p: number): number => impuni * (1 - p) + demasque * p;
  assert.equal(esperanceMensonge(0), 6);
  assert.equal(esperanceMensonge(1), -7);
  // Coefficient : 6 - 13p
  assert.equal(esperanceMensonge(0) - esperanceMensonge(1), 13);

  // Seuil d'indifférence : E[Mensonge] = E[Verite]
  const seuil = (impuni - verite) / (impuni - demasque);
  assert.equal(seuil, 3 / 13);
  assert.equal(Number((seuil * 100).toFixed(2)), 23.08, 'p ≈ 23,08 %');
  assert.ok(Math.abs(esperanceMensonge(seuil) - verite) < 1e-9, 'indifférence exacte au seuil');

  // Au-dessous du seuil, mentir paie ; au-dessus, non.
  assert.ok(esperanceMensonge(seuil - 0.01) > verite);
  assert.ok(esperanceMensonge(seuil + 0.01) < verite);
});
