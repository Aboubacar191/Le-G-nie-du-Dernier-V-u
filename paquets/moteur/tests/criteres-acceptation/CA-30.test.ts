// CA-30 — US-11. Étant donné un vœu réussi avec clause LE_PLUS_GENEREUX, quand
// l'exécution se déroule, alors le poids de partage du PLUS GROS PAYEUR RÉEL
// est doublé et la somme des parts versées NE DÉPASSE JAMAIS la récompense.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-30 : le poids du plus gros payeur réel est doublé', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('LE_PLUS_GENEREUX');
  // J0 paie le plus (8) ; tous déclarent 4 sauf J0 qui déclare 8.
  table.declarerEtPayer([
    [8, 8],
    [4, 3],
    [4, 3],
    [4, 3],
    [4, 3],
    [4, 3],
  ]);
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.total_paye, 23);
  assert.equal(manche.reussi, true);
  assert.equal(manche.recompense, 46);

  // Poids : J0 = 8 × 2 = 16, les autres 4 ; somme = 36.
  // plancher(46×16/36) = 20 ; plancher(46×4/36) = 5.
  const parts = manche.parts.map((part) => part.part);
  assert.deepEqual(parts, [20, 5, 5, 5, 5, 5]);
  assert.ok((parts[0] ?? 0) > (parts[1] ?? 0) * 2, 'la part du plus généreux est plus que doublée');
});

test('CA-30 : la somme des parts ne dépasse JAMAIS la récompense', () => {
  for (const paiements of [
    [
      [8, 8],
      [4, 3],
      [4, 3],
      [4, 3],
      [4, 3],
      [4, 3],
    ],
    [
      [6, 6],
      [6, 6],
      [3, 3],
      [3, 3],
      [3, 1],
      [3, 1],
    ],
    [
      [12, 4],
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
    ],
  ] as readonly (readonly (readonly [number, number])[])[]) {
    const table = tableEnDeclaration({ joueurs: 6 });
    table.imposerClause('LE_PLUS_GENEREUX');
    table.declarerEtPayer(paiements);
    table.allerA('EXECUTION');
    const manche = table.manche(1);
    const somme = manche.parts.reduce((total, part) => total + part.part, 0);
    assert.ok(
      somme <= (manche.recompense ?? 0),
      `somme des parts ${somme} > récompense ${String(manche.recompense)}`,
    );
    assert.equal(somme + (manche.reliquat_non_distribue ?? 0), manche.recompense);
  }
});

test('CA-30 : en cas d’ÉGALITÉ sur le plus gros paiement, tous les ex aequo doublent', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('LE_PLUS_GENEREUX');
  // J0 et J1 paient 6 tous les deux : ex aequo au maximum.
  table.declarerEtPayer([
    [6, 6],
    [6, 6],
    [3, 3],
    [3, 3],
    [3, 1],
    [3, 1],
  ]);
  table.allerA('EXECUTION');
  const manche = table.manche(1);
  const parts = manche.parts.map((part) => part.part);
  assert.equal(parts[0], parts[1], 'les deux ex aequo touchent la même part');
  assert.ok((parts[0] ?? 0) > (parts[2] ?? 0));
  // Poids : 12, 12, 3, 3, 3, 3 = 36 ; récompense 2 × 20 = 40.
  assert.equal(manche.total_paye, 20);
  assert.equal(manche.recompense, 40);
  assert.deepEqual(parts, [13, 13, 3, 3, 3, 3]);
});
