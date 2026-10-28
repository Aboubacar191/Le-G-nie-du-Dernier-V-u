// CA-21 — US-09. Étant donné un joueur disposant de 1 pièce et SANS rôle
// Inspecteur, quand il tente d'enquêter, alors l'enquête est refusée et son
// solde est inchangé. (RG-26, RG-41 : refus A PRIORI, jamais de solde négatif.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-21 : enquête refusée faute de solde, solde inchangé, aucune enquête écrite', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerRole('J0', 'PRETEUR'); // n'est PAS inspecteur
  table.declarerEtPayer([
    [11, 11],
    [5, 2],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(table.solde('J0'), 1);

  const resultat = table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'SOLDE_INSUFFISANT');

  assert.equal(table.solde('J0'), 1, 'le solde est inchangé');
  assert.equal(table.manche().enquetes.length, 0, 'aucune enquête enregistrée');
  assert.equal(table.tramesDe('J0', 'resultat_enquete').length, 0, 'aucun résultat livré');
});

test('CA-21 : un joueur à 0 pièce ne peut pas enquêter non plus', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [12, 12],
    [5, 2],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(table.solde('J0'), 0);
  const resultat = table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'SOLDE_INSUFFISANT');
});
