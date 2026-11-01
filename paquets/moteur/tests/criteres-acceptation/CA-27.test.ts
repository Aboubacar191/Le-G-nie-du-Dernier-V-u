// CA-27 — US-11. Étant donné un total payé de 17 pour un objectif de 18, quand
// l'exécution se déroule, alors le vœu ÉCHOUE, AUCUNE part n'est versée, et si
// la clause CONSOLATION est active chaque joueur récupère plancher(son
// paiement / 2).
//
// RG-74 : les montants de consolation, individuellement et en total, ne sont
// jamais publiés. Seule l'activation de la clause sort sur l'événement public.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration } from '../aide/table.ts';

const PAIEMENTS: readonly (readonly [number, number])[] = [
  [5, 5],
  [4, 4],
  [3, 3],
  [3, 3],
  [2, 1],
  [2, 1],
];

test('CA-27 : le vœu échoue à 17 pour 18, et aucune part n’est versée', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('GENIE_GARDE_UN_TIERS'); // sans effet en cas d'échec
  table.declarerEtPayer(PAIEMENTS);
  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.total_paye, 17);
  assert.equal(manche.objectif, 18);
  assert.equal(manche.reussi, false);
  assert.deepEqual(manche.parts, [], 'aucune part versée');
  assert.equal(manche.recompense, 0);
  assert.equal(manche.consolation_appliquee, false);
});

test('CA-27 : avec CONSOLATION, chacun récupère plancher(son paiement / 2)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer(PAIEMENTS);
  const soldesAvantExecution = table.joueurs.map((joueur) => table.solde(joueur));

  table.allerA('EXECUTION');

  const manche = table.manche(1);
  assert.equal(manche.reussi, false);
  assert.equal(manche.consolation_appliquee, true);
  // plancher(5/2)+plancher(4/2)+plancher(3/2)×2+plancher(1/2)×2 = 2+2+1+1+0+0 = 6
  assert.equal(manche.total_consolation, 6);

  const attendus = [2, 2, 1, 1, 0, 0];
  table.joueurs.forEach((joueur, index) => {
    assert.equal(
      table.solde(joueur),
      (soldesAvantExecution[index] ?? 0) + (attendus[index] ?? 0),
      `consolation de ${joueur}`,
    );
  });
});

test('CA-27 : le montant de consolation INDIVIDUEL n’est jamais publié (RG-74)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer(PAIEMENTS);
  table.allerA('EXECUTION');

  const executions = table.trames.filter((trame) => trame.type === 'execution_resultat');
  assert.equal(executions.length, 6);
  for (const trame of executions) {
    assert.equal(trame.charge.consolation_appliquee, true);
    const cles = Object.keys(trame.charge);
    assert.ok(!cles.includes('total_consolation'));
    assert.ok(!cles.includes('parts'));
    assert.ok(!cles.includes('montant_consolation'));
    assert.ok(!cles.includes('consolation_individuelle'));
  }
});

test('CA-27 : chacun apprend sa consolation par son canal PRIVÉ de solde', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('CONSOLATION');
  table.declarerEtPayer(PAIEMENTS);
  table.allerA('EXECUTION');

  // RUP-02 : le lot part aux six, charge neutre {} pour qui n'a rien reçu. La
  // consolation s'apprend donc dans la dernière charge PLEINE, et nulle part
  // ailleurs — c'est le canal privé que RG-74 désigne comme le seul licite.
  const soldes = table.tramesPleinesDe('J0', 'solde_mis_a_jour');
  assert.ok(soldes.length >= 1);
  const derniere = soldes[soldes.length - 1];
  const mouvements = (derniere?.charge.derniers_mouvements as { elements: { motif: string }[] })
    .elements;
  assert.ok(mouvements.some((mouvement) => mouvement.motif === 'consolation'));
});
