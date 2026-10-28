// Test de fumée de l'outillage : si la table de test est fausse, tous les tests
// qui s'appuient sur elle mentent. Elle est donc vérifiée la première.

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants } from '@gdv/moteur';

import { Table, tableEnDeclaration } from './table.ts';

test('une table de 6 joueurs se démarre et atteint la phase VOEU de la manche 1', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(table.etat.etat_partie, 'MANCHE_EN_COURS');
  assert.equal(table.etat.manche_courante, 1);
  assert.equal(table.etat.phase, 'VOEU');
  assert.equal(table.etat.joueurs.length, 6);
  assert.ok(verifierInvariants(table.etat).ok);
});

test('la dotation initiale est un mouvement de journal, pas un solde posé', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  for (const joueur of table.joueurs) {
    assert.equal(table.solde(joueur), table.etat.config.pieces_initiales);
    const siens = table.etat.mouvements.filter((m) => m.joueur_id === joueur);
    assert.equal(siens.length, 1);
    assert.equal(siens[0]?.motif, 'dotation_initiale');
  }
  assert.ok(verifierInvariants(table.etat).ok);
});

test('on atteint la phase DECLARATION_PAIEMENT par expirations successives', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(table.etat.phase, 'DECLARATION_PAIEMENT');
});
