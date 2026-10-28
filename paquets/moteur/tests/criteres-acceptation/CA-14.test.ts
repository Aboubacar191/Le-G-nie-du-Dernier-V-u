// CA-14 — US-08. Étant donné une manche où le total déclaré est 26 et le total
// payé 19, quand la phase REVELATION s'ouvre, alors TOUS les joueurs reçoivent
// l'écart total avec exactement ces deux valeurs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-14 : l’écart total est publié à tous, avec exactement 26 et 19', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // Déclarations 4+4+4+4+4+6 = 26 ; paiements 4+4+4+4+3+0 = 19.
  table.declarerEtPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 3],
    [6, 0],
  ]);

  assert.equal(table.etat.phase, 'REVELATION', 'tous ont déclaré et payé (CA-49)');
  const ecarts = table.trames.filter((trame) => trame.type === 'revelation_ecart_total');
  assert.equal(ecarts.length, 6, 'un par joueur');
  for (const trame of ecarts) {
    assert.equal(trame.charge.total_declare, 26);
    assert.equal(trame.charge.total_paye, 19);
    assert.equal(trame.charge.objectif, 18);
    assert.equal(trame.charge.numero_manche, 1);
  }
});

test('CA-14 : l’écart total est émis SYSTÉMATIQUEMENT, même sans menteur', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  const ecarts = table.trames.filter((trame) => trame.type === 'revelation_ecart_total');
  assert.equal(ecarts.length, 6);
  assert.equal(ecarts[0]?.charge.total_declare, 18);
  assert.equal(ecarts[0]?.charge.total_paye, 18);
});
