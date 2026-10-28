// CA-05 — US-04. Étant donné une session de 6 joueurs qui vient d'être
// distribuée, quand on inspecte l'INTÉGRALITÉ des messages reçus par le joueur
// A, alors A connaît son rôle et sa mission, et AUCUN message reçu par A ne
// contient le rôle ou la mission d'un autre joueur. (RG-01)

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

test('CA-05 : A reçoit SON attribution, et une seule', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const a = 'J0';

  const siennes = table.tramesDe(a, 'attribution_privee');
  assert.equal(siennes.length, 1, 'une attribution, et une seule');
  const attendu = table.etat.joueurs.find((joueur) => joueur.id === a);
  assert.equal(siennes[0]?.charge.role_secret, attendu?.role_secret);
  assert.equal(siennes[0]?.charge.mission_secrete, attendu?.mission_secrete);
});

test('CA-05 : aucune trame reçue par A ne porte le secret d’un autre joueur', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const a = 'J0';
  const moi = table.etat.joueurs.find((joueur) => joueur.id === a);
  const miens = new Set([moi?.role_secret, moi?.mission_secrete]);

  // Les secrets d'autrui qui ne sont PAS aussi les siens : deux joueurs peuvent
  // porter le même rôle (RG-04 autorise les doublons), et la coïncidence de
  // valeur n'est alors pas une fuite.
  const secretsDAutrui: string[] = [];
  for (const joueur of table.etat.joueurs) {
    if (joueur.id === a) continue;
    for (const secret of [joueur.role_secret, joueur.mission_secrete]) {
      if (secret === null || miens.has(secret)) continue;
      secretsDAutrui.push(secret);
    }
  }

  const recues = JSON.stringify(table.tramesDe(a));
  for (const secret of secretsDAutrui) {
    assert.ok(
      !recues.includes(secret),
      `le secret « ${secret} » d’un autre joueur apparaît dans une trame reçue par A`,
    );
  }
});

test('CA-05 : chaque joueur reçoit exactement une attribution, la sienne', () => {
  const table = new Table({ joueurs: 7, graine: 'ca-05' }).demarrer();
  for (const joueur of table.joueurs) {
    const trames = table.tramesDe(joueur, 'attribution_privee');
    assert.equal(trames.length, 1);
    const attendu = table.etat.joueurs.find((candidat) => candidat.id === joueur);
    assert.equal(trames[0]?.charge.role_secret, attendu?.role_secret);
  }
});
