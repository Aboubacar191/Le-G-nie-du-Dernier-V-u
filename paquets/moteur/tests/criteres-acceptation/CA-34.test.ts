// CA-34 — US-12. Étant donné un Prêteur ayant prêté 4 pièces à la manche 2,
// quand l'exécution de la manche 3 se déroule, alors 6 pièces (plafond de
// 4 × 1,5) sont prélevées sur l'emprunteur au profit du Prêteur, plafonnées à
// son solde, le reliquat restant dû. (RG-29)

import test from 'node:test';
import assert from 'node:assert/strict';

import { plafond, unPlus, verifierInvariants } from '@gdv/moteur';

import { Table } from '../aide/table.ts';

/** Traverse une manche sans qu'aucun joueur n'agisse : tout vaut 0 (RG-32). */
function traverserUneManche(table: Table): void {
  table.allerA('EXECUTION');
  table.expirer();
}

function tableAvecPretALaManche2(): Table {
  const table = new Table({ joueurs: 6, graine: 'ca-34' }).demarrer();
  table.imposerRole('J0', 'PRETEUR');
  traverserUneManche(table); // manche 1

  table.allerA('NEGOCIATION');
  assert.equal(table.etat.manche_courante, 2);
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
  const pretId = table.etat.prets[0]?.id ?? '';
  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: true });
  return table;
}

test('CA-34 : le du_total vaut plafond(principal × (1 + taux)) = 6', () => {
  const table = tableAvecPretALaManche2();
  const pret = table.etat.prets[0];
  assert.equal(pret?.statut, 'ACTIF');
  assert.equal(pret?.principal, 4);
  assert.equal(pret?.du_total, 6);
  assert.equal(pret?.manche_emission, 2);
  assert.equal(plafond(4, unPlus([1, 2])), 6, 'arithmétique entière, arrondi SUPÉRIEUR');

  assert.equal(table.solde('J0'), 8, '12 − 4 prêtées');
  assert.equal(table.solde('J1'), 16, '12 + 4 reçues');
});

test('CA-34 : rien n’est prélevé à l’exécution de la manche d’ÉMISSION', () => {
  const table = tableAvecPretALaManche2();
  table.allerA('EXECUTION');
  assert.equal(table.etat.prets[0]?.rembourse, 0, 'manche 2 : pas encore échu');
  assert.equal(table.solde('J1'), 16);
});

test('CA-34 : 6 pièces sont prélevées à l’exécution de la manche 3', () => {
  const table = tableAvecPretALaManche2();
  traverserUneManche(table); // clôture de la manche 2
  table.allerA('EXECUTION'); // manche 3
  assert.equal(table.etat.manche_courante, 3);

  const pret = table.etat.prets[0];
  assert.equal(pret?.rembourse, 6);
  assert.equal(pret?.statut, 'SOLDE');
  assert.equal(table.solde('J1'), 10, '16 − 6');
  assert.equal(table.solde('J0'), 14, '8 + 6');
  assert.ok(verifierInvariants(table.etat).ok);

  const preleves = table.trames.filter((trame) => trame.type === 'pret_preleve');
  assert.deepEqual([...new Set(preleves.map((trame) => trame.destinataire))].sort(), [
    'J0',
    'J1',
  ]);
  assert.equal(preleves[0]?.charge.montant_preleve, 6);
  assert.equal(preleves[0]?.charge.reliquat_du, 0);
});

test('CA-34 : le prélèvement est plafonné au solde, le reliquat reste dû', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-34b' }).demarrer();
  table.imposerRole('J0', 'PRETEUR');
  traverserUneManche(table);

  table.allerA('NEGOCIATION');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
  const pretId = table.etat.prets[0]?.id ?? '';
  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: true });

  // L'emprunteur dépense presque tout : il n'aura pas de quoi rembourser.
  table.allerA('DECLARATION_PAIEMENT');
  table.exiger('J1', 'declarer_contribution', { montant: 14 });
  table.exiger('J1', 'payer_secret', { montant: 14 });
  traverserUneManche(table); // clôture de la manche 2

  table.allerA('EXECUTION'); // manche 3
  const pret = table.etat.prets[0];
  assert.equal(table.solde('J1'), 0, 'plafonné au solde : il ne reste rien');
  assert.equal(pret?.rembourse, 2, '16 − 14 = 2 disponibles');
  assert.equal(pret?.statut, 'ACTIF', 'le reliquat reste dû');
  assert.ok(verifierInvariants(table.etat).ok);

  // Aux exécutions suivantes, le reliquat est reprélevé dès qu'il y a de quoi.
  table.expirer();
  table.allerA('NEGOCIATION');
  table.exiger('J2', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 4 });
  table.allerA('EXECUTION');
  assert.equal(table.etat.prets[0]?.rembourse, 6);
  assert.equal(table.etat.prets[0]?.statut, 'SOLDE');
});
