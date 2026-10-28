// CA-29 — US-11. Étant donné un vœu réussi avec total payé 20, clause
// TRESOR_DES_HONNETES et AUCUN menteur, quand l'exécution se déroule, alors la
// récompense vaut 60 ; avec au moins un menteur elle vaut 40.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

/** Total payé 20, réparti sur 6 joueurs, SANS aucun menteur : déclaré = payé. */
const HONNETES: readonly (readonly [number, number])[] = [
  [4, 4],
  [4, 4],
  [3, 3],
  [3, 3],
  [3, 3],
  [3, 3],
];

/** Même total payé 20, mais le dernier a menti. */
const AVEC_MENTEUR: readonly (readonly [number, number])[] = [
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 4],
  [6, 0],
];

test('CA-29 : sans aucun menteur, le multiplicateur est 3 et la récompense 60', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('TRESOR_DES_HONNETES');
  table.declarerEtPayer(HONNETES);
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.total_paye, 20);
  assert.equal(manche.reussi, true);
  assert.equal(manche.multiplicateur_applique, 3);
  assert.equal(manche.recompense, 60);
});

test('CA-29 : avec au moins un menteur, le multiplicateur retombe à 2', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('TRESOR_DES_HONNETES');
  table.declarerEtPayer(AVEC_MENTEUR);
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.total_paye, 20);
  assert.equal(manche.multiplicateur_applique, 2);
  assert.equal(manche.recompense, 40);
});

test('CA-29 : le multiplicateur n’est révélé qu’à l’étape 16', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('TRESOR_DES_HONNETES');
  table.declarerEtPayer(HONNETES);

  const avant = JSON.stringify(table.trames);
  assert.ok(!avant.includes('multiplicateur_applique'));
  assert.ok(!avant.includes('TRESOR_DES_HONNETES'));

  table.allerA('EXECUTION');
  const execution = table.trames.find((trame) => trame.type === 'execution_resultat');
  assert.equal(execution?.charge.multiplicateur_applique, 3);
  assert.equal(execution?.charge.clause_revelee, 'TRESOR_DES_HONNETES');
});

test('CA-29 : les deux multiplicateurs sont LUS dans la configuration (RG-60)', () => {
  const table = tableEnDeclaration({
    joueurs: 6,
    config: { multiplicateur_recompense: 1, multiplicateur_recompense_tresor_honnetes: 5 },
  });
  table.imposerClause('TRESOR_DES_HONNETES');
  table.declarerEtPayer(HONNETES);
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).multiplicateur_applique, 5);
  assert.equal(table.manche(1).recompense, 100);
});
