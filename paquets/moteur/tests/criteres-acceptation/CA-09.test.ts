// CA-09 — US-06. Étant donné un joueur ayant déclaré 4, quand il tente de
// payer 5, alors le paiement est refusé. (RG-09)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-09 : payer plus que déclaré est refusé', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 4 });

  const resultat = table.cmd('J0', 'payer_secret', { montant: 5 });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'MONTANT_INVALIDE');

  const contribution = table.manche().contributions.find((c) => c.joueur_id === 'J0');
  assert.equal(contribution?.montant_paye, null, 'rien n’a été enregistré');
  assert.equal(table.solde('J0'), 12, 'le solde est intact');
});

test('CA-09 : payer sans avoir déclaré est refusé (RG-10)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  const resultat = table.cmd('J1', 'payer_secret', { montant: 1 });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'DECLARATION_REQUISE');
});

test('CA-09 : un second paiement est toujours refusé (RG-70)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J1', 'declarer_contribution', { montant: 4 });
  table.exiger('J1', 'payer_secret', { montant: 2 });
  const resultat = table.cmd('J1', 'payer_secret', { montant: 1 });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'DEJA_SOUMIS');
});

test('CA-09 : la déclaration est figée dès que le paiement est soumis (RG-70)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J1', 'declarer_contribution', { montant: 4 });
  table.exiger('J1', 'payer_secret', { montant: 2 });
  const resultat = table.cmd('J1', 'declarer_contribution', { montant: 9 });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'DEJA_SOUMIS');
});
