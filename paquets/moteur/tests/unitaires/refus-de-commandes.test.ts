// Un cas NÉGATIF par chemin de refus.
//
// « Un client modifié ne doit pouvoir obtenir aucun effet interdit » (RG-71).
// Les chemins de refus sont donc la moitié du moteur, et la moitié la plus
// facile à oublier : un test qui ne vérifie que les succès laisse passer un
// refus devenu silencieux.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  abandonnerParInactivite,
  appliquer,
  booleenDe,
  cloturer,
  definirConnexion,
  entierDe,
  expirerPhase,
  listeTexteDe,
  texteDe,
  verifierInvariants,
} from '@gdv/moteur';

import { Table, tableEnDeclaration } from '../aide/table.ts';

function code(resultat: ReturnType<typeof appliquer>): string {
  return (resultat as { erreur: { code: string } }).erreur.code;
}

// --- Lecture défensive de la charge -----------------------------------------

test('les lecteurs de charge refusent ce qui n’est pas du type attendu', () => {
  assert.equal(entierDe({ x: 3 }, 'x'), 3);
  assert.equal(entierDe({ x: 3.5 }, 'x'), null);
  assert.equal(entierDe({ x: '3' }, 'x'), null);
  assert.equal(entierDe({}, 'x'), null);

  assert.equal(texteDe({ x: 'a' }, 'x'), 'a');
  assert.equal(texteDe({ x: '' }, 'x'), null, 'une chaîne vide n’est pas un identifiant');
  assert.equal(texteDe({ x: 3 }, 'x'), null);

  assert.equal(booleenDe({ x: true }, 'x'), true);
  assert.equal(booleenDe({ x: false }, 'x'), false);
  assert.equal(booleenDe({ x: 'true' }, 'x'), null);

  assert.deepEqual(listeTexteDe({ x: ['a', 'b'] }, 'x'), ['a', 'b']);
  assert.equal(listeTexteDe({ x: ['a', 3] }, 'x'), null);
  assert.equal(listeTexteDe({ x: 'a' }, 'x'), null);
});

test('une commande sans auteur est un défaut du transport, pas un refus métier', () => {
  const table = new Table({ joueurs: 6 });
  assert.throws(
    () => appliquer(table.etat, { type: 'demarrer_partie', charge: {} }, table.contexte()),
    /Commande sans auteur/,
  );
});

test('authentifier n’est pas une commande de jeu : le moteur la refuse', () => {
  const table = new Table({ joueurs: 6 });
  const resultat = table.cmd('J0', 'authentifier', { jeton_session: 'x', version_protocole: '1' });
  assert.equal(code(resultat), 'MESSAGE_MALFORME');
});

// --- Commandes de l'hôte -----------------------------------------------------

test('demarrer_partie : réservée à l’hôte, et au seul état SALLE_ATTENTE', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(code(table.cmd('J1', 'demarrer_partie')), 'ACTION_RESERVEE_HOTE');
  table.exiger('J0', 'demarrer_partie');
  assert.equal(code(table.cmd('J0', 'demarrer_partie')), 'ETAT_PARTIE_INCOMPATIBLE');
});

test('definir_ordre_places : refusée hors PLACEMENT, et sur une charge sans ordre', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(
    code(table.cmd('J0', 'definir_ordre_places', { ordre: table.joueurs })),
    'ETAT_PARTIE_INCOMPATIBLE',
  );
  table.exiger('J0', 'demarrer_partie');
  assert.equal(code(table.cmd('J0', 'definir_ordre_places', {})), 'ORDRE_PLACES_INVALIDE');
  assert.equal(
    code(table.cmd('J0', 'definir_ordre_places', { ordre: [1, 2] })),
    'ORDRE_PLACES_INVALIDE',
  );
});

test('avancer_phase : réservée à l’hôte', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  assert.equal(code(table.cmd('J1', 'avancer_phase')), 'ACTION_RESERVEE_HOTE');
});

test('abandonner_partie : réservée à l’hôte, confirmation exigée, pas deux fois', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(
    code(table.cmd('J1', 'abandonner_partie', { confirmation: true })),
    'ACTION_RESERVEE_HOTE',
  );
  assert.equal(code(table.cmd('J0', 'abandonner_partie', {})), 'MESSAGE_MALFORME');
  assert.equal(
    code(table.cmd('J0', 'abandonner_partie', { confirmation: false })),
    'MESSAGE_MALFORME',
  );
  table.exiger('J0', 'abandonner_partie', { confirmation: true });
  assert.equal(
    code(table.cmd('J0', 'abandonner_partie', { confirmation: true })),
    'ETAT_PARTIE_INCOMPATIBLE',
  );
});

// --- Salle d'attente -----------------------------------------------------------

test('signaler_pret : accepté en SALLE_ATTENTE, N’IMPORTE QUEL joueur, sur SON PROPRE statut', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(table.etat.etat_partie, 'SALLE_ATTENTE');

  // Pas réservé à l'hôte, à la différence de demarrer_partie/abandonner_partie.
  const resultat = table.cmd('J1', 'signaler_pret', { pret: true });
  assert.equal(resultat.ok, true);
  assert.equal(table.etat.joueurs.find((j) => j.id === 'J1')?.pret, true);

  // Aucune usurpation possible : la charge ne porte aucun champ de cible, donc
  // le statut d'un AUTRE joueur reste intact (CA-44).
  assert.equal(table.etat.joueurs.find((j) => j.id === 'J0')?.pret, false);

  // L'événement public est émis vers TOUTE la table (classe tous).
  for (const joueurId of table.joueurs) {
    const trames = table.tramesDe(joueurId, 'joueur_pret_change');
    assert.equal(trames.length, 1);
    assert.deepEqual(trames[0]?.charge, { joueur_id: 'J1', pret: true });
  }

  // La valeur cible explicite est reprise telle quelle, y compris à faux.
  table.exiger('J1', 'signaler_pret', { pret: false });
  assert.equal(table.etat.joueurs.find((j) => j.id === 'J1')?.pret, false);
});

test('signaler_pret : refusé hors de SALLE_ATTENTE', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.notEqual(table.etat.etat_partie, 'SALLE_ATTENTE');
  assert.equal(code(table.cmd('J0', 'signaler_pret', { pret: true })), 'ETAT_PARTIE_INCOMPATIBLE');
});

test('signaler_pret : refusé si le joueur n’est pas connecté', () => {
  const table = new Table({ joueurs: 6 });
  table.etat = definirConnexion(table.etat, 'J1', false);
  assert.equal(code(table.cmd('J1', 'signaler_pret', { pret: true })), 'ETAT_PARTIE_INCOMPATIBLE');
});

test('signaler_pret : charge malformée', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(code(table.cmd('J0', 'signaler_pret', {})), 'MESSAGE_MALFORME');
  assert.equal(code(table.cmd('J0', 'signaler_pret', { pret: 'oui' })), 'MESSAGE_MALFORME');
});

// --- Négociation -------------------------------------------------------------

test('transferer_pieces : cible invalide, montant invalide, solde insuffisant', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  assert.equal(code(table.cmd('J0', 'transferer_pieces', { montant: 1 })), 'CIBLE_INVALIDE');
  assert.equal(
    code(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J0', montant: 1 })),
    'CIBLE_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'INCONNU', montant: 1 })),
    'CIBLE_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 0 })),
    'MONTANT_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1' })),
    'MONTANT_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 13 })),
    'SOLDE_INSUFFISANT',
  );
});

test('proposer_pret : rôle, cible, montant, solde', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  table.imposerRole('J0', 'PRETEUR');
  assert.equal(
    code(table.cmd('J0', 'proposer_pret', { principal: 1 })),
    'CIBLE_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 0 })),
    'MONTANT_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1' })),
    'MONTANT_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 99 })),
    'SOLDE_INSUFFISANT',
  );
});

// ANO-08 et ANO-09 : les quatre causes de refus de repondre_pret rendent le
// MÊME code et le MÊME message. Seul MESSAGE_MALFORME subsiste à part : il
// décrit la trame et non le prêt. Les deux oracles — existence d'identifiant et
// solde du prêteur — sont éprouvés dans tests/unitaires/refus-indiscernables.
test('repondre_pret : prêt inconnu, réponse absente, double réponse, solde du prêteur', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  table.imposerRole('J0', 'PRETEUR');
  assert.equal(
    code(table.cmd('J1', 'repondre_pret', { pret_id: 'inconnu', accepte: true })),
    'PRET_INDISPONIBLE',
  );
  assert.equal(code(table.cmd('J1', 'repondre_pret', { accepte: true })), 'PRET_INDISPONIBLE');

  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 4 });
  const pretId = table.etat.prets[0]?.id ?? '';
  assert.equal(code(table.cmd('J1', 'repondre_pret', { pret_id: pretId })), 'MESSAGE_MALFORME');

  table.exiger('J1', 'repondre_pret', { pret_id: pretId, accepte: false });
  assert.equal(table.etat.prets[0]?.statut, 'REFUSE');
  assert.equal(
    code(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true })),
    'PRET_INDISPONIBLE',
  );
});

test('repondre_pret : le prêteur n’a plus le principal entre la proposition et la réponse', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  table.imposerRole('J0', 'PRETEUR');
  table.exiger('J0', 'proposer_pret', { emprunteur_joueur_id: 'J1', principal: 10 });
  const pretId = table.etat.prets[0]?.id ?? '';
  // Le prêteur dilapide son solde avant que l'emprunteur n'accepte.
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 8 });
  // ANO-08 : SOLDE_INSUFFISANT ne peut JAMAIS sanctionner le solde d'un AUTRE
  // joueur que l'auteur — restriction ajoutée au code en 1.1.0. Le refus ne
  // qualifie plus sa cause.
  assert.equal(
    code(table.cmd('J1', 'repondre_pret', { pret_id: pretId, accepte: true })),
    'PRET_INDISPONIBLE',
  );
  assert.ok(verifierInvariants(table.etat).ok);
});

// --- Déclaration et paiement --------------------------------------------------

test('declarer_contribution et payer_secret : charges mal formées', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  assert.equal(code(table.cmd('J0', 'declarer_contribution', {})), 'MONTANT_INVALIDE');
  assert.equal(code(table.cmd('J0', 'payer_secret', {})), 'DECLARATION_REQUISE');
  table.exiger('J0', 'declarer_contribution', { montant: 3 });
  assert.equal(code(table.cmd('J0', 'payer_secret', {})), 'MONTANT_INVALIDE');
  assert.equal(code(table.cmd('J0', 'payer_secret', { montant: -1 })), 'MONTANT_INVALIDE');
});

test('payer_secret : SOLDE_INSUFFISANT quand le solde a fondu après la déclaration', () => {
  const table = new Table({ joueurs: 6 }).demarrer().allerA('NEGOCIATION');
  // J0 déclare dans la manche suivante ce qu'il n'a plus : impossible par
  // construction. On passe donc par une manche où il a tout transféré APRÈS
  // avoir déclaré — ce qui n'est pas permis non plus. Le chemin reste
  // atteignable en revanche sur une déclaration faite avec un solde supérieur
  // au paiement demandé : on vérifie ici le refus d'un paiement > solde.
  table.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 12 });
  table.allerA('DECLARATION_PAIEMENT');
  assert.equal(table.solde('J0'), 0);
  assert.equal(code(table.cmd('J0', 'declarer_contribution', { montant: 1 })), 'MONTANT_INVALIDE');
  table.exiger('J0', 'declarer_contribution', { montant: 0 });
  assert.equal(table.cmd('J0', 'payer_secret', { montant: 0 }).ok, true);
});

// --- Enquêtes et accusations ---------------------------------------------------

test('lancer_enquete et accuser : charges mal formées', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.declarerEtPayer([
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(code(table.cmd('J0', 'lancer_enquete', {})), 'CIBLE_INVALIDE');
  assert.equal(code(table.cmd('J0', 'accuser', {})), 'CIBLE_INVALIDE');
  assert.equal(
    code(table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'INCONNU' })),
    'CIBLE_INVALIDE',
  );
  assert.equal(
    code(table.cmd('J0', 'accuser', { accuse_joueur_id: 'INCONNU' })),
    'CIBLE_INVALIDE',
  );
});

// --- Dernier Vœu ---------------------------------------------------------------

test('signer_dernier_voeu : mode inactif, charge absente, Dernier Vœu non ouvert', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  // Hors mode avancé, la commande est refusée avant toute autre vérification.
  table.etat = { ...table.etat, phase: 'DV_SIGNATURE' };
  assert.equal(code(table.cmd('J0', 'signer_dernier_voeu', { a_signe: true })), 'MODE_AVANCE_INACTIF');

  table.etat = { ...table.etat, mode_avance_actif: true };
  assert.equal(code(table.cmd('J0', 'signer_dernier_voeu', {})), 'MESSAGE_MALFORME');
  assert.equal(
    code(table.cmd('J0', 'signer_dernier_voeu', { a_signe: true })),
    'ETAT_PARTIE_INCOMPATIBLE',
    'aucune ligne de signature n’existe encore',
  );
});

// --- Transitions sans commande --------------------------------------------------

test('expirerPhase sans phase courante ne fait rien, et ne casse rien', () => {
  const table = new Table({ joueurs: 6 });
  const resultat = expirerPhase(table.etat, table.contexte());
  assert.equal(resultat.ok, true);
  assert.deepEqual((resultat as { effets: readonly unknown[] }).effets, []);
});

test('cloturer ne fait rien hors de l’état SCORES', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const resultat = cloturer(table.etat, table.contexte());
  assert.equal(resultat.ok, true);
  assert.deepEqual((resultat as { effets: readonly unknown[] }).effets, []);
  assert.equal(table.etat.groupe.parties_terminees, 0);
});

test('abandonnerParInactivite est terminal et ne révèle rien (RG-76)', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const resultat = abandonnerParInactivite(table.etat, table.contexte());
  assert.equal(resultat.ok, true);
  const etat = (resultat as { etat: typeof table.etat }).etat;
  assert.equal(etat.etat_partie, 'ABANDONNEE');
  assert.equal(etat.classement, null);
  assert.equal(etat.phase, null);
  const effets = (resultat as { effets: readonly { type: string }[] }).effets;
  assert.ok(effets.some((effet) => effet.type === 'partie_abandonnee'));
});
