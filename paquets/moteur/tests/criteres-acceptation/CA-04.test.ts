// CA-04 — US-03. Étant donné une session de 6 joueurs en PLACEMENT, quand
// l'hôte soumet un ordre qui omet un joueur ou en duplique un, alors l'ordre est
// refusé et la session reste en PLACEMENT. (RG-06)

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

function enPlacement(): Table {
  const table = new Table({ joueurs: 6 });
  table.exiger('J0', 'demarrer_partie');
  return table;
}

test('CA-04 : un ordre qui OMET un joueur est refusé', () => {
  const table = enPlacement();
  const resultat = table.cmd('J0', 'definir_ordre_places', {
    ordre: table.joueurs.slice(0, 5),
  });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'ORDRE_PLACES_INVALIDE');
  assert.equal(table.etat.etat_partie, 'PLACEMENT');
});

test('CA-04 : un ordre qui DUPLIQUE un joueur est refusé', () => {
  const table = enPlacement();
  const ordre = [...table.joueurs.slice(0, 5), 'J0'];
  const resultat = table.cmd('J0', 'definir_ordre_places', { ordre });
  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'ORDRE_PLACES_INVALIDE');
  assert.equal(table.etat.etat_partie, 'PLACEMENT');
});

test('CA-04 : un ordre contenant un joueur étranger à la session est refusé', () => {
  const table = enPlacement();
  const ordre = [...table.joueurs.slice(0, 5), 'INTRUS'];
  const resultat = table.cmd('J0', 'definir_ordre_places', { ordre });
  assert.equal(resultat.ok, false);
  assert.equal(table.etat.etat_partie, 'PLACEMENT');
});

test('CA-04 : une permutation complète et unique est acceptée', () => {
  const table = enPlacement();
  assert.equal(table.cmd('J0', 'definir_ordre_places', { ordre: table.joueurs }).ok, true);
  const positions = table.etat.joueurs.map((joueur) => joueur.position_cercle).sort();
  assert.deepEqual(positions, [1, 2, 3, 4, 5, 6]);
});

test('CA-04 : la commande est réservée à l’hôte', () => {
  const table = enPlacement();
  const resultat = table.cmd('J1', 'definir_ordre_places', { ordre: table.joueurs });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'ACTION_RESERVEE_HOTE');
});
