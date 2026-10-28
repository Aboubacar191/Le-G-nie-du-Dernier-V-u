// CA-24 — US-10. Étant donné un joueur ayant déjà accusé dans la manche
// courante, quand il tente une seconde accusation, alors elle est refusée.
// (RG-19 : au plus accusations_max_par_joueur_par_manche)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

function enAccusations(config?: { accusations_max_par_joueur_par_manche: number }): Table {
  const table = tableEnDeclaration({
    joueurs: 6,
    ...(config === undefined ? {} : { config }),
  });
  table.declarerEtPayer([
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  return table;
}

test('CA-24 : la seconde accusation de la manche est refusée avec QUOTA_DEPASSE', () => {
  const table = enAccusations();
  table.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });

  const resultat = table.cmd('J0', 'accuser', { accuse_joueur_id: 'J2' });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'QUOTA_DEPASSE');
  assert.equal(table.manche().accusations.length, 1);
});

test('CA-24 : le quota est par ACCUSATEUR, pas par table', () => {
  const table = enAccusations();
  table.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
  table.exiger('J2', 'accuser', { accuse_joueur_id: 'J3' });
  assert.equal(table.manche().accusations.length, 2);
});

test('CA-24 : le quota repart à la manche suivante', () => {
  const table = enAccusations();
  table.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
  table.allerA('EXECUTION');
  table.expirer();
  table.allerA('DECLARATION_PAIEMENT');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'declarer_contribution', { montant: 2 });
    table.exiger(joueur, 'payer_secret', { montant: 0 });
  }
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(table.cmd('J0', 'accuser', { accuse_joueur_id: 'J1' }).ok, true);
});

test('CA-24 : le quota est LU dans la configuration (RG-60)', () => {
  const table = enAccusations({ accusations_max_par_joueur_par_manche: 2 });
  table.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
  assert.equal(table.cmd('J0', 'accuser', { accuse_joueur_id: 'J2' }).ok, true);
  assert.equal(table.cmd('J0', 'accuser', { accuse_joueur_id: 'J3' }).ok, false);
});
