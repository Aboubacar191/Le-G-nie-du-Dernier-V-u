// CA-23 — US-10. Étant donné un accusé ayant déclaré 3 et payé 3, quand il est
// accusé, alors le verdict HONNETE est public et à l'exécution 2 pièces passent
// de l'accusateur à l'accusé. (RG-17)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-23 : verdict HONNETE public, puis 2 pièces de l’accusateur vers l’accusé', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION'); // sans effet sur les amendes
  table.declarerEtPayer([
    [3, 3], // J0 : honnête
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });

  const resolues = table.trames.filter((trame) => trame.type === 'accusation_resolue');
  assert.equal(resolues.length, 6);
  assert.equal(resolues[0]?.charge.verdict, 'HONNETE');

  const soldeAccuseAvant = table.solde('J0');
  const soldeAccusateurAvant = table.solde('J1');
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  const penalite = manche.accusations[0];
  assert.equal(penalite?.montant_amende_du, 2, 'cout_fausse_accusation');
  assert.equal(penalite?.montant_amende_liquide, 2);

  const partAccuse = manche.parts.find((part) => part.joueur_id === 'J0')?.part ?? 0;
  const partAccusateur = manche.parts.find((part) => part.joueur_id === 'J1')?.part ?? 0;
  assert.equal(table.solde('J0'), soldeAccuseAvant + partAccuse + 2);
  assert.equal(table.solde('J1'), soldeAccusateurAvant + partAccusateur - 2);
  assert.equal(
    manche.parts.find((part) => part.joueur_id === 'J0')?.exclu_du_partage,
    false,
    'un accusé déclaré honnête garde sa part',
  );
});

test('CA-23 : la pénalité est lue dans la configuration (RG-60)', () => {
  const table = tableEnDeclaration({ joueurs: 6, config: { cout_fausse_accusation: 5 } });
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer([
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  table.allerA('EXECUTION');
  assert.equal(table.manche(1).accusations[0]?.montant_amende_liquide, 5);
});
