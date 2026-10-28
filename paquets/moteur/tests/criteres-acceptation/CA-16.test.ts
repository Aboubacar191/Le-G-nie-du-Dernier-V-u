// CA-16 — US-08. Étant donné n'importe quelle manche de n'importe quelle
// partie, quand une révélation est émise, alors son énoncé est VÉRIFIÉ VRAI
// contre les paiements réels enregistrés, et le nombre de suspects publics
// restants journalisé est supérieur ou égal à 2. (RG-20, RG-21)
//
// La revérification est faite par verifierEnonce, écrite dans un module
// DISTINCT de celui qui a sélectionné la révélation — un vérificateur qui
// réutilise le code du sélecteur ne vérifie rien.

import test from 'node:test';
import assert from 'node:assert/strict';

import { MINIMUM_SUSPECTS_PUBLICS } from '@gdv/partage';
import { verifierEnonce } from '@gdv/moteur';

import { Table, aleaScripte } from '../aide/table.ts';

/** Parties variées : effectifs, graines et comportements de paiement différents. */
function* scenarios(): Generator<Table> {
  for (const graine of ['s1', 's2', 's3', 's4']) {
    for (const joueurs of [5, 6, 8]) {
      const table = new Table({ joueurs, graine }).demarrer();
      for (let manche = 1; manche <= 5; manche += 1) {
        table.allerA('DECLARATION_PAIEMENT');
        table.joueurs.forEach((joueur, index) => {
          const declare = (index + manche) % 5;
          table.exiger(joueur, 'declarer_contribution', { montant: declare });
          table.exiger(joueur, 'payer_secret', { montant: index % 2 === 0 ? declare : 0 });
        });
        table.allerA('EXECUTION');
        table.expirer();
      }
      yield table;
    }
  }
}

test('CA-16 : toute révélation émise est vraie et laisse au moins 2 suspects', () => {
  let emises = 0;
  for (const table of scenarios()) {
    for (const manche of table.etat.manches) {
      for (const revelation of manche.revelations) {
        emises += 1;
        assert.equal(revelation.verifiee_vraie, true, 'journalisée comme vérifiée');
        assert.ok(
          verifierEnonce(table.etat, manche, revelation),
          `révélation ${revelation.gabarit} fausse contre les paiements enregistrés`,
        );
        assert.ok(
          revelation.suspects_restants_apres >= MINIMUM_SUSPECTS_PUBLICS,
          `suspects_restants_apres = ${revelation.suspects_restants_apres}`,
        );
      }
    }
  }
  assert.ok(emises > 0, 'le scénario doit produire des révélations à vérifier');
});

test('CA-16 : au plus une révélation de catalogue par manche', () => {
  for (const table of scenarios()) {
    for (const manche of table.etat.manches) {
      assert.ok(
        manche.revelations.length <= 1,
        `manche ${manche.numero} : ${manche.revelations.length} révélations`,
      );
    }
  }
});

test('CA-16 : un énoncé faux est rejeté par la revérification indépendante', () => {
  const table = new Table({ joueurs: 6, alea: aleaScripte([]) }).demarrer();
  table.allerA('DECLARATION_PAIEMENT');
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  const manche = table.manche(1);

  // Personne n'a menti : un COMPTAGE annonçant 2 menteurs est FAUX.
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: { k: 2 } }),
    false,
  );
  // Et le même gabarit avec la bonne valeur serait vrai — mais inéligible.
  assert.equal(
    verifierEnonce(table.etat, manche, { gabarit: 'COMPTAGE', cibles: [], valeurs: { k: 0 } }),
    true,
  );
});
