// CA-07 — US-05. Étant donné un joueur disposant de 12 pièces en phase
// DECLARATION_PAIEMENT, quand il déclare 13, alors la déclaration est refusée
// (RG-08) et AUCUN montant n'est publié.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-07 : déclarer plus que son solde est refusé, et rien n’est publié', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(table.solde('J0'), 12);

  const resultat = table.cmd('J0', 'declarer_contribution', { montant: 13 });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'MONTANT_INVALIDE');

  assert.equal(table.trames.filter((trame) => trame.type === 'declaration_publiee').length, 0);
  assert.equal(table.manche().contributions.length, 0);
});

test('CA-07 : déclarer exactement son solde est accepté', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(table.cmd('J0', 'declarer_contribution', { montant: 12 }).ok, true);
});

test('CA-07 : un montant négatif ou non entier est refusé', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(table.cmd('J0', 'declarer_contribution', { montant: -1 }).ok, false);
  assert.equal(table.cmd('J0', 'declarer_contribution', { montant: 1.5 }).ok, false);
});
