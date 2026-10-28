// CA-20 — US-09. Étant donné un Inspecteur du Trésor disposant de 1 pièce,
// quand il enquête, alors l'enquête aboutit et coûte 1 pièce. (RG-26)

import test from 'node:test';
import assert from 'node:assert/strict';

import { coutEnqueteDe } from '@gdv/moteur';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-20 : l’Inspecteur du Trésor enquête pour 1 pièce, et aboutit', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerRole('J0', 'INSPECTEUR_TRESOR');
  // J0 descend à 1 pièce : il déclare 11 et paie 11.
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
  assert.equal(coutEnqueteDe(table.etat, 'J0'), 1, 'coût réduit lu dans la configuration');

  assert.equal(table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J1' }).ok, true);
  assert.equal(table.solde('J0'), 0);
  const resultat = table.tramesDe('J0', 'resultat_enquete')[0];
  assert.equal(resultat?.charge.cout_paye, 1);
  assert.equal(resultat?.charge.montant_paye, 2);
});

test('CA-20 : le coût réduit vient de la configuration, pas d’un littéral (RG-60)', () => {
  const table = tableEnDeclaration({
    joueurs: 6,
    config: { cout_enquete: 9, cout_enquete_inspecteur_tresor: 4 },
  });
  table.imposerRole('J0', 'INSPECTEUR_TRESOR');
  assert.equal(coutEnqueteDe(table.etat, 'J0'), 4);
  assert.equal(coutEnqueteDe(table.etat, 'J1'), 9);
});
