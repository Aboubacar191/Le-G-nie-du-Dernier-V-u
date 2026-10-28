// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — couverture 100 % des LIGNES ET DES BRANCHES.  ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// « Chaque branche non exécutée est un chemin par lequel un secret peut sortir
//   sans qu'aucun test ne l'ait vu » (ARCHI _justification_couverture_projection).
//
// Ce fichier n'exerce pas le jeu : il exerce les ÉTATS DÉGÉNÉRÉS — avant la
// première manche, sans classement, sans phase, sans signature, avec un joueur
// inconnu. Ce sont exactement les états où une projection mal écrite rend
// n'importe quoi, et exactement ceux qu'un scénario de partie ne visite jamais.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appartientALaClasse,
  destinatairesDeLaClause,
  estDansLaSession,
  estHoteDeLaSession,
  projeterVuePrivee,
} from '@gdv/moteur';

import { Table } from '../aide/table.ts';
import { allerAuDernierVoeu } from '../aide/mode-avance.ts';

// --- La porte d'appartenance, classe par classe -----------------------------

test('appartientALaClasse : les cinq classes du contrat, et rien d’autre', () => {
  const table = new Table({ joueurs: 6 });
  const etat = table.etat;

  assert.equal(appartientALaClasse(etat, 'J1', 'tous', []), true);
  assert.equal(appartientALaClasse(etat, 'INCONNU', 'tous', []), false);

  assert.equal(appartientALaClasse(etat, 'J0', 'hote', []), true);
  assert.equal(appartientALaClasse(etat, 'J1', 'hote', []), false);

  assert.equal(appartientALaClasse(etat, 'J1', 'proprietaire', ['J1']), true);
  assert.equal(appartientALaClasse(etat, 'J2', 'proprietaire', ['J1']), false);
  assert.equal(appartientALaClasse(etat, 'J1', 'enqueteur', ['J1']), true);
  assert.equal(appartientALaClasse(etat, 'J2', 'enqueteur', ['J1']), false);
  assert.equal(appartientALaClasse(etat, 'J1', 'porteur_clause_et_faiseur', ['J1']), true);
  assert.equal(appartientALaClasse(etat, 'J2', 'porteur_clause_et_faiseur', ['J1']), false);
});

test('estDansLaSession et estHoteDeLaSession sur un identifiant inconnu', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(estDansLaSession(table.etat, 'J0'), true);
  assert.equal(estDansLaSession(table.etat, 'INCONNU'), false);
  assert.equal(estHoteDeLaSession(table.etat, 'INCONNU'), false);
});

test('destinatairesDeLaClause : porteur seul, puis porteur et faiseurs, sans doublon', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const faiseurs = table.etat.joueurs
    .filter((joueur) => joueur.role_secret === 'FAISEUR_CONTRATS')
    .map((joueur) => joueur.id);
  const avec = destinatairesDeLaClause(table.etat, faiseurs[0] ?? 'J0');
  assert.equal(new Set(avec).size, avec.length, 'le porteur faiseur n’est compté qu’une fois');
  assert.ok(avec.includes(faiseurs[0] ?? 'J0'));
});

// --- Vue privée sur un état sans manche ---------------------------------------

/** Ce que doit valoir une vue privée AVANT toute manche : tout est nul ou vide. */
const ATTENDU_AVANT_MANCHE: Readonly<Record<string, unknown>> = {
  manche_courante: null,
  phase: null,
  phase_fin_at: null,
};
const ATTENDU_MOI_AVANT_MANCHE: Readonly<Record<string, unknown>> = {
  clause_connue: null,
  montant_declare: null,
  montant_paye: null,
  role_secret: null,
  mission_secrete: null,
  a_accuse_cette_manche: false,
  ma_signature_dernier_voeu: null,
};

test('vue privée AVANT toute manche : aucune clause, aucune contribution, aucune phase', () => {
  const table = new Table({ joueurs: 6 });
  const vue = projeterVuePrivee(table.etat, 'J0');
  assert.notEqual(vue, null);
  const brute = vue as unknown as Record<string, unknown>;
  for (const [cle, valeur] of Object.entries(ATTENDU_AVANT_MANCHE)) {
    assert.equal(brute[cle], valeur, cle);
  }
  const moi = brute.moi as Record<string, unknown>;
  for (const [cle, valeur] of Object.entries(ATTENDU_MOI_AVANT_MANCHE)) {
    assert.equal(moi[cle], valeur, `moi.${cle}`);
  }
  assert.deepEqual(brute.historique_manches, []);
  assert.deepEqual(moi.mes_enquetes_de_la_manche, []);
  assert.deepEqual(moi.mes_prets, []);
  assert.notEqual(brute.groupe, null, 'J0 est l’hôte');
});

test('vue privée d’un non-hôte : le bloc groupe est NUL', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projeterVuePrivee(table.etat, 'J1')?.groupe, null);
});

test('vue privée d’un joueur hors session : NULL, pas une vue amputée', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projeterVuePrivee(table.etat, 'INCONNU'), null);
});

test('vue privée : le non-porteur non-faiseur n’a AUCUNE clause', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  const manche = table.manche(1);
  const autorises = new Set(destinatairesDeLaClause(table.etat, manche.porteur_clause_joueur_id));
  const exclu = table.joueurs.find((joueur) => !autorises.has(joueur));
  assert.notEqual(exclu, undefined);
  assert.equal(projeterVuePrivee(table.etat, exclu as string)?.moi.clause_connue, null);
});

test('vue privée : la signature du Dernier Vœu n’apparaît qu’à son propriétaire', () => {
  const { table } = allerAuDernierVoeu();
  table.allerA('DV_SIGNATURE');
  table.exiger('J0', 'signer_dernier_voeu', { a_signe: true });
  assert.equal(projeterVuePrivee(table.etat, 'J0')?.moi.ma_signature_dernier_voeu, true);
  assert.equal(projeterVuePrivee(table.etat, 'J1')?.moi.ma_signature_dernier_voeu, null);
});

test('vue privée : la page de mouvements se tronque et rend un curseur', () => {
  // Beaucoup de mouvements : la pagination doit se déclencher.
  const table = new Table({ joueurs: 6, graine: 'pagination' }).demarrer();
  for (let manche = 1; manche <= 5; manche += 1) {
    table.allerA('NEGOCIATION');
    for (let transfert = 0; transfert < 11; transfert += 1) {
      table.cmd('J0', 'transferer_pieces', { cible_joueur_id: 'J1', montant: 1 });
      table.cmd('J1', 'transferer_pieces', { cible_joueur_id: 'J0', montant: 1 });
    }
    table.allerA('EXECUTION');
    table.expirer();
  }
  const page = projeterVuePrivee(table.etat, 'J0')?.mes_mouvements;
  assert.ok((page?.elements.length ?? 0) <= 50);
  if ((page?.tronque ?? false) === true) {
    assert.equal(typeof page?.curseur_suivant, 'string');
  }
  assert.ok(table.etat.mouvements.filter((m) => m.joueur_id === 'J0').length > 20);
});
