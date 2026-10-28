// CAS LIMITES 1 à 8 de SPEC-GDV-001.json / cas_limites — LA MONNAIE.
//
// Les huit premiers cas limites portent tous sur l’argent : objectif atteint
// de justesse, poids nuls, plafonnements. C’est là qu’un moteur de jeu se
// trompe, et là où l’absence d’arbitre humain rend l’erreur définitive.
// Les cas 9 à 26 sont dans cas-limites-jeu.test.ts.
//
// (énoncé d’origine : LES 26 CAS LIMITES)
//
// Un test par cas, nommé d'après son énoncé, dans l'ordre de la SPEC. Les cas
// limites ne sont pas des curiosités : ce sont les endroits où un moteur de jeu
// se trompe, et où l'absence d'arbitre humain rend l'erreur définitive.

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles, verifierInvariants } from '@gdv/moteur';

import { Table, tableEnDeclaration } from '../aide/table.ts';

const NEUTRE = 'GENIE_GARDE_UN_TIERS';

test('cas limite 1 — total payé égal exactement à l’objectif (succès)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).total_paye, table.manche(1).objectif);
  assert.equal(table.manche(1).reussi, true, 'RG-12 : l’égalité stricte est un succès');
});

test('cas limite 2 — total payé nul et objectif non atteint', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause(NEUTRE);
  table.declarerEtPayer([
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
  ]);
  table.allerA('EXECUTION');
  const manche = table.manche(1);
  assert.equal(manche.total_paye, 0);
  assert.equal(manche.reussi, false);
  assert.equal(manche.recompense, 0);
  assert.deepEqual(manche.parts, []);
  assert.ok(verifierInvariants(table.etat).ok);
});

test('cas limite 3 — tous les joueurs mentent', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause(NEUTRE);
  table.declarerEtPayer([
    [4, 1],
    [4, 1],
    [4, 1],
    [4, 1],
    [4, 1],
    [4, 1],
  ]);
  const candidats = candidatsEligibles(table.etat, table.manche(1));
  assert.ok(
    !candidats.some((candidat) => candidat.gabarit === 'COMPTAGE'),
    'k == nb_joueurs est interdit',
  );
  assert.ok(
    !candidats.some((candidat) => candidat.gabarit === 'EXONERATION'),
    'personne n’est exonérable',
  );
  table.allerA('EXECUTION');
  assert.ok(verifierInvariants(table.etat).ok);
});

test('cas limite 4 — aucun joueur ne mente (TRESOR_DES_HONNETES et interdit COMPTAGE)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('TRESOR_DES_HONNETES');
  table.declarerEtPayer([
    [4, 4],
    [4, 4],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  assert.ok(
    !candidatsEligibles(table.etat, table.manche(1)).some((c) => c.gabarit === 'COMPTAGE'),
  );
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).multiplicateur_applique, 3);
});

test('cas limite 5 — somme des poids NULLE car tous les contributeurs sont démasqués', () => {
  // Deux joueurs seuls déclarent, et les deux sont démasqués : la somme des
  // poids tombe à 0 et AUCUNE part n'est versée (étape 9), sans division par zéro.
  const table = tableEnDeclaration({ joueurs: 6, config: { objectif_par_joueur: 1 } });
  table.imposerClause(NEUTRE);
  table.declarerEtPayer([
    [6, 5],
    [6, 5],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J2', 'accuser', { accuse_joueur_id: 'J0' });
  table.exiger('J3', 'accuser', { accuse_joueur_id: 'J1' });
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.reussi, true, 'objectif 6, payé 10');
  assert.ok((manche.recompense ?? 0) > 0);
  assert.deepEqual(
    manche.parts.map((part) => part.part),
    [0, 0, 0, 0, 0, 0],
    'aucune part versée',
  );
  assert.equal(manche.reliquat_non_distribue, manche.recompense, 'le génie garde tout');
  assert.ok(verifierInvariants(table.etat).ok);
});

test('cas limite 6 — amende supérieure au solde de l’accusé', () => {
  const table = tableEnDeclaration({ joueurs: 6, config: { cout_enquete: 3 } });
  table.imposerClause(NEUTRE);
  table.imposerRole('J0', 'PRETEUR');
  table.declarerEtPayer([
    [5, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  for (const cible of ['J1', 'J2', 'J3']) {
    table.exiger('J0', 'lancer_enquete', { cible_joueur_id: cible });
  }
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  table.allerA('EXECUTION');

  assert.equal(table.manche(1).accusations[0]?.montant_amende_du, 10);
  assert.equal(table.manche(1).accusations[0]?.montant_amende_liquide, 3, 'plafonné au solde');
  assert.equal(table.solde('J0'), 0);
  assert.ok(verifierInvariants(table.etat).ok);
});

test('cas limite 7 — pénalité de fausse accusation supérieure au solde de l’accusateur', () => {
  const table = tableEnDeclaration({ joueurs: 6, config: { cout_fausse_accusation: 20 } });
  table.imposerClause(NEUTRE);
  table.declarerEtPayer([
    [3, 3],
    [2, 2],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  table.allerA('EXECUTION');

  const accusation = table.manche(1).accusations[0];
  assert.equal(accusation?.verdict, 'HONNETE');
  assert.equal(accusation?.montant_amende_du, 20);
  assert.equal(accusation?.montant_amende_liquide, 10, 'plafonné au solde de l’accusateur');
  assert.equal(table.solde('J1'), 0);
  assert.ok(verifierInvariants(table.etat).ok);
});

test('cas limite 8 — remboursement de prêt supérieur au solde de l’emprunteur', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-8' }).demarrer();
  table.imposerRole('J0', 'PRETEUR');
  table.allerA('EXECUTION');
  table.expirer();

  table.allerA('NEGOCIATION');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 8 });
  const pretId = table.etat.prets[0]?.id ?? '';
  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: true });
  // Il dilapide tout, dans la même phase de négociation : il n'aura plus rien à
  // l'échéance. Un paiement de vœu ne conviendrait pas — le vœu réussirait et
  // lui rendrait une part, ce qui ne teste plus le plafonnement.
  table.exiger('J1', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 20 });
  assert.equal(table.solde('J1'), 0);
  table.allerA('EXECUTION');
  table.expirer();
  table.allerA('EXECUTION');

  const pret = table.etat.prets[0];
  assert.equal(pret?.du_total, 12, 'plafond(8 × 3/2)');
  assert.equal(table.solde('J1'), 0);
  assert.equal(pret?.statut, 'ACTIF', 'le reliquat reste dû');
  assert.ok(verifierInvariants(table.etat).ok);
});
