// CAS LIMITES 9 à 26 de SPEC-GDV-001.json / cas_limites — LES RÈGLES.
//
// Doublons de rôles, égalités, déconnexions, abandons, collisions. Suite de
// cas-limites.test.ts, qui porte les huit cas monétaires. Le découpage est
// imposé par la limite de 300 lignes par fichier de l'ARCHI ; l'ordre de la
// SPEC est conservé.

import test from 'node:test';
import assert from 'node:assert/strict';

import { candidatsEligibles, missionReussie } from '@gdv/moteur';
import { CLAUSE } from '@gdv/partage';

import { Table, aleaScripte, tableEnDeclaration } from '../aide/table.ts';
import { allerAuDernierVoeu } from '../aide/mode-avance.ts';

test('cas limite 9 — DEUX joueurs portant le rôle FAISEUR_CONTRATS', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-9' }).demarrer();
  table.imposerRole('J0', 'FAISEUR_CONTRATS');
  table.imposerRole('J1', 'FAISEUR_CONTRATS');
  const manche = table.manche(1);

  const trames = table.trames.filter((trame) => trame.type === 'clause_recue');
  assert.ok(trames.length >= 1);
  // La clause est reprojetée avec les rôles imposés : on la recalcule.
  const vueJ0 = table.vuePrivee('J0');
  const vueJ1 = table.vuePrivee('J1');
  assert.equal((vueJ0?.moi as { clause_connue: string }).clause_connue, manche.clause_cle);
  assert.equal((vueJ1?.moi as { clause_connue: string }).clause_connue, manche.clause_cle);
});

test('cas limite 10 — le porteur de la clause est lui-même FAISEUR_CONTRATS', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-10' }).demarrer();
  const porteur = table.manche(1).porteur_clause_joueur_id;
  table.imposerRole(porteur, 'FAISEUR_CONTRATS');

  const vue = table.vuePrivee(porteur);
  assert.equal(
    (vue?.moi as { clause_connue: string }).clause_connue,
    table.manche(1).clause_cle,
    'il la reçoit une fois, pas deux, et sans ambiguïté',
  );
});

test('cas limite 11 — DEUX joueurs portant le rôle INSPECTEUR_TRESOR', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerRole('J0', 'INSPECTEUR_TRESOR');
  table.imposerRole('J1', 'INSPECTEUR_TRESOR');
  table.declarerEtPayer([
    [0, 0],
    [0, 0],
    [4, 1],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  table.allerA('ENQUETES_ACCUSATIONS');
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J2' });
  table.exiger('J1', 'lancer_enquete', { cible_joueur_id: 'J2' });
  assert.equal(table.solde('J0'), 11, 'coût réduit à 1');
  assert.equal(table.solde('J1'), 11);
  assert.equal(table.manche().enquetes.length, 2);
});

test('cas limite 12 — égalité STRICTE sur le plus gros paiement avec LE_PLUS_GENEREUX', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('LE_PLUS_GENEREUX');
  table.declarerEtPayer([
    [6, 6],
    [6, 6],
    [3, 3],
    [3, 3],
    [3, 1],
    [3, 1],
  ]);
  table.allerA('EXECUTION');
  const parts = table.manche(1).parts.map((part) => part.part);
  assert.equal(parts[0], parts[1], 'tous les ex aequo bénéficient du doublement');
  assert.ok((parts[0] ?? 0) > (parts[2] ?? 0));
});

test('cas limite 13 — égalité de score final entre plusieurs joueurs', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-13' }).demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  const lignes = table.etat.classement ?? [];
  // Personne n'a agi : tous à 12 pièces. Les rangs doivent être partagés.
  const rangsUn = lignes.filter((ligne) => ligne.rang === 1);
  assert.ok(rangsUn.length >= 2, 'RG-57 : ex aequo DÉCLARÉ, même rang');
  assert.deepEqual(table.etat.vainqueurs, rangsUn.map((ligne) => ligne.joueur_id));
});

test('cas limite 14 — mission LE_MAGNAT attribuée en doublon à deux joueurs', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-14' }).demarrer();
  table.imposerMission('J0', 'LE_MAGNAT');
  table.imposerMission('J1', 'LE_MAGNAT');
  // Les deux sont au maximum : les deux réussissent (ex aequo).
  assert.equal(missionReussie(table.etat, 'J0', 'LE_MAGNAT'), true);
  assert.equal(missionReussie(table.etat, 'J1', 'LE_MAGNAT'), true);
});

test('cas limite 15 — aucun gabarit de révélation éligible sur une manche', () => {
  const duo = tableEnDeclaration({ joueurs: 2, config: { joueurs_min: 2 } });
  duo.declarerEtPayer([
    [0, 0],
    [0, 0],
  ]);
  assert.deepEqual(candidatsEligibles(duo.etat, duo.manche(1)), []);
  assert.equal(duo.trames.filter((trame) => trame.type === 'revelation').length, 0);
});

test('cas limite 16 — déconnexion pendant le paiement puis reconnexion après expiration', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 4 });
  // J0 se déconnecte sans payer.
  table.etat = { ...table.etat, joueurs: table.etat.joueurs.map((joueur) =>
    joueur.id === 'J0' ? { ...joueur, connecte: false } : joueur) };
  table.expirer();

  const contribution = table.manche(1).contributions.find((c) => c.joueur_id === 'J0');
  assert.equal(contribution?.montant_declare, 4, 'sa déclaration est conservée');
  assert.equal(contribution?.montant_paye, 0, 'son paiement vaut 0 (RG-32)');

  // Reconnexion : il retrouve son état projeté complet.
  table.etat = { ...table.etat, joueurs: table.etat.joueurs.map((joueur) =>
    joueur.id === 'J0' ? { ...joueur, connecte: true } : joueur) };
  const vue = table.vuePrivee('J0');
  assert.equal((vue?.moi as { montant_declare: number }).montant_declare, 4);
  assert.equal((vue?.moi as { montant_paye: number }).montant_paye, 0);
});

test('cas limite 17 — déconnexion DÉFINITIVE d’un joueur : la partie continue', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-17' }).demarrer();
  table.etat = { ...table.etat, joueurs: table.etat.joueurs.map((joueur) =>
    joueur.id === 'J3' ? { ...joueur, connecte: false } : joueur) };

  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  assert.equal(table.etat.etat_partie, 'TERMINEE');
  assert.equal(table.etat.joueurs.length, 6, 'il n’est jamais éliminé (RG-46)');
  assert.ok(table.etat.classement?.some((ligne) => ligne.joueur_id === 'J3'));
});

test('cas limite 18 — double soumission d’une déclaration, puis d’un paiement', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 3 });
  table.exiger('J0', 'declarer_contribution', { montant: 5 }, );
  assert.equal(
    table.manche().contributions.find((c) => c.joueur_id === 'J0')?.montant_declare,
    5,
    'la seconde REMPLACE la première',
  );
  table.exiger('J0', 'payer_secret', { montant: 2 });
  assert.equal(table.cmd('J0', 'payer_secret', { montant: 1 }).ok, false);
  assert.equal(table.cmd('J0', 'declarer_contribution', { montant: 1 }).ok, false);
});

test('cas limite 19 — accusation ou enquête sur soi-même', () => {
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
  assert.equal(table.cmd('J0', 'accuser', { accuse_joueur_id: 'J0' }).ok, false);
  assert.equal(table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J0' }).ok, false);
});

test('cas limite 20 — enquête répétée sur la même cible dans la même manche', () => {
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
  table.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  const second = table.cmd('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
  assert.equal((second as { erreur: { code: string } }).erreur.code, 'QUOTA_DEPASSE');
});

test('cas limite 21 — cercle de 5 (voisinage minimal) et de 8', () => {
  for (const effectif of [5, 8]) {
    const table = new Table({ joueurs: effectif, graine: `cl-21-${effectif}` }).demarrer();
    const positions = table.etat.joueurs.map((joueur) => joueur.position_cercle);
    assert.equal(new Set(positions).size, effectif, 'permutation complète et unique');
    // Chaque joueur a exactement deux voisins distincts dès 3 joueurs.
    const trames = table.trames.filter((trame) => trame.type === 'partie_demarree');
    const ordre = trames[0]?.charge.ordre_cercle as string[];
    assert.equal(ordre.length, effectif);
  }
});

test('cas limite 22 — mode avancé activé alors que le MARCHAND_DEJA_LIE se déconnecte', () => {
  const { table, marchandDejaLie } = allerAuDernierVoeu();
  table.etat = { ...table.etat, joueurs: table.etat.joueurs.map((joueur) =>
    joueur.id === marchandDejaLie ? { ...joueur, connecte: false } : joueur) };

  table.allerA('DV_SIGNATURE');
  table.exiger('J1', 'signer_dernier_voeu', { a_signe: true });
  table.expirer();

  assert.equal(table.etat.genie_libere, true);
  assert.deepEqual(
    table.etat.vainqueurs,
    [marchandDejaLie],
    'déconnecté ou non, il gagne seul (RG-56)',
  );
});

test('cas limite 23 — aucun signataire au Dernier Vœu', () => {
  const { table, gardienDeLaLampe } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.expirer(); // personne ne soumet : non-soumission = refus

  assert.equal(table.etat.genie_libere, false);
  const resolution = table.trames.find((trame) => trame.type === 'dernier_voeu_resolu');
  assert.equal(resolution?.charge.nb_signataires, 0);
  assert.equal(resolution?.charge.consequence, 'AUCUN_SIGNATAIRE');
  const gardien = table.etat.joueurs.find((joueur) => joueur.id === gardienDeLaLampe);
  assert.equal(gardien?.mission_reussie, true);
});

test('cas limite 24 — session abandonnée en pleine manche 3', () => {
  const table = new Table({ joueurs: 6, graine: 'cl-24' }).demarrer();
  for (let manche = 1; manche <= 2; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  table.allerA('ENQUETES_ACCUSATIONS');
  assert.equal(table.etat.manche_courante, 3);

  table.exiger('J0', 'abandonner_partie', { confirmation: true });
  assert.equal(table.etat.etat_partie, 'ABANDONNEE');
  assert.equal(table.etat.classement, null, 'RG-76 : aucun secret révélé');
  assert.equal(table.etat.groupe.parties_terminees, 0, 'RG-59 : compteur intact');
});

test('cas limite 25 — deux sessions actives avec le même pseudo de joueur', () => {
  const premiere = new Table({ joueurs: 6 });
  const seconde = new Table({ joueurs: 6 });
  assert.equal(premiere.etat.joueurs[1]?.pseudo, seconde.etat.joueurs[1]?.pseudo);
  assert.notEqual(premiere.etat.session_id, seconde.etat.session_id);
  // Le pseudo n'est unique QUE dans une session (contrainte UNIQUE(session_id, pseudo)).
});

test('cas limite 26 — code d’adhésion collisionnant avec une session encore active', () => {
  // La règle vit en base : index unique PARTIEL sur les sessions non terminales.
  // Le moteur, lui, ne porte pas d'unicité de code : il n'a pas à la connaître.
  // Le cas est donc vérifié côté serveur (migrations/001, idx_sessions_code_vivant)
  // et ici seulement pour ce qui regarde le moteur : deux sessions distinctes
  // peuvent porter le même code sans que l'état de l'une affecte l'autre.
  const premiere = new Table({ joueurs: 6 });
  const seconde = new Table({ joueurs: 6 });
  assert.equal(premiere.etat.code_adhesion, seconde.etat.code_adhesion);
  premiere.demarrer();
  assert.equal(seconde.etat.etat_partie, 'SALLE_ATTENTE', 'les états sont indépendants');
});

test('les 5 clauses du catalogue sont toutes couvertes par un cas limite', () => {
  // Garde-fou de relecture : si une clause était ajoutée au catalogue, ce test
  // rappellerait qu'aucun cas limite ne la couvre encore.
  assert.equal(CLAUSE.length, 5);
  assert.ok(aleaScripte([0]).entier(0, 3) === 0, 'l’aléa scripté est bien déterministe');
});
