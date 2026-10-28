// CA-28 — US-11. Étant donné un vœu réussi avec total payé 20 et clause
// GENIE_GARDE_UN_TIERS, quand l'exécution se déroule, alors la récompense
// partagée vaut plancher(40 × 2/3) = 26.
//
// La fraction 2/3 n'est pas écrite dans le moteur : c'est le COMPLÉMENT de
// fraction_retenue_genie, lue dans la configuration ([1,3] par défaut).

import test from 'node:test';
import assert from 'node:assert/strict';

import { complement, plancher } from '@gdv/moteur';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-28 : la récompense partagée vaut plancher(40 × 2/3) = 26', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('GENIE_GARDE_UN_TIERS');
  table.declarerEtPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [6, 0],
  ]);
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.total_paye, 20);
  assert.equal(manche.reussi, true);
  assert.equal(manche.multiplicateur_applique, 2);
  assert.equal(manche.recompense, 26, 'plancher(2 × 20 × 2/3)');

  // Parts au prorata des déclarés [4,4,4,4,4,6], somme 26 :
  // plancher(26×4/26) = 4 pour cinq joueurs, plancher(26×6/26) = 6 pour le dernier.
  assert.deepEqual(
    manche.parts.map((part) => part.part),
    [4, 4, 4, 4, 4, 6],
  );
  assert.equal(manche.reliquat_non_distribue, 0);
});

test('CA-28 : l’arithmétique entière du complément est exacte (ADR-TL-14)', () => {
  assert.deepEqual(complement([1, 3]), [2, 3]);
  assert.equal(plancher(40, [2, 3]), 26);
  assert.equal(plancher(41, [2, 3]), 27);
});

test('CA-28 : la fraction retenue est LUE dans la configuration (RG-60)', () => {
  // Le génie garde la moitié : il reste plancher(40 × 1/2) = 20.
  const table = tableEnDeclaration({ joueurs: 6, config: { fraction_retenue_genie: [1, 2] } });
  table.imposerClause('GENIE_GARDE_UN_TIERS');
  table.declarerEtPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [6, 0],
  ]);
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).recompense, 20);
});
