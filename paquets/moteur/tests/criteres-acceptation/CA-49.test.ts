// CA-49 — US-05. Étant donné une manche en phase DECLARATION_PAIEMENT où les
// 6 joueurs ont déclaré ET payé avant l'expiration, quand le dernier paiement
// est enregistré, alors la phase passe IMMÉDIATEMENT à REVELATION sans attendre
// la fin du minuteur. (RG-33)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-49 : la phase passe à REVELATION dès le dernier paiement', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  const echeanceAvant = table.etat.phase_fin_at;

  table.joueurs.forEach((joueur) => {
    table.exiger(joueur, 'declarer_contribution', { montant: 3 });
  });
  table.joueurs.slice(0, 5).forEach((joueur) => {
    table.exiger(joueur, 'payer_secret', { montant: 3 });
  });
  assert.equal(table.etat.phase, 'DECLARATION_PAIEMENT', 'il manque un paiement');

  table.exiger('J5', 'payer_secret', { montant: 3 });
  assert.equal(table.etat.phase, 'REVELATION', 'passage immédiat');
  assert.notEqual(table.etat.phase_fin_at, echeanceAvant, 'une nouvelle échéance est posée');
});

test('CA-49 : l’écart total et la révélation partent dans le même mouvement', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 0],
  ]);
  assert.equal(table.etat.phase, 'REVELATION');
  assert.ok(table.trames.some((trame) => trame.type === 'phase_changee'));
  assert.ok(table.trames.some((trame) => trame.type === 'revelation_ecart_total'));
});

test('CA-49 : une déclaration sans paiement ne déclenche PAS le passage', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.joueurs.forEach((joueur) => {
    table.exiger(joueur, 'declarer_contribution', { montant: 2 });
  });
  assert.equal(table.etat.phase, 'DECLARATION_PAIEMENT');
});

test('CA-49 : payer 0 compte comme un paiement soumis', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.joueurs.forEach((joueur) => {
    table.exiger(joueur, 'declarer_contribution', { montant: 0 });
    table.exiger(joueur, 'payer_secret', { montant: 0 });
  });
  assert.equal(table.etat.phase, 'REVELATION');
});
