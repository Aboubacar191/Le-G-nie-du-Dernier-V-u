// CA-45 — US-17. Étant donné un hôte créant une session avec objectif_par_joueur
// à 4, quand la manche 1 s'ouvre à 6 joueurs, alors l'objectif annoncé vaut 24,
// SANS AUCUNE MODIFICATION DE CODE. (RG-07, RG-60)

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

test('CA-45 : objectif_par_joueur 4 à 6 joueurs donne un objectif de 24', () => {
  const table = new Table({ joueurs: 6, config: { objectif_par_joueur: 4 } }).demarrer();

  assert.equal(table.manche(1).objectif, 24);
  const annonces = table.trames.filter((trame) => trame.type === 'voeu_annonce');
  assert.equal(annonces.length, 6, 'annoncé publiquement à toute la table');
  for (const trame of annonces) {
    assert.equal(trame.charge.objectif, 24);
    assert.equal(trame.charge.numero_manche, 1);
    assert.equal(trame.charge.nb_manches, 5);
  }
});

test('CA-45 : l’objectif suit l’effectif, à configuration constante', () => {
  for (const [joueurs, attendu] of [
    [5, 15],
    [6, 18],
    [7, 21],
    [8, 24],
  ] as readonly (readonly [number, number])[]) {
    const table = new Table({ joueurs }).demarrer();
    assert.equal(table.manche(1).objectif, attendu, `${joueurs} joueurs`);
  }
});

test('CA-45 : d’autres paramètres se surchargent aussi sans toucher au code', () => {
  const table = new Table({
    joueurs: 6,
    config: { pieces_initiales: 30, nb_manches: 2, multiplicateur_recompense: 4 },
  }).demarrer();

  assert.equal(table.solde('J0'), 30, 'dotation initiale surchargée');
  assert.equal(table.etat.config.nb_manches, 2);

  table.allerA('DECLARATION_PAIEMENT');
  for (const joueur of table.joueurs) {
    table.exiger(joueur, 'declarer_contribution', { montant: 3 });
    table.exiger(joueur, 'payer_secret', { montant: 3 });
  }
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).recompense, 72, '4 × 18');

  table.expirer();
  table.allerA('EXECUTION');
  table.expirer();
  assert.equal(table.etat.etat_partie, 'TERMINEE', 'la partie dure 2 manches, pas 5');
});

test('CA-45 : la configuration est FIGÉE pour la session', () => {
  const table = new Table({ joueurs: 6, config: { objectif_par_joueur: 4 } }).demarrer();
  const config = table.etat.config;
  table.allerA('EXECUTION');
  table.expirer();
  assert.deepEqual(table.etat.config, config, 'une partie ne change pas de règles en cours');
  assert.equal(table.manche(2).objectif, 24);
});
