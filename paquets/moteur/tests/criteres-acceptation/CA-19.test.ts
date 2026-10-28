// CA-19 — US-09. Étant donné un joueur sans rôle Inspecteur disposant de
// 2 pièces, quand il enquête sur une cible, alors son solde passe à 0, il reçoit
// le montant RÉELLEMENT payé par la cible, et la cible ne reçoit AUCUN message.
// (RG-26, RG-27)

import test from 'node:test';
import assert from 'node:assert/strict';

import { tableEnDeclaration, type Table } from '../aide/table.ts';

/** Enquêteur à exactement 2 pièces : il a déclaré 10 et payé 10. */
function tableAvecEnqueteurA2Pieces(): Table {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerRole('J0', 'MARCHAND_EPICES'); // n'est PAS inspecteur
  table.declarerEtPayer([
    [10, 10],
    [5, 2],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  return table;
}

test('CA-19 : l’enquête coûte 2, le solde tombe à 0, le résultat est le paiement réel', () => {
  const table = tableAvecEnqueteurA2Pieces();
  assert.equal(table.solde('J0'), 2);

  const avant = table.trames.length;
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });

  assert.equal(table.solde('J0'), 0);
  const resultats = table.tramesDe('J0', 'resultat_enquete');
  assert.equal(resultats.length, 1);
  assert.equal(resultats[0]?.charge.cible_joueur_id, 'J1');
  assert.equal(resultats[0]?.charge.montant_paye, 2, 'J1 a réellement payé 2');
  assert.equal(resultats[0]?.charge.montant_declare, 5);
  assert.equal(resultats[0]?.charge.cout_paye, 2);

  // Aucune trame n'est partie vers la cible ni vers la table.
  const nouvelles = table.trames.slice(avant);
  for (const trame of nouvelles) {
    assert.equal(
      trame.destinataire,
      'J0',
      `une trame ${trame.type} est partie vers ${trame.destinataire}`,
    );
  }
});

test('CA-19 : la cible n’apprend JAMAIS qu’elle a été enquêtée, même à la clôture', () => {
  const table = tableAvecEnqueteurA2Pieces();
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  table.allerA('EXECUTION');
  table.expirer();

  // La cible ne reçoit aucune trame de résultat, et aucune trame reçue par elle
  // ne porte un champ de l'entité enquetes.
  assert.equal(table.tramesDe('J1', 'resultat_enquete').length, 0);
  const INTERDITS = [
    'cout_paye',
    'resultat_montant_paye',
    'enqueteur_joueur_id',
    'mes_enquetes_de_la_manche',
  ];
  for (const trame of table.tramesDe('J1')) {
    for (const interdit of INTERDITS) {
      assert.ok(
        !Object.keys(trame.charge).includes(interdit),
        `${trame.type} porte ${interdit} vers la cible`,
      );
    }
  }
  // La chaîne « lancer_enquete » apparaît légitimement dans
  // EvtPhaseChangee.actions_autorisees : c'est la liste PUBLIQUE des commandes
  // ouvertes dans la phase, identique pour tous, et elle ne dit rien de ce qui
  // a été fait. Un balayage de sous-chaîne confondrait les deux.
  const phases = table.tramesDe('J1', 'phase_changee');
  assert.ok(phases.length > 0);
});

test('CA-19 : une seconde enquête sur la MÊME cible dans la manche est refusée (RG-28)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [0, 0],
    [5, 2],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  const resultat = table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'QUOTA_DEPASSE');
});

test('CA-19 : enquêter sur soi-même est refusé (RG-19)', () => {
  const table = tableAvecEnqueteurA2Pieces();
  const resultat = table.cmd('J1', 'lancer_enquete', { cible_joueur_id: 'J1' });
  assert.equal((resultat as { erreur: { code: string } }).erreur.code, 'CIBLE_INVALIDE');
});

test('CA-19 : le nombre d’enquêtes par manche n’est pas plafonné (RG-28)', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  // Rôle imposé : sans cela, le coût dépend du rôle TIRÉ, et le solde attendu
  // en fin de test dépendrait de la graine.
  table.imposerRole('J0', 'MARCHAND_EPICES');
  table.declarerEtPayer([
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  // 12 pièces, 2 par enquête, 5 cibles distinctes : les 5 passent.
  for (const cible of ['J1', 'J2', 'J3', 'J4', 'J5']) {
    assert.equal(table.cmd('J0', 'lancer_enquete', { cible_joueur_id: cible }).ok, true);
  }
  assert.equal(table.solde('J0'), 2);
  assert.equal(table.manche().enquetes.length, 5);
});
