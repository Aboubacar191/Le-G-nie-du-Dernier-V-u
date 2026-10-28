// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — couverture 100 % des LIGNES ET DES BRANCHES.  ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Événements projetés sur des états où ils N'ONT PAS DE SENS : manche absente,
// manche non close, classement non calculé, joueur inconnu. Dans tous ces cas
// la réponse attendue est RIEN — jamais une charge remplie de zéros, qui
// annoncerait un résultat que le moteur n'a pas calculé.
//
// Suite de etats-degeneres.test.ts, qui couvre la vue privée. Le découpage est
// imposé par la limite de 300 lignes par fichier de l'ARCHI.

import test from 'node:test';
import assert from 'node:assert/strict';

import { projeterEvenement, projeterVuePrivee, type Effet } from '@gdv/moteur';

import { Table, tableEnDeclaration } from '../aide/table.ts';

function projette(table: Table, effet: Effet, destinataire = 'J0'): unknown {
  return projeterEvenement(table.etat, effet, destinataire);
}

test('voeu_annonce sur une manche absente : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projette(table, { type: 'voeu_annonce', numero_manche: 9 }), null);
});

test('phase_changee sans phase courante : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projette(table, { type: 'phase_changee' }), null);
});

test('phase_changee avec une phase mais sans échéance : RIEN', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  table.etat = { ...table.etat, phase_fin_at: null };
  assert.equal(projette(table, { type: 'phase_changee' }), null);
});

test('declaration_publiee hors manche : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(
    projette(table, { type: 'declaration_publiee', joueur_id: 'J0', montant_declare: 1 }),
    null,
  );
});

test('revelation_ecart_total sur une manche absente : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(
    projette(table, {
      type: 'revelation_ecart_total',
      numero_manche: 7,
      total_declare: 0,
      total_paye: 0,
    }),
    null,
  );
});

test('execution_resultat sur une manche NON CLOSE : RIEN', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(projette(table, { type: 'execution_resultat', numero_manche: 1 }), null);
  assert.equal(projette(table, { type: 'execution_resultat', numero_manche: 9 }), null);
});

test('execution_resultat sur une manche close sans récompense : des zéros, pas des nuls', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.imposerClause('GENIE_GARDE_UN_TIERS');
  table.declarerEtPayer([
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
  ]);
  table.allerA('EXECUTION');
  const charge = projette(table, { type: 'execution_resultat', numero_manche: 1 }) as Record<
    string,
    unknown
  >;
  assert.equal(charge.reussi, false);
  assert.equal(charge.recompense, 0);
  assert.equal(charge.multiplicateur_applique, 0);
  assert.equal(charge.reliquat_non_distribue, 0);
  assert.equal(charge.total_consolation, null, 'la clause de consolation n’était pas active');
  assert.deepEqual(charge.parts, []);
});

test('execution_resultat sur une manche close mais NON CHIFFRÉE : RIEN, pas des zéros', () => {
  // Une manche marquée close dont le pipeline n'aurait pas renseigné les
  // totaux : publier des zéros annoncerait un résultat inventé.
  const table = new Table({ joueurs: 6 }).demarrer();
  table.etat = {
    ...table.etat,
    manches: table.etat.manches.map((manche) =>
      manche.numero === 1
        ? { ...manche, cloture: true, cloture_at: table.instant }
        : manche,
    ),
  };
  assert.equal(projette(table, { type: 'execution_resultat', numero_manche: 1 }), null);
});

test('mes_prets : le destinataire est servi qu’il soit prêteur OU emprunteur', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  table.etat = {
    ...table.etat,
    prets: [
      {
        id: 'pret-emprunteur',
        preteur_joueur_id: 'J0',
        emprunteur_joueur_id: 'J1',
        principal: 4,
        du_total: 6,
        rembourse: 0,
        manche_emission: 1,
        statut: 'ACTIF',
        cree_at: table.instant,
        repondu_at: table.instant,
      },
    ],
  };
  assert.equal(projeterVuePrivee(table.etat, 'J0')?.moi.mes_prets.length, 1, 'côté prêteur');
  assert.equal(projeterVuePrivee(table.etat, 'J1')?.moi.mes_prets.length, 1, 'côté emprunteur');
  assert.equal(projeterVuePrivee(table.etat, 'J2')?.moi.mes_prets.length, 0, 'tiers : rien');
});

test('attribution_privee avant distribution : RIEN, et RIEN pour un inconnu', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projette(table, { type: 'attribution_privee', joueur_id: 'J0' }), null);
  assert.equal(projette(table, { type: 'attribution_privee', joueur_id: 'INCONNU' }), null);
});

test('solde_mis_a_jour pour un joueur inconnu : RIEN', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(projette(table, { type: 'solde_mis_a_jour', joueur_id: 'INCONNU' }), null);
});

test('etat_complet_prive pour un destinataire inconnu : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(
    projeterEvenement(
      table.etat,
      { type: 'etat_complet_prive', destinataire_joueur_id: 'INCONNU' },
      'J0',
    ),
    null,
  );
});

test('dernier_voeu_propose sans échéance de phase : RIEN', () => {
  const table = new Table({ joueurs: 6 });
  assert.equal(projette(table, { type: 'dernier_voeu_propose', joueur_id: 'J0' }), null);
});

test('scores_finaux avant calcul du classement : RIEN', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  assert.equal(projette(table, { type: 'scores_finaux' }), null);
});

test('scores_finaux : un classement portant un joueur inconnu ne sort PAS', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  table.etat = {
    ...table.etat,
    classement: [
      { joueur_id: 'FANTOME', pieces_restantes: 0, score_final: 0, mission_reussie: false, rang: 1 },
    ],
  };
  assert.equal(
    projette(table, { type: 'scores_finaux' }),
    null,
    'plutôt RIEN qu’une ligne inventée',
  );
});

test('scores_finaux : un joueur sans rôle distribué empêche la publication', () => {
  const table = new Table({ joueurs: 6 }).demarrer();
  table.etat = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) =>
      joueur.id === 'J0' ? { ...joueur, role_secret: null } : joueur,
    ),
    classement: table.etat.joueurs.map((joueur, index) => ({
      joueur_id: joueur.id,
      pieces_restantes: joueur.solde_pieces,
      score_final: joueur.solde_pieces,
      mission_reussie: false,
      rang: index + 1,
    })),
  };
  assert.equal(projette(table, { type: 'scores_finaux' }), null);
});

test('scores_finaux : les manches NON closes ne figurent pas dans les paiements publiés', () => {
  const table = new Table({ joueurs: 6, graine: 'scores' }).demarrer();
  for (let manche = 1; manche <= 4; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }
  // La manche 5 est ouverte, non close.
  assert.equal(table.etat.manche_courante, 5);
  table.etat = {
    ...table.etat,
    classement: table.etat.joueurs.map((joueur, index) => ({
      joueur_id: joueur.id,
      pieces_restantes: joueur.solde_pieces,
      score_final: joueur.solde_pieces,
      mission_reussie: false,
      rang: index + 1,
    })),
  };
  const charge = projette(table, { type: 'scores_finaux' }) as {
    paiements_historiques: { numero_manche: number }[];
  };
  assert.equal(charge.paiements_historiques.length, 24, '4 manches closes × 6 joueurs');
  assert.ok(!charge.paiements_historiques.some((ligne) => ligne.numero_manche === 5));
});

test('groupe_mis_a_jour ne part qu’à l’hôte', () => {
  const table = new Table({ joueurs: 6 });
  assert.notEqual(projette(table, { type: 'groupe_mis_a_jour' }, 'J0'), null);
  assert.equal(projette(table, { type: 'groupe_mis_a_jour' }, 'J1'), null);
});

test('joueur_rejoint et les événements de présence comptent les CONNECTÉS', () => {
  const table = new Table({ joueurs: 6 });
  table.etat = {
    ...table.etat,
    joueurs: table.etat.joueurs.map((joueur) =>
      joueur.id === 'J5' ? { ...joueur, connecte: false } : joueur,
    ),
  };
  const quitte = projette(table, { type: 'joueur_quitte', joueur_id: 'J5' }) as {
    nb_connectes: number;
  };
  assert.equal(quitte.nb_connectes, 5);
  const rejoint = projette(table, { type: 'joueur_rejoint', joueur_id: 'J5' }) as {
    joueur: { connecte: boolean };
    nb_joueurs: number;
  };
  assert.equal(rejoint.nb_joueurs, 6);
  assert.equal(rejoint.joueur.connecte, false);
});

test('une déclaration non soumise ne figure pas dans les déclarations publiques', () => {
  const table = tableEnDeclaration({ joueurs: 6 });
  table.exiger('J0', 'declarer_contribution', { montant: 3 });
  const vue = projeterVuePrivee(table.etat, 'J1');
  assert.equal(vue?.manche_courante?.declarations.length, 1);
  assert.equal(vue?.manche_courante?.clause_revelee, null, 'la manche n’est pas close');
  assert.equal(vue?.manche_courante?.total_paye, null, 'nul avant la phase REVELATION');
});
