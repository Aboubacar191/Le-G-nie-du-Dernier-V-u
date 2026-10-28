// CA-32 — US-11. Étant donné n'importe quelle exécution, quand la phase se
// termine, alors pour CHAQUE joueur le solde est égal à la SOMME de ses
// mouvements de pièces, et AUCUN solde n'est négatif. (RG-41, RG-42)
//
// L'invariant est vérifié après CHAQUE transition, et pas seulement en fin de
// manche : c'est ce que demandent les invariants_testes_obligatoires de l'ARCHI.

import test from 'node:test';
import assert from 'node:assert/strict';

import { verifierInvariants, type EtatSession } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

function exigerInvariants(etat: EtatSession, ou: string): void {
  const rapport = verifierInvariants(etat);
  assert.deepEqual(rapport.solde_negatif, [], `soldes négatifs ${ou}`);
  assert.deepEqual(rapport.solde_incoherent, [], `solde != somme des mouvements ${ou}`);

  // Le solde_apres dénormalisé doit aussi concorder (ARCHI mouvements_pieces).
  for (const joueur of etat.joueurs) {
    const siens = etat.mouvements.filter((mouvement) => mouvement.joueur_id === joueur.id);
    const dernier = siens[siens.length - 1];
    if (dernier === undefined) continue;
    assert.equal(dernier.solde_apres, joueur.solde_pieces, `solde_apres de ${joueur.id} ${ou}`);
  }
}

test('CA-32 : les invariants tiennent après CHAQUE transition d’une partie complète', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-32' }).demarrer();
  exigerInvariants(table.etat, 'après la distribution');

  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('NEGOCIATION');
    table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 2 });
    exigerInvariants(table.etat, `après un transfert (manche ${manche})`);

    table.allerA('DECLARATION_PAIEMENT');
    table.joueurs.forEach((joueur, index) => {
      const declare = Math.min(index + 1, table.solde(joueur));
      table.exiger(joueur, 'declarer_contribution', { montant: declare });
      table.exiger(joueur, 'payer_secret', { montant: index % 2 === 0 ? declare : 0 });
      exigerInvariants(table.etat, `après le paiement de ${joueur} (manche ${manche})`);
    });

    table.allerA('ENQUETES_ACCUSATIONS');
    // L'enquête peut être refusée faute de solde au fil des manches : le refus
    // fait partie du scénario, et l'invariant doit tenir dans les deux cas.
    table.cmd('J2', 'lancer_enquete', { cible_joueur_id: 'J1' });
    exigerInvariants(table.etat, `après une enquête (manche ${manche})`);
    table.exiger('J3', 'accuser', { accuse_joueur_id: 'J1' });
    exigerInvariants(table.etat, `après une accusation (manche ${manche})`);

    table.allerA('EXECUTION');
    exigerInvariants(table.etat, `après le pipeline (manche ${manche})`);
    table.expirer();
    exigerInvariants(table.etat, `après la clôture (manche ${manche})`);
  }

  assert.equal(table.etat.etat_partie, 'TERMINEE');
  exigerInvariants(table.etat, 'à la fin de la partie');
});

test('CA-32 : chaque mouvement porte un motif et un delta non nul', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-32b' }).demarrer();
  table.allerA('EXECUTION');
  table.expirer();
  for (const mouvement of table.etat.mouvements) {
    assert.notEqual(mouvement.delta, 0, 'CHECK(delta <> 0)');
    assert.ok(mouvement.motif.length > 0);
    assert.ok(mouvement.solde_apres >= 0, 'CHECK(solde_apres >= 0)');
    assert.ok(mouvement.sequence >= 1);
  }
});

test('CA-32 : les séquences de mouvements sont uniques par joueur', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-32c' }).demarrer();
  table.allerA('NEGOCIATION');
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 3 });
  table.allerA('EXECUTION');
  table.expirer();

  for (const joueur of table.joueurs) {
    const sequences = table.etat.mouvements
      .filter((mouvement) => mouvement.joueur_id === joueur)
      .map((mouvement) => mouvement.sequence);
    assert.equal(new Set(sequences).size, sequences.length, `séquences de ${joueur}`);
  }
});
