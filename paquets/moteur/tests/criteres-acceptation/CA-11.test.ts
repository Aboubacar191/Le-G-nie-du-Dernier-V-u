// CA-11 — US-06. Étant donné une phase DECLARATION_PAIEMENT, quand un joueur ne
// soumet rien avant l'expiration, alors sa contribution est enregistrée à
// déclaré 0 / payé 0 et la manche continue. (RG-32)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-11 : une non-soumission vaut 0 déclaré / 0 payé, sans autre sanction', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 5 });
  table.exiger('J0', 'payer_secret', { montant: 5 });

  table.expirer(); // expiration de DECLARATION_PAIEMENT

  assert.equal(table.etat.phase, 'REVELATION');
  const manche = table.manche();
  assert.equal(manche.contributions.length, 6, 'une contribution MATÉRIALISÉE par joueur');
  for (const joueur of table.joueurs.slice(1)) {
    const contribution = manche.contributions.find((c) => c.joueur_id === joueur);
    assert.equal(contribution?.montant_declare, 0);
    assert.equal(contribution?.montant_paye, 0);
    assert.equal(table.solde(joueur), 12, 'aucune autre sanction : le solde est intact');
  }
  assert.equal(manche.total_declare, 5);
  assert.equal(manche.total_paye, 5);
});

test('CA-11 : la manche continue jusqu’à son terme malgré les non-soumissions', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.allerA('EXECUTION');
  table.expirer();
  assert.equal(table.manche(1).cloture, true);
  assert.equal(table.etat.manche_courante, 2);
});
