// CA-33 — US-12. Étant donné un joueur SANS le rôle Prêteur, quand il tente
// d'émettre un prêt à intérêts, alors l'action est refusée. (RG-29)
//
// Le refus ne révèle JAMAIS pourquoi la commande est interdite à un autre
// joueur : ACTION_NON_AUTORISEE_ROLE ne nomme aucun rôle, car le rôle est
// secret.

import test from 'node:test';
import assert from 'node:assert/strict';

import { estChargePleine, Table } from '../aide/table.ts';

function enNegociation(): Table {
  return new Table({ joueurs: 6, graine: 'ca-33' }).demarrer().allerA('NEGOCIATION');
}

test('CA-33 : un non-Prêteur ne peut pas émettre de prêt', () => {
  const table = enNegociation();
  table.imposerRole('J0', 'MARCHAND_EPICES');

  const resultat = table.cmd('J0', 'proposer_pret', {
    emprunteur_joueur_id: 'J1',
    principal: 4,
  });
  assert.equal(resultat.ok, false);
  assert.equal(
    (resultat as { erreur: { code: string } }).erreur.code,
    'ACTION_NON_AUTORISEE_ROLE',
  );
  assert.equal(table.etat.prets.length, 0);
});

test('CA-33 : le message de refus ne nomme AUCUN rôle', () => {
  const table = enNegociation();
  table.imposerRole('J0', 'MARCHAND_EPICES');
  const resultat = table.cmd('J0', 'proposer_pret', {
    emprunteur_joueur_id: 'J1',
    principal: 4,
  });
  const erreur = (resultat as { erreur: { message: string } }).erreur;
  for (const role of ['PRETEUR', 'INSPECTEUR_TRESOR', 'FAISEUR_CONTRATS', 'MARCHAND_EPICES']) {
    assert.ok(!erreur.message.includes(role), `le refus nomme le rôle ${role}`);
  }
});

test('CA-33 : le Prêteur, lui, peut émettre un prêt', () => {
  const table = enNegociation();
  table.imposerRole('J0', 'PRETEUR');
  assert.equal(
    table.cmd('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 }).ok,
    true,
  );
  assert.equal(table.etat.prets.length, 1);
  assert.equal(table.etat.prets[0]?.statut, 'PROPOSE');
  assert.equal(table.etat.prets[0]?.du_total, 6, 'plafond(4 × 3/2)');
});

test('CA-33 : le prêt n’est visible que du prêteur et de l’emprunteur', () => {
  const table = enNegociation();
  table.imposerRole('J0', 'PRETEUR');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });

  // RUP-02 / RG-80 : la trame part aux SIX. Sa seule présence disait « un prêt
  // existe », donc que l'un des deux détient le rôle PRETEUR, qui est secret —
  // et le dénombrement suffisait à le lire. Ce qui reste restreint aux deux
  // parties, c'est la charge PLEINE.
  const proposes = table.trames.filter((trame) => trame.type === 'pret_propose');
  assert.deepEqual(
    [...new Set(proposes.map((trame) => trame.destinataire))].sort(),
    [...table.joueurs].sort(),
  );
  assert.deepEqual(
    [...new Set(proposes.filter(estChargePleine).map((trame) => trame.destinataire))].sort(),
    ['J0', 'J1'],
  );
  for (const trame of proposes.filter((candidate) => !estChargePleine(candidate))) {
    assert.deepEqual(Object.keys(trame.charge), [], 'la charge neutre de EvtPretPropose est {}');
  }
});

test('CA-33 : un prêt proposé à un autre ne peut pas être accepté par un tiers (CA-44)', () => {
  const table = enNegociation();
  table.imposerRole('J0', 'PRETEUR');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
  const pretId = table.etat.prets[0]?.id ?? '';

  const resultat = table.cmd('J2', 'repondre_pret', { pret_id: pretId, accepte: true });
  assert.equal(
    (resultat as { erreur: { code: string } }).erreur.code,
    'USURPATION_IDENTITE',
  );
});
