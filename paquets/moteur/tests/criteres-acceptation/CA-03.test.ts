// CA-03 — US-02. Étant donné une session en SALLE_ATTENTE avec 8 joueurs,
// quand un 9e joueur tente de rejoindre, alors l'adhésion est refusée avec un
// code d'erreur explicite. (RG-02)

import test from 'node:test';
import assert from 'node:assert/strict';

import { rejoindreSession } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

test('CA-03 : le 9e joueur est refusé avec SESSION_PLEINE', () => {
  const table = new Table({ joueurs: 8 });
  assert.equal(table.etat.joueurs.length, 8);

  const refus = rejoindreSession(table.etat, { joueur_id: 'J8', pseudo: 'Neuvieme' });
  assert.equal(refus.ok, false);
  assert.equal((refus as { code: string }).code, 'SESSION_PLEINE');
  assert.equal(table.etat.joueurs.length, 8, 'la table n’a pas bougé');
});

test('CA-03 : un pseudo déjà pris dans CETTE session est refusé', () => {
  const table = new Table({ joueurs: 6 });
  const refus = rejoindreSession(table.etat, { joueur_id: 'J9', pseudo: 'Joueur1' });
  assert.equal(refus.ok, false);
  assert.equal((refus as { code: string }).code, 'PSEUDO_INDISPONIBLE');
});
