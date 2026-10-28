// Machines à états et distribution : les tables normatives et leurs refus.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS_PAR_PHASE,
  MISSIONS_BASE,
  ORDRE_PHASES_DERNIER_VOEU,
  ORDRE_PHASES_MANCHE,
  ROLES_BASE,
  TRANSITIONS,
  autoriseeEnPhase,
  composerMainMissions,
  composerMainRoles,
  creerAleaSfc32,
  distribuerRolesModeAvance,
  estPhaseMinutee,
  estTerminal,
  finDePhase,
  incrementeLeCompteurDuGroupe,
  phaseSuivante,
  tirerClause,
  tirerPorteur,
  transitionAdmise,
} from '@gdv/moteur';
import { CONFIG_DEFAUT } from '@gdv/partage';

import { Table } from '../aide/table.ts';

// --- Machine à états de manche ------------------------------------------------

test('l’ordre des six phases de manche est celui de RG-30', () => {
  assert.deepEqual(
    [...ORDRE_PHASES_MANCHE],
    ['VOEU', 'NEGOCIATION', 'DECLARATION_PAIEMENT', 'REVELATION', 'ENQUETES_ACCUSATIONS', 'EXECUTION'],
  );
  assert.deepEqual(
    [...ORDRE_PHASES_DERNIER_VOEU],
    ['DV_PROPOSITION', 'DV_DEBAT', 'DV_SIGNATURE', 'DV_RESOLUTION'],
  );
});

test('phaseSuivante avance d’un cran, et rend null au bout de chaque séquence', () => {
  assert.equal(phaseSuivante('VOEU'), 'NEGOCIATION');
  assert.equal(phaseSuivante('ENQUETES_ACCUSATIONS'), 'EXECUTION');
  assert.equal(phaseSuivante('EXECUTION'), null, 'fin de la séquence de manche');
  assert.equal(phaseSuivante('DV_PROPOSITION'), 'DV_DEBAT');
  assert.equal(phaseSuivante('DV_RESOLUTION'), null, 'fin de la séquence du Dernier Vœu');
});

test('estPhaseMinutee : seule DV_RESOLUTION n’a pas de minuteur', () => {
  for (const phase of ORDRE_PHASES_MANCHE) assert.equal(estPhaseMinutee(phase), true);
  assert.equal(estPhaseMinutee('DV_SIGNATURE'), true);
  assert.equal(estPhaseMinutee('DV_RESOLUTION'), false);
});

test('finDePhase : échéance absolue, et instant courant pour DV_RESOLUTION', () => {
  const maintenant = 1_000_000;
  assert.equal(finDePhase('VOEU', CONFIG_DEFAUT, maintenant), maintenant + 20_000);
  assert.equal(finDePhase('NEGOCIATION', CONFIG_DEFAUT, maintenant), maintenant + 120_000);
  assert.equal(finDePhase('DV_RESOLUTION', CONFIG_DEFAUT, maintenant), maintenant);
});

test('autoriseeEnPhase : la table est la seule source de l’autorisation', () => {
  assert.equal(autoriseeEnPhase('NEGOCIATION', 'transferer_pieces'), true);
  assert.equal(autoriseeEnPhase('NEGOCIATION', 'declarer_contribution'), false);
  assert.equal(autoriseeEnPhase('VOEU', 'transferer_pieces'), false);
  assert.equal(autoriseeEnPhase(null, 'transferer_pieces'), false, 'hors phase : rien n’est ouvert');
  assert.deepEqual([...ACTIONS_PAR_PHASE.VOEU], [], 'aucune action en phase VOEU');
  assert.deepEqual([...ACTIONS_PAR_PHASE.EXECUTION], [], 'aucune action pendant l’exécution');
  assert.deepEqual([...ACTIONS_PAR_PHASE.DV_SIGNATURE], ['signer_dernier_voeu']);
});

// --- Machine à états de partie -------------------------------------------------

test('la table des transitions n’admet que les chemins de la SPEC', () => {
  assert.equal(transitionAdmise('CREEE', 'SALLE_ATTENTE'), true);
  assert.equal(transitionAdmise('SALLE_ATTENTE', 'PLACEMENT'), true);
  assert.equal(transitionAdmise('MANCHE_EN_COURS', 'SCORES'), true);
  assert.equal(transitionAdmise('SCORES', 'TERMINEE'), true);
  assert.equal(transitionAdmise('CREEE', 'SCORES'), false, 'aucun raccourci vers les scores');
  assert.equal(transitionAdmise('TERMINEE', 'ABANDONNEE'), false, 'TERMINEE est terminal');
  assert.equal(transitionAdmise('ABANDONNEE', 'SCORES'), false, 'RG-76 : aucun chemin de divulgation');
});

test('tout état non terminal mène à ABANDONNEE, et TERMINEE n’y mène pas', () => {
  const versAbandon = TRANSITIONS.filter((transition) => transition.vers === 'ABANDONNEE');
  assert.equal(versAbandon.length, 7, "les sept états non terminaux");
  assert.ok(!versAbandon.some((transition) => transition.de === 'TERMINEE'));
});

test('estTerminal et incrementeLeCompteurDuGroupe', () => {
  assert.equal(estTerminal('TERMINEE'), true);
  assert.equal(estTerminal('ABANDONNEE'), true);
  assert.equal(estTerminal('MANCHE_EN_COURS'), false);
  assert.equal(incrementeLeCompteurDuGroupe('TERMINEE'), true);
  assert.equal(
    incrementeLeCompteurDuGroupe('ABANDONNEE'),
    false,
    'RG-59 : jamais sur un abandon',
  );
});

// --- Distribution ---------------------------------------------------------------

test('composerMainRoles : les 4 rôles présents, aucun au-delà de 2 exemplaires', () => {
  for (let effectif = 5; effectif <= 8; effectif += 1) {
    const main = composerMainRoles(effectif, creerAleaSfc32(`main-${effectif}`));
    assert.equal(main.length, effectif);
    for (const role of ROLES_BASE) assert.ok(main.includes(role), `${role} absent`);
    for (const role of ROLES_BASE) {
      assert.ok(main.filter((candidat) => candidat === role).length <= 2);
    }
  }
});

test('composerMainRoles : un effectif INFÉRIEUR au nombre de rôles distribue un sous-ensemble', () => {
  const main = composerMainRoles(2, creerAleaSfc32('petit'));
  assert.equal(main.length, 2);
  assert.equal(new Set(main).size, 2, 'aucun doublon avant que tous aient été servis');
  const seul = composerMainRoles(ROLES_BASE.length, creerAleaSfc32('exact'));
  assert.equal(new Set(seul).size, ROLES_BASE.length);
});

test('composerMainRoles : un effectif au-delà de la capacité est un refus explicite', () => {
  const capacite = ROLES_BASE.length * 2;
  assert.doesNotThrow(() => composerMainRoles(capacite, creerAleaSfc32('limite')));
  assert.throws(
    () => composerMainRoles(capacite + 1, creerAleaSfc32('trop')),
    /incompatible avec RG-04/,
  );
});

test('composerMainMissions : distinctes tant que possible, puis doublons', () => {
  const cinq = composerMainMissions(5, creerAleaSfc32('m5'));
  assert.equal(new Set(cinq).size, 5, 'les 5 missions, distinctes');
  const huit = composerMainMissions(8, creerAleaSfc32('m8'));
  assert.equal(huit.length, 8);
  for (const mission of MISSIONS_BASE) assert.ok(huit.includes(mission));
  const deux = composerMainMissions(2, creerAleaSfc32('m2'));
  assert.equal(new Set(deux).size, 2);
});

test('tirerClause : sans remise, puis refus quand le catalogue est épuisé', () => {
  const table = new Table({ joueurs: 6 });
  let etat = table.etat;
  const tirees: string[] = [];
  for (let tour = 0; tour < 5; tour += 1) {
    const tirage = tirerClause(etat, creerAleaSfc32(`clause-${tour}`));
    tirees.push(tirage.clause);
    etat = tirage.etat;
  }
  assert.equal(new Set(tirees).size, 5);
  assert.equal(etat.clauses_disponibles.length, 0);
  assert.throws(() => tirerClause(etat, creerAleaSfc32('vide')), /Plus aucune clause tirable/);
});

test('tirerPorteur : un joueur de la table, et refus sur une table vide', () => {
  const table = new Table({ joueurs: 6 });
  const porteur = tirerPorteur(table.etat, creerAleaSfc32('porteur'));
  assert.ok(table.joueurs.includes(porteur));
  const vide = { ...table.etat, joueurs: [] };
  assert.throws(() => tirerPorteur(vide, creerAleaSfc32('vide')), /Aucun joueur/);
});

test('distribuerRolesModeAvance : sans effet si le mode est inactif', () => {
  const table = new Table({ joueurs: 6 });
  const apres = distribuerRolesModeAvance(table.etat, creerAleaSfc32('inactif'));
  assert.equal(apres, table.etat, 'l’état est rendu TEL QUEL');
});

test('distribuerRolesModeAvance : deux joueurs distincts, et refus en dessous de deux', () => {
  const table = new Table({ joueurs: 6, mode_avance: true });
  const apres = distribuerRolesModeAvance(table.etat, creerAleaSfc32('avance'));
  const marchand = apres.joueurs.filter((joueur) => joueur.role_secret === 'MARCHAND_DEJA_LIE');
  const gardien = apres.joueurs.filter(
    (joueur) => joueur.mission_secrete === 'GARDIEN_DE_LA_LAMPE',
  );
  assert.equal(marchand.length, 1);
  assert.equal(gardien.length, 1);
  assert.notEqual(marchand[0]?.id, gardien[0]?.id, 'RG-52 : deux joueurs DISTINCTS');
  assert.equal(marchand[0]?.mission_secrete, null, 'le rôle remplace la mission (RG-51)');

  const solo = { ...table.etat, joueurs: table.etat.joueurs.slice(0, 1) };
  assert.throws(
    () => distribuerRolesModeAvance(solo, creerAleaSfc32('solo')),
    /deux joueurs distincts/,
  );
});

test('une dotation initiale NULLE n’écrit aucun mouvement', () => {
  const table = new Table({ joueurs: 6, config: { pieces_initiales: 0 } }).demarrer();
  assert.equal(table.solde('J0'), 0);
  assert.equal(table.etat.mouvements.length, 0, 'aucune ligne de delta nul');
});
