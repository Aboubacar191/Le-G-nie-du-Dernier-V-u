// CA-18 — US-08. Étant donné un cercle d'ordre [A,B,C,D,E,F] où SEUL F a menti,
// quand le gabarit VOISINAGE est évalué pour la cible A, alors il est éligible
// (F est voisin CYCLIQUE de A) et l'énoncé désigne A sans l'accuser.

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles, suspectsPublics, voisinsDe } from '@gdv/moteur';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-18 : le cercle est cyclique — le dernier est voisin du premier (RG-06)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.deepEqual([...voisinsDe(table.etat, 'J0')].sort(), ['J1', 'J5']);
  assert.deepEqual([...voisinsDe(table.etat, 'J5')].sort(), ['J0', 'J4']);
});

test('CA-18 : VOISINAGE est éligible pour A quand seul F a menti', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // A..E honnêtes, F (J5) menteur.
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 0],
  ]);

  const candidats = candidatsEligibles(table.etat, table.manche(1));
  const voisinages = candidats.filter((candidat) => candidat.gabarit === 'VOISINAGE');
  const cibles = voisinages.map((candidat) => candidat.cibles[0]);

  assert.ok(cibles.includes('J0'), 'A est une cible éligible : son voisin cyclique F a menti');
  assert.ok(cibles.includes('J4'), 'E aussi : F est son autre voisin');
  assert.deepEqual([...cibles].sort(), ['J0', 'J4'], 'et personne d’autre');
});

test('CA-18 : l’énoncé désigne A sans l’accuser ni l’exonérer', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 0],
  ]);
  const avant = suspectsPublics(table.etat, table.manche(1));
  const candidat = candidatsEligibles(table.etat, table.manche(1)).find(
    (c) => c.gabarit === 'VOISINAGE' && c.cibles[0] === 'J0',
  );
  assert.ok(candidat !== undefined);
  // La cible reste suspecte : l'ensemble n'a pas diminué d'elle.
  assert.equal(candidat.suspects_restants_apres, avant.length);
  assert.ok(avant.includes('J0'));
  assert.deepEqual(candidat.valeurs, {}, 'aucune valeur chiffrée : rien à déduire');
});
