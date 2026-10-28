// CA-31 — US-11. Étant donné une manche avec clause PRIME_AU_DELATEUR et une
// accusation juste d'ampleur 3, quand l'exécution se déroule, alors l'amende
// liquidée vaut 12 (2 × 3 × 2) et la clause n'était connue d'AUCUN joueur non
// autorisé avant l'étape 16. (RG-44)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

/** L'accusé déclare 3 et paie 0 : ampleur 3, et il conserve ses 12 pièces. */
function tableAvecPrimeAuDelateur(): Table {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('PRIME_AU_DELATEUR');
  table.declarerEtPayer([
    [3, 0], // J0 : ampleur 3, solde intact à 12
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  return table;
}

test('CA-31 : l’amende vaut 12 — multiplicateur 2 × ampleur 3 × facteur 2', () => {
  const table = tableAvecPrimeAuDelateur();
  assert.equal(table.solde('J0'), 12);

  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.facteur_amende, 2);
  const accusation = manche.accusations[0];
  assert.equal(accusation?.ampleur_mensonge, 3);
  assert.equal(accusation?.montant_amende_du, 12);
  assert.equal(accusation?.montant_amende_liquide, 12);
  assert.equal(table.solde('J0'), 0);
  assert.equal(table.solde('J1'), 24, '12 + 12');
});

test('CA-31 : la clause n’était connue d’aucun joueur non autorisé avant l’étape 16', () => {
  const table = tableAvecPrimeAuDelateur();
  const porteur = table.manche(1).porteur_clause_joueur_id;
  const autorises = new Set([
    porteur,
    ...table.etat.joueurs
      .filter((joueur) => joueur.role_secret === 'FAISEUR_CONTRATS')
      .map((joueur) => joueur.id),
  ]);

  // Avant l'exécution : la clause imposée par la fixture ne figure dans aucune
  // trame reçue par un joueur non autorisé.
  for (const trame of table.trames) {
    if (autorises.has(trame.destinataire)) continue;
    assert.ok(
      !JSON.stringify(trame.charge).includes('PRIME_AU_DELATEUR'),
      `${trame.type} révèle la clause à ${trame.destinataire} avant l’étape 16`,
    );
  }

  table.allerA('EXECUTION');
  const executions = table.trames.filter((trame) => trame.type === 'execution_resultat');
  assert.equal(executions.length, 6, 'à l’étape 16, la clause devient publique pour tous');
  assert.equal(executions[0]?.charge.clause_revelee, 'PRIME_AU_DELATEUR');
  assert.equal(executions[0]?.charge.effet_clause, 'EFFET_PRIME_AU_DELATEUR');
});

test('CA-31 : la clause double AUSSI la pénalité de fausse accusation (RG-44)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('PRIME_AU_DELATEUR');
  table.declarerEtPayer([
    [3, 3], // J0 : honnête
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J1', 'accuser', { accuse_joueur_id: 'J0' });
  table.allerA('EXECUTION');

  const accusation = table.manche(1).accusations[0];
  assert.equal(accusation?.verdict, 'HONNETE');
  assert.equal(accusation?.montant_amende_du, 4, 'cout_fausse_accusation 2 × facteur 2');
  assert.equal(accusation?.montant_amende_liquide, 4);
});
