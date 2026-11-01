// CA-15 — US-08. Étant donné une manche où PERSONNE n'a menti, quand le génie
// sélectionne une révélation, alors le gabarit COMPTAGE n'est pas retenu
// (k == 0 interdit) et, si aucun gabarit n'est éligible, AUCUNE révélation autre
// que l'écart total n'est émise. (RG-21, loi 2)

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles } from '@gdv/moteur';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-15 : COMPTAGE n’est pas éligible quand personne n’a menti', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  const manche = table.manche(1);
  const candidats = candidatsEligibles(table.etat, manche);
  assert.ok(
    !candidats.some((candidat) => candidat.gabarit === 'COMPTAGE'),
    'k == 0 révélerait l’honnêteté de tous',
  );
});

test('CA-15 : COMPTAGE n’est pas éligible quand TOUS ont menti (k == nb_joueurs)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
    [3, 0],
  ]);
  const candidats = candidatsEligibles(table.etat, table.manche(1));
  assert.ok(
    !candidats.some((candidat) => candidat.gabarit === 'COMPTAGE'),
    'k == nb_joueurs révélerait la culpabilité de tous',
  );
});

test('CA-15 : si aucun gabarit n’est éligible, seul l’écart total est publié', () => {
  // Aucun joueur n'a menti ET aucun paiement ne diffère d'un autre : ni
  // COMPTAGE (k = 0), ni VOISINAGE (aucun menteur), ni COMPARAISON (tous
  // égaux), ni PASSE (manche 1). Seule EXONERATION reste, et elle exige qu'il
  // reste 2 suspects après retrait — ce qui est vrai à 6 joueurs.
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  const candidats = candidatsEligibles(table.etat, table.manche(1));
  for (const candidat of candidats) {
    assert.equal(candidat.gabarit, 'EXONERATION', `gabarit inattendu : ${candidat.gabarit}`);
  }

  // Et à 2 joueurs — effectif atteignable par surcharge de configuration — même
  // EXONERATION devient inéligible : il ne resterait qu'un suspect.
  const duo = tableEnDeclaration({ joueurs: 2, config: { joueurs_min: 2 } });
  duo.declarerEtPayer([
    [0, 0],
    [0, 0],
  ]);
  assert.deepEqual(candidatsEligibles(duo.etat, duo.manche(1)), []);

  // RUP-02 / x-emission = uniforme_par_manche. La trame revelation est émise à
  // CHAQUE manche, éligible ou non, mais sa charge est alors la variante neutre
  // {numero_manche} : le génie n'invente TOUJOURS aucun énoncé de remplacement.
  //
  // Ce que la rupture change : l'ABSENCE de la trame révélait la CONDITION qui
  // la déclenche, c'est-à-dire l'état de l'ensemble des suspects (RG-81). RG-80
  // énonce de son côté qu'un champ ne peut pas être publié dans certaines
  // manches et omis dans d'autres. Le coût de la fermeture étant nul, elle est
  // faite — et c'est ici qu'elle se mesure.
  const revelations = duo.trames.filter((trame) => trame.type === 'revelation');
  assert.equal(revelations.length, duo.joueurs.length, 'une trame par joueur, toujours');
  for (const trame of revelations) {
    assert.deepEqual(
      Object.keys(trame.charge),
      ['numero_manche'],
      'aucun énoncé de remplacement : la charge est la variante neutre',
    );
    assert.equal(trame.charge.revelation, undefined);
  }
  assert.ok(duo.trames.some((trame) => trame.type === 'revelation_ecart_total'));
});
