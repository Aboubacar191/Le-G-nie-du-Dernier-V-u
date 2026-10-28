// CA-06 — US-04. Étant donné une session de 5 à 8 joueurs distribuée, quand on
// inspecte la distribution côté serveur, alors chaque joueur a exactement
// 1 rôle et 1 mission, les 4 rôles sont tous présents, aucun rôle n'est présent
// plus de 2 fois. (RG-04, RG-05)
//
// L'énoncé décrit la distribution DE BASE : « 1 rôle ET 1 mission ». En mode
// avancé, RG-51 remplace la mission d'un joueur par le rôle MARCHAND_DEJA_LIE,
// si bien que ce joueur n'a plus de mission et que son rôle de base disparaît.
// Le critère est donc vérifié hors mode avancé, ce que son énoncé décrit ; le
// mode avancé est couvert par CA-37 et l'écart est consigné au rapport.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES_BASE } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

const EXEMPLAIRES_MAX = 2;

for (const effectif of [5, 6, 7, 8]) {
  test(`CA-06 : distribution conforme à ${effectif} joueurs`, () => {
    const table = new Table({ joueurs: effectif, graine: `graine-${effectif}` }).demarrer();

    for (const joueur of table.etat.joueurs) {
      assert.notEqual(joueur.role_secret, null, 'exactement 1 rôle');
      assert.notEqual(joueur.mission_secrete, null, 'exactement 1 mission');
    }

    const comptage = new Map<string, number>();
    for (const joueur of table.etat.joueurs) {
      const role = String(joueur.role_secret);
      comptage.set(role, (comptage.get(role) ?? 0) + 1);
    }
    for (const role of ROLES_BASE) {
      assert.ok((comptage.get(role) ?? 0) >= 1, `le rôle ${role} doit être présent`);
    }
    for (const [role, nombre] of comptage) {
      assert.ok(nombre <= EXEMPLAIRES_MAX, `${role} présent ${nombre} fois (maximum 2)`);
    }
    assert.ok(!comptage.has('MARCHAND_DEJA_LIE'), 'le rôle du mode avancé n’est pas distribué');
  });
}

test('CA-06 : aucune mission GARDIEN_DE_LA_LAMPE hors mode avancé', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  for (const joueur of table.etat.joueurs) {
    assert.notEqual(joueur.mission_secrete, 'GARDIEN_DE_LA_LAMPE');
  }
});
