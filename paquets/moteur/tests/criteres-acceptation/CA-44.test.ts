// CA-44 — US-16. Étant donné un client MODIFIÉ, quand il envoie une commande en
// se réclamant d'un AUTRE joueur_id que celui de son jeton, alors la commande
// est rejetée.
//
// « Aucune commande ne porte l'identifiant de son auteur : il est DÉDUIT de la
//   connexion authentifiée. Si une charge contient malgré tout un champ qui
//   prétend désigner un autre joueur comme auteur, la commande est rejetée avec
//   USURPATION_IDENTITE. » (API / x-temps-reel.authentification)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CHAMPS_DESIGNANT_UN_AUTEUR, pretendDesignerUnAuteur } from '@gdv/partage';

import { tableEnDeclaration } from '../aide/table.ts';

test('CA-44 : une charge qui prétend désigner un autre auteur est rejetée', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  const avant = table.etat;

  const resultat = table.cmd('J0', 'declarer_contribution', {
    montant: 3,
    joueur_id: 'J1',
  });
  assert.equal(resultat.ok, false);
  assert.equal(
    (resultat as { erreur: { code: string } }).erreur.code,
    'USURPATION_IDENTITE',
  );
  assert.equal(table.etat, avant, 'aucune modification d’état');
});

test('CA-44 : TOUS les champs désignant un auteur sont surveillés', () => {
  for (const champ of CHAMPS_DESIGNANT_UN_AUTEUR) {
    const table = tableEnDeclaration({ joueurs: 6 });
    const resultat = table.cmd('J0', 'declarer_contribution', {
      montant: 3,
      [champ]: 'J1',
    });
    assert.equal(
      (resultat as { erreur: { code: string } }).erreur.code,
      'USURPATION_IDENTITE',
      `le champ ${champ} doit déclencher USURPATION_IDENTITE`,
    );
  }
});

test('CA-44 : un champ qui désigne l’auteur LUI-MÊME n’est pas une usurpation', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(pretendDesignerUnAuteur({ joueur_id: 'J0' }, 'J0'), false);
  assert.equal(pretendDesignerUnAuteur({ joueur_id: 'J1' }, 'J0'), true);
  assert.equal(pretendDesignerUnAuteur({}, 'J0'), false);
  // Le moteur l'accepte, et c'est cohérent : la charge ne mentirait sur rien.
  assert.equal(
    table.cmd('J0', 'declarer_contribution', { montant: 3, joueur_id: 'J0' }).ok,
    true,
  );
});

test('CA-44 : les champs de CIBLE ne sont pas des champs d’auteur', () => {
  // Désigner sa cible est l'objet même de ces commandes : ni cible_joueur_id,
  // ni accuse_joueur_id, ni emprunteur_joueur_id ne sont surveillés.
  for (const champ of ['cible_joueur_id', 'accuse_joueur_id', 'emprunteur_joueur_id']) {
    assert.ok(
      !CHAMPS_DESIGNANT_UN_AUTEUR.includes(champ),
      `${champ} ne doit pas être traité comme un champ d’auteur`,
    );
  }
});

// ANO-09 : ce refus ne s'appelle PLUS une usurpation, et c'est voulu.
// USURPATION_IDENTITE sur repondre_pret distinguait « ce prêt existe mais n'est
// pas pour vous » de « ce prêt n'existe pas » (CIBLE_INVALIDE) : c'était un
// oracle d'existence sur les identifiants de prêt. Les quatre causes de refus
// rendent désormais PRET_INDISPONIBLE et le même message. Le FOND de CA-44 est
// intact — un tiers ne peut pas répondre au prêt d'un autre — et c'est lui qui
// est vérifié ici, par le refus ET par l'absence d'effet sur le prêt.
test('CA-44 : répondre à un prêt qui ne lui est pas adressé est refusé, sans dire pourquoi', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerRole('J0', 'PRETEUR');
  table.allerA('EXECUTION');
  table.expirer();
  table.allerA('NEGOCIATION');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 2 });
  const pretId = table.etat.prets[0]?.id ?? '';

  const resultat = table.cmd('J3', 'repondre_pret', { pret_id: pretId, accepte: true });
  assert.equal(
    (resultat as { erreur: { code: string } }).erreur.code,
    'PRET_INDISPONIBLE',
  );
  assert.equal(table.etat.prets[0]?.statut, 'PROPOSE', 'le tiers n’a rien pu changer');
});
