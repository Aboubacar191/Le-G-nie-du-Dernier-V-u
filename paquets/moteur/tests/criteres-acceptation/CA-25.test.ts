// CA-25 — US-10. Étant donné un accusé menteur d'ampleur 5 ne disposant que de
// 3 pièces, quand l'amende de 10 est liquidée, alors l'accusé tombe à 0,
// l'accusateur reçoit 3, et AUCUN solde n'est négatif. (RG-41 : un prélèvement
// involontaire est PLAFONNÉ au solde, jamais refusé. Le reliquat est abandonné.)
//
// Mise en place : un menteur d'ampleur 5 a nécessairement un solde >= 5 au
// moment de déclarer. Le seul chemin légitime pour le ramener à 3 avant la
// liquidation est une dépense POSTÉRIEURE à la déclaration : les enquêtes, qui
// ont lieu en phase ENQUETES_ACCUSATIONS — juste avant l'exécution. Avec
// cout_enquete surchargé à 3, trois enquêtes font 12 → 3.

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants } from '@gdv/moteur';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-25 : l’amende est plafonnée au solde, aucun solde ne devient négatif', () => {
  const table = tableEnDeclaration({ joueurs: 6, config: { cout_enquete: 3 } });
  table.imposerClause('LE_PLUS_GENEREUX'); // sans effet : le vœu échoue
  // J0 ne doit PAS être Inspecteur du Trésor, dont l'enquête coûte moins (RG-26).
  table.imposerRole('J0', 'PRETEUR');
  table.declarerEtPayer([
    [5, 0], // J0 : ampleur 5
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');

  for (const cible of ['J1', 'J2', 'J3']) {
    table.exiger('J0', 'lancer_enquete', { cible_joueur_id: cible });
  }
  assert.equal(table.solde('J0'), 3, 'le menteur n’a plus que 3 pièces');

  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  const soldeAccusateurAvant = table.solde('J1');

  table.allerA('EXECUTION');

  const accusation = table.manche(1).accusations[0];
  assert.equal(accusation?.verdict, 'MENTEUR');
  assert.equal(accusation?.ampleur_mensonge, 5);
  assert.equal(accusation?.montant_amende_du, 10, '2 × 5');
  assert.equal(accusation?.montant_amende_liquide, 3, 'plafonné au solde');

  assert.equal(table.solde('J0'), 0, 'l’accusé tombe à 0');
  assert.equal(table.solde('J1'), soldeAccusateurAvant + 3, 'l’accusateur reçoit 3');

  const rapport = verifierInvariants(table.etat);
  assert.deepEqual(rapport.solde_negatif, []);
  assert.deepEqual(rapport.solde_incoherent, []);
});

test('CA-25 : le reliquat est ABANDONNÉ, pas reporté à la manche suivante', () => {
  const table = tableEnDeclaration({ joueurs: 6, config: { cout_enquete: 3 } });
  table.imposerClause('LE_PLUS_GENEREUX');
  table.imposerRole('J0', 'PRETEUR');
  table.declarerEtPayer([
    [5, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  for (const cible of ['J1', 'J2', 'J3']) {
    table.exiger('J0', 'lancer_enquete', { cible_joueur_id: cible });
  }
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  table.allerA('EXECUTION');
  table.expirer();

  // Manche 2 : aucune reprise du reliquat de 7 pièces.
  table.allerA('EXECUTION');
  table.expirer();
  assert.equal(table.solde('J0'), 0, 'rien de plus n’a été prélevé');
  assert.ok(verifierInvariants(table.etat).ok);
});
