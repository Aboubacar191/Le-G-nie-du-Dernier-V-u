// CA-08 — US-05. Étant donné un joueur en phase DECLARATION_PAIEMENT, quand il
// déclare 4, alors les autres joueurs reçoivent une declaration_publiee de 4
// pour ce joueur. (RG-31 : la déclaration est une ANNONCE.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-08 : la déclaration est publiée à TOUTE la table, auteur compris', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J2', 'declarer_contribution', { montant: 4 });

  const publiees = table.trames.filter((trame) => trame.type === 'declaration_publiee');
  assert.equal(publiees.length, 6, 'une projection par joueur, auteur compris');

  for (const trame of publiees) {
    assert.equal(trame.charge.joueur_id, 'J2');
    assert.equal(trame.charge.montant_declare, 4);
    assert.equal(trame.charge.nb_declarations, 1);
    assert.equal(trame.charge.nb_joueurs, 6);
  }
  assert.equal(new Set(publiees.map((trame) => trame.destinataire)).size, 6);
});

test('CA-08 : une seconde déclaration remplace la première tant que rien n’est payé', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J2', 'declarer_contribution', { montant: 4 });
  table.exiger('J2', 'declarer_contribution', { montant: 7 });

  const contributions = table.manche().contributions.filter((c) => c.joueur_id === 'J2');
  assert.equal(contributions.length, 1, 'un enregistrement unique par (manche, joueur)');
  assert.equal(contributions[0]?.montant_declare, 7);
});
