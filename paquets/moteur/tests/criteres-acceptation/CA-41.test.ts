// CA-41 — US-15. Étant donné un joueur ayant menti aux manches 1 et 4 et
// n'ayant JAMAIS été démasqué, quand les missions sont évaluées, alors
// LE_FAUSSAIRE est réussie ; s'il avait été démasqué une seule fois, elle serait
// ÉCHOUÉE. (catalogue_missions)

import test from 'node:test';
import assert from 'node:assert/strict';

import { missionReussie } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

/**
 * J0 ment aux manches `manchesMenties`. Si `demasqueA` est renseigné, il est
 * accusé à juste titre à cette manche-là.
 */
function partieAvecFaussaire(manchesMenties: readonly number[], demasqueA?: number): Table {
  const table = new Table({ joueurs: 6, graine: 'ca-41' }).demarrer();
  table.imposerMission('J0', 'LE_FAUSSAIRE');

  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('DECLARATION_PAIEMENT');
    const ment = manchesMenties.includes(manche);
    table.exiger('J0', 'declarer_contribution', { montant: 3 });
    table.exiger('J0', 'payer_secret', { montant: ment ? 0 : 3 });
    for (const joueur of table.joueurs.slice(1)) {
      table.exiger(joueur, 'declarer_contribution', { montant: 3 });
      table.exiger(joueur, 'payer_secret', { montant: 3 });
    }
    table.allerA('ENQUETES_ACCUSATIONS');
    if (demasqueA === manche) {
      table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
    }
    table.allerA('EXECUTION');
    table.expirer();
    // La mission est réévaluée à chaque manche : on la fige après la 5e.
    if (manche === 5) break;
    table.imposerMission('J0', 'LE_FAUSSAIRE');
  }
  return table;
}

test('CA-41 : menti aux manches 1 et 4, jamais démasqué → LE_FAUSSAIRE réussie', () => {
  const table = partieAvecFaussaire([1, 4]);
  assert.equal(missionReussie(table.etat, 'J0', 'LE_FAUSSAIRE'), true);
  const ligne = table.etat.classement?.find((entree) => entree.joueur_id === 'J0');
  assert.equal(ligne?.mission_reussie, true);
});

test('CA-41 : démasqué une seule fois → LE_FAUSSAIRE échouée', () => {
  const table = partieAvecFaussaire([1, 4], 4);
  assert.equal(missionReussie(table.etat, 'J0', 'LE_FAUSSAIRE'), false);
});

test('CA-41 : un seul mensonge ne suffit pas (seuil de 2 manches)', () => {
  const table = partieAvecFaussaire([1]);
  assert.equal(missionReussie(table.etat, 'J0', 'LE_FAUSSAIRE'), false);
});

test('CA-41 : LE_BATISSEUR et LE_SABOTEUR s’évaluent sur les manches réussies', () => {
  // Cinq manches réussies : 6 joueurs × 3 = 18 payés pour un objectif de 18.
  const table = new Table({ joueurs: 6, graine: 'ca-41b' }).demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('DECLARATION_PAIEMENT');
    for (const joueur of table.joueurs) {
      table.exiger(joueur, 'declarer_contribution', { montant: 3 });
      table.exiger(joueur, 'payer_secret', { montant: 3 });
    }
    table.allerA('EXECUTION');
    table.expirer();
  }
  assert.equal(table.etat.manches.filter((manche) => manche.reussi === true).length, 5);
  assert.equal(missionReussie(table.etat, 'J0', 'LE_BATISSEUR'), true, '>= 4 manches réussies');
  assert.equal(missionReussie(table.etat, 'J0', 'LE_SABOTEUR'), false, '0 manche échouée');
});

test('CA-41 : LE_JUSTICIER exige 2 joueurs DISTINCTS démasqués', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-41c' }).demarrer();
  for (let manche = 1; manche <= 2; manche += 1) {
    table.allerA('DECLARATION_PAIEMENT');
    for (const joueur of table.joueurs) {
      table.exiger(joueur, 'declarer_contribution', { montant: 3 });
      table.exiger(joueur, 'payer_secret', { montant: joueur === 'J0' ? 3 : 0 });
    }
    table.allerA('ENQUETES_ACCUSATIONS');
    table.exiger('J0', 'accuser', { accuse_joueur_id: manche === 1 ? 'J1' : 'J2' });
    if (manche === 1) {
      assert.equal(
        missionReussie(table.etat, 'J0', 'LE_JUSTICIER'),
        false,
        'un seul démasqué ne suffit pas',
      );
    }
    table.allerA('EXECUTION');
    table.expirer();
  }
  assert.equal(missionReussie(table.etat, 'J0', 'LE_JUSTICIER'), true);
});

test('CA-41 : LE_MAGNAT est réussie pour TOUS les ex aequo au maximum de pièces', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-41d' }).demarrer();
  // Personne n'a rien dépensé : les six sont à 12, donc tous ex aequo.
  for (const joueur of table.joueurs) {
    assert.equal(missionReussie(table.etat, joueur, 'LE_MAGNAT'), true);
  }
});
