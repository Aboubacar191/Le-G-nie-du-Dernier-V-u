// CA-02 — US-02. Étant donné une session en SALLE_ATTENTE avec 4 joueurs,
// quand l'hôte tente de démarrer la partie, alors le démarrage est refusé et la
// session reste en SALLE_ATTENTE. (RG-02)

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

test('CA-02 : démarrage refusé à 4 joueurs, la session reste en salle d’attente', () => {
  const table = new Table({ joueurs: 4 });
  const resultat = table.cmd('J0', 'demarrer_partie');

  assert.equal(resultat.ok, false);
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'EFFECTIF_INSUFFISANT');
  assert.equal(table.etat.etat_partie, 'SALLE_ATTENTE');
  assert.equal(resultat.etat, table.etat, 'aucune erreur ne modifie l’état (CA-43)');
});

test('CA-02 : le démarrage est accepté dès joueurs_min', () => {
  const table = new Table({ joueurs: 5 });
  assert.equal(table.cmd('J0', 'demarrer_partie').ok, true);
  assert.equal(table.etat.etat_partie, 'PLACEMENT');
});
