// CA-26 — US-11. Étant donné 6 joueurs, objectif 18, total payé 20, aucune
// clause modifiant la récompense, déclarations [4,4,4,4,4,6] sans joueur
// démasqué, quand l'exécution se déroule, alors la récompense vaut 40 et les
// parts valent respectivement [6,6,6,6,6,9] — arrondi inférieur, reliquat de 1
// NON distribué. (RG-13, RG-14)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-26 : récompense 40, parts [6,6,6,6,6,9], reliquat 1 non distribué', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // CONSOLATION ne s'applique qu'en cas d'échec : la récompense est intacte.
  table.imposerClause('CONSOLATION');
  // Déclaré 26, payé 20 : le dernier déclare 6 et paie 0.
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
  assert.equal(manche.objectif, 18);
  assert.equal(manche.total_declare, 26);
  assert.equal(manche.total_paye, 20);
  assert.equal(manche.reussi, true);
  assert.equal(manche.multiplicateur_applique, 2);
  assert.equal(manche.recompense, 40, '2 × 20');

  assert.deepEqual(
    manche.parts.map((part) => part.part),
    [6, 6, 6, 6, 6, 9],
  );
  assert.equal(manche.reliquat_non_distribue, 1, 'le génie garde le reliquat d’arrondi');
  assert.equal(
    manche.parts.reduce((total, part) => total + part.part, 0) +
      (manche.reliquat_non_distribue ?? 0),
    manche.recompense,
    'somme des parts + reliquat = récompense',
  );
});

test('CA-26 : le partage est au prorata des DÉCLARÉS, pas des payés (RG-14)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION');
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
  const dernier = manche.parts.find((part) => part.joueur_id === 'J5');
  assert.equal(dernier?.part, 9, 'le menteur non démasqué touche la plus grosse part');
  assert.equal(dernier?.exclu_du_partage, false);
});

test('CA-26 : l’égalité stricte avec l’objectif est un SUCCÈS (RG-12)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('EXECUTION');
  const manche = table.manche(1);
  assert.equal(manche.total_paye, 18);
  assert.equal(manche.objectif, 18);
  assert.equal(manche.reussi, true);
});
