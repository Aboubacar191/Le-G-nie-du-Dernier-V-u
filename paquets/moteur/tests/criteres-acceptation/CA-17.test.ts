// CA-17 — US-08. Étant donné une partie en manche 2, quand le génie sélectionne
// une révélation, alors le gabarit PASSE n'est pas disponible. (RG-45 :
// disponible à partir de manche_min_revelation_passe, qui vaut 3.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

/** Fait mentir tout le monde à chaque manche : PASSE serait sinon inéligible de fait. */
function partieOuToutLeMondeMent(config?: { manche_min_revelation_passe: number }): Table {
  const table = new Table({
    joueurs: 6,
    graine: 'ca-17',
    ...(config === undefined ? {} : { config }),
  }).demarrer();
  return table;
}

function jouerUneManche(table: Table): void {
  table.allerA('DECLARATION_PAIEMENT');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'declarer_contribution', { montant: 2 });
    table.exiger(joueur, 'payer_secret', { montant: 0 });
  }
}

test('CA-17 : PASSE est indisponible en manche 1 et en manche 2', () => {
  const table = partieOuToutLeMondeMent();

  jouerUneManche(table);
  assert.equal(table.etat.manche_courante, 1);
  assert.ok(
    !candidatsEligibles(table.etat, table.manche(1)).some((c) => c.gabarit === 'PASSE'),
    'manche 1 : PASSE indisponible',
  );
  table.allerA('EXECUTION');
  table.expirer();

  jouerUneManche(table);
  assert.equal(table.etat.manche_courante, 2);
  assert.ok(
    !candidatsEligibles(table.etat, table.manche(2)).some((c) => c.gabarit === 'PASSE'),
    'manche 2 : PASSE indisponible',
  );
});

test('CA-17 : PASSE devient disponible en manche 3, car tous ont menti depuis la 1re', () => {
  const table = partieOuToutLeMondeMent();
  for (let manche = 1; manche <= 2; manche += 1) {
    jouerUneManche(table);
    table.allerA('EXECUTION');
    table.expirer();
  }
  jouerUneManche(table);
  assert.equal(table.etat.manche_courante, 3);
  assert.ok(
    candidatsEligibles(table.etat, table.manche(3)).some((c) => c.gabarit === 'PASSE'),
    'manche 3 : PASSE éligible',
  );
});

test('CA-17 : le seuil est LU dans la configuration, pas codé en dur (RG-60)', () => {
  const table = partieOuToutLeMondeMent({ manche_min_revelation_passe: 2 });
  jouerUneManche(table);
  table.allerA('EXECUTION');
  table.expirer();
  jouerUneManche(table);
  assert.equal(table.etat.manche_courante, 2);
  assert.ok(
    candidatsEligibles(table.etat, table.manche(2)).some((c) => c.gabarit === 'PASSE'),
    'avec un seuil surchargé à 2, PASSE est éligible dès la manche 2',
  );
});
