// CA-22 — US-10. Étant donné un accusé ayant déclaré 5 et payé 2 (ampleur 3),
// sans clause d'amende active, quand il est accusé à juste titre, alors le
// verdict MENTEUR est public IMMÉDIATEMENT, et à l'exécution 6 pièces (2 × 3)
// passent de l'accusé à l'accusateur et la part de récompense de l'accusé est
// NULLE. (RG-16, RG-15, RG-43)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

function tableAvecAccusationJuste(): Table {
  const table = tableEnDeclaration({ joueurs: 6 });
  // Clause sans effet sur les amendes ni sur la récompense en cas de succès.
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer([
    [5, 2], // J0 : ampleur 3
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  return table;
}

test('CA-22 : le verdict MENTEUR est public immédiatement, sans ampleur ni montant', () => {
  const table = tableAvecAccusationJuste();

  const resolues = table.trames.filter((trame) => trame.type === 'accusation_resolue');
  assert.equal(resolues.length, 6, 'public : une projection par joueur');
  for (const trame of resolues) {
    assert.equal(trame.charge.verdict, 'MENTEUR');
    assert.equal(trame.charge.liquidation_differee, true);
    assert.deepEqual(Object.keys(trame.charge).sort(), [
      'accusation_id',
      'liquidation_differee',
      'verdict',
    ]);
  }
  assert.equal(table.manche().accusations[0]?.ampleur_mensonge, 3);
});

test('CA-22 : à l’exécution, 6 pièces passent de l’accusé à l’accusateur', () => {
  const table = tableAvecAccusationJuste();
  const soldeAccuseAvant = table.solde('J0');
  const soldeAccusateurAvant = table.solde('J1');

  table.allerA('EXECUTION');
  const manche = table.manche(1);

  // Récompense : total payé 22 >= objectif 18 ; parts au prorata des DÉCLARÉS.
  const partAccuse = manche.parts.find((part) => part.joueur_id === 'J0');
  assert.equal(partAccuse?.part, 0, 'le démasqué perd sa part (RG-15)');
  assert.equal(partAccuse?.exclu_du_partage, true);

  const amende = manche.accusations[0];
  assert.equal(amende?.montant_amende_du, 6, '2 × ampleur 3');
  assert.equal(amende?.montant_amende_liquide, 6);

  const partAccusateur = manche.parts.find((part) => part.joueur_id === 'J1')?.part ?? 0;
  assert.equal(table.solde('J0'), soldeAccuseAvant - 6);
  assert.equal(table.solde('J1'), soldeAccusateurAvant + partAccusateur + 6);
});

test('CA-22 : le montant d’amende n’est publié qu’à l’étape 16, jamais avant', () => {
  const table = tableAvecAccusationJuste();
  const avantExecution = JSON.stringify(table.trames);
  assert.ok(!avantExecution.includes('montant_liquide'));

  table.allerA('EXECUTION');
  const execution = table.trames.filter((trame) => trame.type === 'execution_resultat');
  assert.equal(execution.length, 6);
  const amendes = execution[0]?.charge.amendes_liquidees as { montant_liquide: number }[];
  assert.equal(amendes[0]?.montant_liquide, 6);
});

test('CA-22 : s’accuser soi-même est refusé (RG-19)', () => {
  const table = tableAvecAccusationJuste();
  const resultat = table.cmd('J2', 'accuser', { accuse_joueur_id: 'J2' });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'CIBLE_INVALIDE');
});
