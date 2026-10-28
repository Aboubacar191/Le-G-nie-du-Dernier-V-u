// CA-40 — US-15. Étant donné une partie de 5 manches terminée HORS mode avancé,
// quand l'écran de scores s'affiche, alors chaque score vaut pièces restantes
// + 10 si la mission est réussie, les conditions de mission sont évaluées selon
// catalogue_missions, et tous les secrets de la partie sont publiés. (RG-55,
// RG-58)
//
// « Tous les secrets » est la liste EXHAUSTIVE ET FERMÉE de RG-58 : rôles,
// missions et leur réussite, paiements réels de chaque manche, signataires du
// Dernier Vœu. DEUX SECRETS NE SORTENT JAMAIS, pas même ici : l'identité du
// porteur de chaque clause, et l'existence des enquêtes.

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from '../aide/table.ts';

function partieTerminee(): Table {
  const table = new Table({ joueurs: 6, graine: 'ca-40' }).demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('DECLARATION_PAIEMENT');
    table.joueurs.forEach((joueur, index) => {
      // La déclaration est bornée par le solde (RG-08) : au fil des manches
      // perdues, les bourses se vident et le scénario doit en tenir compte.
      const declare = Math.min(3, table.solde(joueur));
      table.exiger(joueur, 'declarer_contribution', { montant: declare });
      table.exiger(joueur, 'payer_secret', { montant: index === 0 ? 0 : declare });
    });
    table.allerA('ENQUETES_ACCUSATIONS');
    table.cmd('J1', 'lancer_enquete', { cible_joueur_id: 'J0' });
    table.allerA('EXECUTION');
    table.expirer();
  }
  return table;
}

test('CA-40 : la partie se termine en TERMINEE, avec un classement calculé', () => {
  const table = partieTerminee();
  assert.equal(table.etat.etat_partie, 'TERMINEE');
  assert.equal(table.etat.classement?.length, 6);
  assert.equal(table.etat.groupe.parties_terminees, 1, 'incrémenté au passage en TERMINEE');
});

test('CA-40 : score = pièces restantes + 10 si la mission est réussie', () => {
  const table = partieTerminee();
  for (const ligne of table.etat.classement ?? []) {
    const joueur = table.etat.joueurs.find((candidat) => candidat.id === ligne.joueur_id);
    const bonus = ligne.mission_reussie ? 10 : 0;
    assert.equal(ligne.score_final, ligne.pieces_restantes + bonus, `score de ${ligne.joueur_id}`);
    assert.equal(joueur?.score_final, ligne.score_final);
    assert.equal(joueur?.mission_reussie, ligne.mission_reussie);
  }
});

test('CA-40 : le bonus de mission est LU dans la configuration (RG-60)', () => {
  const table = new Table({ joueurs: 6, graine: 'ca-40b', config: { bonus_mission_reussie: 40 } })
    .demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  for (const ligne of table.etat.classement ?? []) {
    const bonus = ligne.mission_reussie ? 40 : 0;
    assert.equal(ligne.score_final, ligne.pieces_restantes + bonus);
  }
});

test('CA-40 : les scores publient rôles, missions, réussites et paiements réels', () => {
  const table = partieTerminee();
  const scores = table.trames.filter((trame) => trame.type === 'scores_finaux');
  assert.equal(scores.length, 6, 'publié à toute la table');

  const charge = scores[0]?.charge as {
    classement: {
      joueur_id: string;
      role_secret: string;
      mission_secrete: string | null;
      mission_reussie: boolean;
      pieces_restantes: number;
      score_final: number;
      rang: number;
    }[];
    paiements_historiques: { numero_manche: number; joueur_id: string; montant_paye: number }[];
    vainqueurs: string[];
    genie_libere: boolean;
  };

  assert.equal(charge.classement.length, 6);
  for (const ligne of charge.classement) {
    assert.ok(ligne.role_secret.length > 0, 'le rôle est enfin public');
    assert.equal(typeof ligne.mission_reussie, 'boolean');
    assert.ok(ligne.rang >= 1);
  }
  assert.equal(charge.paiements_historiques.length, 30, '5 manches × 6 joueurs');
  const paiementJ0Manche1 = charge.paiements_historiques.find(
    (ligne) => ligne.joueur_id === 'J0' && ligne.numero_manche === 1,
  );
  assert.equal(paiementJ0Manche1?.montant_paye, 0, 'le paiement réel est enfin public');
  assert.equal(charge.genie_libere, false, 'hors mode avancé, le génie n’est pas libéré');
  assert.ok(charge.vainqueurs.length >= 1);
});

test('CA-40 : les DEUX secrets permanents ne sortent pas, même aux scores (RG-58)', () => {
  const table = partieTerminee();
  const scores = table.trames.filter((trame) => trame.type === 'scores_finaux');
  for (const trame of scores) {
    const serialise = JSON.stringify(trame.charge);
    assert.ok(!serialise.includes('porteur'), 'l’identité du porteur de clause ne sort jamais');
    assert.ok(!serialise.includes('enquet'), 'l’existence des enquêtes ne sort jamais');
    assert.ok(!serialise.includes('ampleur'), 'l’ampleur du mensonge n’est jamais un champ (RG-75)');
  }
});
