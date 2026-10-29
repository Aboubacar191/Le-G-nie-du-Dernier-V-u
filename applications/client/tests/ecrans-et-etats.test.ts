// PREUVE — les 32 écrans du contrat existent, la PHASE décide lequel s'affiche
// (RG-30), et chaque écran DÉCLARE comment il rend ses cinq états.
//
// Sur les cinq états : plusieurs sont déclarés « non atteignables » par le
// contrat de conception lui-même (un formulaire n'a rien à charger, la phase
// VOEU publie toujours un objectif). Le test n'exige donc pas cinq branches de
// rendu, il exige que les CINQ soient TRAITÉS — rendus, ou déclarés
// inatteignables avec leur raison. C'est la différence entre un écran complet
// et un écran dont on n'a pas regardé les bords.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ETAT_PARTIE, PHASE, type EtatPartie, type Phase } from '@gdv/partage';

import {
  ECRANS,
  ecranPrincipal,
  estSuperpose,
  INTENTIONS,
  SURFACES_SUPERPOSEES,
  type ContexteEcran,
  type IdEcran,
} from '../src/logique/resolution-ecran.ts';

// Le registre des écrans n'est pas IMPORTÉ : node ne sait pas charger un
// fichier .vue, et ce projet n'embarque pas de DOM — en ajouter un pour un seul
// test serait une dépendance payée très cher. Le registre est donc vérifié par
// LECTURE de sa source, ce qui attrape exactement la même faute : un écran du
// contrat sans composant. La porte de types, elle, vérifie l'exhaustivité du
// Record<IdEcran, Component> à la compilation.
const ICI = dirname(fileURLToPath(import.meta.url));
const VUES = resolve(ICI, '..', 'src', 'vues');
const REGISTRE = readFileSync(resolve(VUES, 'index.ts'), 'utf8');

const CINQ_ETATS = ['chargement', 'contenu', 'vide', 'erreur', 'acces_refuse'] as const;

/** Correspondance IdEcran → fichier, pour lire les déclarations d'états. */
const FICHIERS: Readonly<Record<IdEcran, string>> = {
  'ECR-01': 'EcranAccueil.vue',
  'ECR-02': 'EcranCreationSession.vue',
  'ECR-03': 'EcranReglagesEquilibrage.vue',
  'ECR-04': 'EcranInvitation.vue',
  'ECR-05': 'EcranRejoindre.vue',
  'ECR-06': 'EcranSalleAttente.vue',
  'ECR-07': 'EcranPlacementHote.vue',
  'ECR-08': 'EcranAttentePlacement.vue',
  'ECR-09': 'EcranAttributionPrivee.vue',
  'ECR-10': 'EcranAnnonceVoeu.vue',
  'ECR-11': 'EcranPliGenie.vue',
  'ECR-12': 'EcranNegociation.vue',
  'ECR-13': 'EcranTransfert.vue',
  'ECR-14': 'EcranPropositionPret.vue',
  'ECR-15': 'EcranReponsePret.vue',
  'ECR-16': 'EcranDeclaration.vue',
  'ECR-17': 'EcranPaiementSecret.vue',
  'ECR-18': 'EcranRevelation.vue',
  'ECR-19': 'EcranEnquetesAccusations.vue',
  'ECR-20': 'EcranResultatEnquete.vue',
  'ECR-21': 'EcranConfirmationAccusation.vue',
  'ECR-22': 'EcranExecution.vue',
  'ECR-23': 'EcranDvProposition.vue',
  'ECR-24': 'EcranDvDebat.vue',
  'ECR-25': 'EcranDvSignature.vue',
  'ECR-26': 'EcranDvResolution.vue',
  'ECR-27': 'EcranScoresFinaux.vue',
  'ECR-28': 'EcranMonOr.vue',
  'ECR-29': 'EcranLiaisonPerdue.vue',
  'ECR-30': 'EcranReconnexion.vue',
  'ECR-31': 'EcranPartieAbandonnee.vue',
  'ECR-32': 'EcranAccesRefuse.vue',
};

const base: ContexteEcran = Object.freeze({
  acces_refuse: false,
  session_active: true,
  intention: 'accueil',
  etat_partie: 'MANCHE_EN_COURS',
  phase: 'VOEU',
  est_hote: false,
  a_declare: false,
  restitution_en_cours: false,
});

test('les 32 écrans du contrat existent, ni plus ni moins', () => {
  assert.equal(ECRANS.length, 32);
  assert.equal(Object.keys(FICHIERS).length, 32);
  for (const id of ECRANS) {
    const fichier = FICHIERS[id];
    assert.ok(existsSync(resolve(VUES, fichier)), `${id} : ${fichier} absent du dépôt`);
    assert.ok(REGISTRE.includes(`'${id}':`), `${id} absent du registre des écrans`);
    assert.ok(REGISTRE.includes(`./${fichier}`), `${fichier} non importé par le registre`);
  }
});

test('CHAQUE écran déclare le traitement de ses cinq états', () => {
  const incomplets: string[] = [];
  for (const id of ECRANS) {
    const source = readFileSync(resolve(VUES, FICHIERS[id]), 'utf8');
    const entete = source.slice(0, source.indexOf('import '));
    const manquants = CINQ_ETATS.filter((etat) => !entete.includes(`${etat} `));
    if (manquants.length > 0) incomplets.push(`${id} → ${manquants.join(', ')}`);
  }
  assert.deepEqual(incomplets, [], `états non traités : ${incomplets.join(' | ')}`);
});

test('chaque écran nomme l’identifiant du contrat auquel il répond', () => {
  for (const id of ECRANS) {
    const source = readFileSync(resolve(VUES, FICHIERS[id]), 'utf8');
    assert.ok(source.includes(id), `${FICHIERS[id]} ne cite pas ${id}`);
  }
});

test('un jeton refusé prime sur TOUT le reste (RG-71)', () => {
  for (const etat of ETAT_PARTIE) {
    const ecran = ecranPrincipal({ ...base, acces_refuse: true, etat_partie: etat });
    assert.equal(ecran, 'ECR-32', `depuis ${etat}`);
  }
});

test('hors session, c’est l’intention locale qui décide — et elle seule', () => {
  const attendus: Record<string, IdEcran> = {
    accueil: 'ECR-01',
    creation: 'ECR-02',
    reglages: 'ECR-03',
    invitation: 'ECR-04',
    adhesion: 'ECR-05',
  };
  for (const intention of INTENTIONS) {
    const ecran = ecranPrincipal({ ...base, session_active: false, intention });
    assert.equal(ecran, attendus[intention]);
  }
});

test('LA PHASE DÉCIDE : chaque phase de manche mène à son écran', () => {
  const attendus: Readonly<Record<Phase, IdEcran>> = {
    VOEU: 'ECR-10',
    NEGOCIATION: 'ECR-12',
    DECLARATION_PAIEMENT: 'ECR-16',
    REVELATION: 'ECR-18',
    ENQUETES_ACCUSATIONS: 'ECR-19',
    EXECUTION: 'ECR-22',
    DV_PROPOSITION: 'ECR-23',
    DV_DEBAT: 'ECR-24',
    DV_SIGNATURE: 'ECR-25',
    DV_RESOLUTION: 'ECR-26',
  };
  for (const phase of PHASE) {
    const avance = phase.startsWith('DV_');
    const ecran = ecranPrincipal({
      ...base,
      etat_partie: avance ? 'DERNIER_VOEU' : 'MANCHE_EN_COURS',
      phase,
    });
    assert.equal(ecran, attendus[phase], `phase ${phase}`);
  }
});

test('RG-10 — qui a déclaré passe au paiement, qui ne l’a pas fait reste', () => {
  const contexte = { ...base, phase: 'DECLARATION_PAIEMENT' as Phase };
  assert.equal(ecranPrincipal({ ...contexte, a_declare: false }), 'ECR-16');
  assert.equal(ecranPrincipal({ ...contexte, a_declare: true }), 'ECR-17');
});

test('le placement distingue l’hôte du marchand, et rien d’autre ne le fait', () => {
  const contexte = { ...base, etat_partie: 'PLACEMENT' as EtatPartie };
  assert.equal(ecranPrincipal({ ...contexte, est_hote: true }), 'ECR-07');
  assert.equal(ecranPrincipal({ ...contexte, est_hote: false }), 'ECR-08');
});

test('chaque état de partie a un écran, aucun n’est orphelin', () => {
  const attendus: Readonly<Record<EtatPartie, IdEcran>> = {
    CREEE: 'ECR-04',
    SALLE_ATTENTE: 'ECR-06',
    PLACEMENT: 'ECR-08',
    DISTRIBUTION: 'ECR-09',
    MANCHE_EN_COURS: 'ECR-10',
    DERNIER_VOEU: 'ECR-23',
    SCORES: 'ECR-27',
    TERMINEE: 'ECR-27',
    ABANDONNEE: 'ECR-31',
  };
  for (const etat of ETAT_PARTIE) {
    const avance = etat === 'DERNIER_VOEU';
    const ecran = ecranPrincipal({
      ...base,
      etat_partie: etat,
      phase: avance ? 'DV_PROPOSITION' : 'VOEU',
    });
    assert.equal(ecran, attendus[etat], `état ${etat}`);
  }
});

test('la restitution après reconnexion montre ECR-30, puis s’efface', () => {
  assert.equal(ecranPrincipal({ ...base, restitution_en_cours: true }), 'ECR-30');
  assert.equal(ecranPrincipal({ ...base, restitution_en_cours: false }), 'ECR-10');
});

test('les surfaces superposées ne remplacent JAMAIS l’écran de phase', () => {
  // Elles portent le panneau privé, les feuilles et la couche de liaison
  // perdue : remplacer l'écran ferait disparaître le bandeau et son minuteur.
  for (const surface of SURFACES_SUPERPOSEES) {
    assert.ok(estSuperpose(surface), `${surface} doit être déclarée superposée`);
  }
  for (const phase of PHASE) {
    const ecran = ecranPrincipal({ ...base, phase, etat_partie: 'MANCHE_EN_COURS' });
    assert.ok(!estSuperpose(ecran), `${ecran} ne peut pas être un écran de fond`);
  }
});

test('une projection pas encore reçue ne fabrique aucun écran de jeu', () => {
  const ecran = ecranPrincipal({ ...base, etat_partie: null, phase: null });
  assert.equal(ecran, 'ECR-06', 'avant projection, la salle d’attente est le repli sûr');
});
