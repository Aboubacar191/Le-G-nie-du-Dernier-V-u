// CA-13 — US-07. Étant donné une partie de 5 manches, quand on relève les
// clauses des 5 manches, alors les 5 clés de clause sont toutes distinctes
// (tirage SANS REMISE). (RG-18)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CLAUSE } from '@gdv/partage';

import { Table } from '../aide/table.ts';

test('CA-13 : les 5 clauses d’une partie sont toutes distinctes', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-13' }).demarrer();
  // Cinq manches traversées sans aucune action : seules les transitions jouent.
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }

  const clauses = table.etat.manches.map((manche) => manche.clause_cle);
  assert.equal(clauses.length, 5);
  assert.equal(new Set(clauses).size, 5, `clauses tirées : ${clauses.join(', ')}`);
  assert.deepEqual([...clauses].sort(), [...CLAUSE].sort(), 'le catalogue est épuisé');
  assert.equal(table.etat.clauses_disponibles.length, 0);
});

test('CA-13 : la propriété tient sur plusieurs graines', () => {
  for (const graine of ['a', 'b', 'c', 'd', 'e']) {
    const table = new Table({ joueurs: 6, graine }).demarrer();
    for (let manche = 1; manche <= 5; manche += 1) {
      table.allerA('EXECUTION');
      table.expirer();
    }
    const clauses = table.etat.manches.map((manche) => manche.clause_cle);
    assert.equal(new Set(clauses).size, 5, `graine ${graine} : ${clauses.join(', ')}`);
  }
});
