// CA-35 — US-12. Étant donné un joueur à 0 pièce, quand la manche suivante
// s'ouvre, alors il n'est PAS éliminé, peut recevoir un transfert ou un prêt, et
// peut accuser. (RG-46 : personne n'est jamais éliminé.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

/** Ruine J1 en lui faisant payer tout son solde à la manche 1. */
function tableAvecJoueurRuine(): Table {
  const table = new Table({ joueurs: 6, graine: 'ca-35' }).demarrer();
  table.allerA('DECLARATION_PAIEMENT');
  table.exiger('J1', 'declarer_contribution', { montant: 12 });
  table.exiger('J1', 'payer_secret', { montant: 12 });
  table.allerA('EXECUTION');
  table.expirer();
  return table;
}

test('CA-35 : un joueur à 0 pièce n’est pas éliminé et reste dans la session', () => {
  const table = tableAvecJoueurRuine();
  // Le vœu a échoué (12 < 18) : aucune part ne lui est revenue.
  assert.equal(table.solde('J1'), 0);
  assert.equal(table.etat.manche_courante, 2);
  assert.ok(table.etat.joueurs.some((joueur) => joueur.id === 'J1'));
  assert.equal(table.etat.joueurs.length, 6);
});

test('CA-35 : il peut RECEVOIR un transfert', () => {
  const table = tableAvecJoueurRuine();
  table.allerA('NEGOCIATION');
  assert.equal(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 5 }).ok, true);
  assert.equal(table.solde('J1'), 5);
});

test('CA-35 : il peut RECEVOIR un prêt', () => {
  const table = tableAvecJoueurRuine();
  table.imposerRole('J0', 'PRETEUR');
  table.allerA('NEGOCIATION');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 6 });
  const pretId = table.etat.prets[0]?.id ?? '';
  assert.equal(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true }).ok, true);
  assert.equal(table.solde('J1'), 6);
});

test('CA-35 : il peut ACCUSER, même sans une pièce', () => {
  const table = tableAvecJoueurRuine();
  table.allerA('DECLARATION_PAIEMENT');
  table.exiger('J2', 'declarer_contribution', { montant: 4 });
  table.exiger('J2', 'payer_secret', { montant: 1 });
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(table.solde('J1'), 0);
  assert.equal(table.cmd('J1', 'accuser', { accuse_joueur_id: 'J2' }).ok, true);
  assert.equal(table.manche().accusations[0]?.verdict, 'MENTEUR');
});

test('CA-35 : il peut DÉCLARER 0 et payer 0, sans être pénalisé', () => {
  const table = tableAvecJoueurRuine();
  table.allerA('DECLARATION_PAIEMENT');
  assert.equal(table.cmd('J1', 'declarer_contribution', { montant: 0 }).ok, true);
  assert.equal(table.cmd('J1', 'payer_secret', { montant: 0 }).ok, true);
  assert.equal(table.solde('J1'), 0);
});
