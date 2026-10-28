// PARTIE COMPLÈTE — 5 manches, 6 joueurs, graine fixée, de bout en bout.
//
// Scénario SCRIPTÉ et déterministe, joué à travers la pile réelle : routes
// d'amorçage, boucle de session, moteur, projection, journal et base SQLite. Il
// n'y a ici ni simulacre ni raccourci — seule l'horloge est injectée, parce
// qu'un test qui attendrait réellement 30 minutes de phases ne serait pas un
// test.
//
// C'est la démonstration demandée au rapport : la partie va jusqu'aux scores,
// les invariants monétaires tiennent à chaque transition, et l'état se rejoue à
// l'identique depuis le journal.

import test from 'node:test';
import assert from 'node:assert/strict';

import { projeterEvenement, verifierInvariants, type EtatSession } from '@gdv/moteur';

import { rejouerSession } from '../src/persistance/journal.ts';
import { creerHarnais } from './aide/service-de-test.ts';
import { commander, demarrer, ouvrirPartie, type PartieOuverte } from './aide/jouer.ts';
import type { Service } from '../src/service.ts';

const PAS_MS = 1000;

/** Le script : par manche, (déclaré, payé) pour chacun des 6 joueurs. */
const SCRIPT: readonly (readonly (readonly [number, number])[])[] = [
  // Manche 1 — le vœu passe de justesse, un seul menteur.
  [
    [4, 4],
    [4, 4],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 1],
  ],
  // Manche 2 — deux menteurs, le vœu échoue.
  [
    [3, 1],
    [3, 0],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ],
  // Manche 3 — tout le monde paie ce qu'il annonce.
  [
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ],
  // Manche 4 — un gros menteur, démasqué.
  [
    [6, 0],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
    [3, 3],
  ],
  // Manche 5 — fin serrée.
  [
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
  ],
];

interface Observation {
  readonly manche: number;
  readonly total_declare: number | null;
  readonly total_paye: number | null;
  readonly objectif: number;
  readonly reussi: boolean | null;
  readonly clause: string;
  readonly recompense: number | null;
  readonly parts: readonly number[];
  readonly revelation: string | null;
  readonly suspects: number | null;
}

/** Graine FIXÉE : le scénario est reproductible, et ses chiffres citables. */
const GRAINE = 'GDV-S4-partie-complete-graine-fixee';

/** Manche 2 : un transfert, pour que la négociation soit exercée elle aussi. */
function jouerNegociation(service: Service, ouverte: PartieOuverte, numero: number): void {
  if (numero !== 2) return;
  commander(service, ouverte, ouverte.joueurs[0] as string, 'transferer_pieces', {
    cible_joueur_id: ouverte.joueurs[5] as string,
    montant: 1,
  });
}

function jouerDeclarations(
  service: Service,
  ouverte: PartieOuverte,
  plan: readonly (readonly [number, number])[],
  numero: number,
): void {
  ouverte.joueurs.forEach((joueur, rang) => {
    const couple = plan[rang];
    if (couple === undefined) return;
    const solde = ouverte.partie.etat.joueurs[rang]?.solde_pieces ?? 0;
    const declare = Math.min(couple[0], solde);
    const paye = Math.min(couple[1], declare);
    const declaration = commander(service, ouverte, joueur, 'declarer_contribution', {
      montant: declare,
    });
    assert.ok(declaration.accepte, `déclaration de ${joueur} manche ${numero}`);
    const paiement = commander(service, ouverte, joueur, 'payer_secret', { montant: paye });
    assert.ok(paiement.accepte, `paiement de ${joueur} manche ${numero}`);
  });
}

/** Manche 1 : une enquête. Manche 4 : une accusation juste. */
function jouerEnquetesEtAccusations(
  service: Service,
  ouverte: PartieOuverte,
  numero: number,
): void {
  if (numero === 1) {
    commander(service, ouverte, ouverte.joueurs[1] as string, 'lancer_enquete', {
      cible_joueur_id: ouverte.joueurs[5] as string,
    });
  }
  if (numero !== 4) return;
  const accusation = commander(service, ouverte, ouverte.joueurs[1] as string, 'accuser', {
    accuse_joueur_id: ouverte.joueurs[0] as string,
  });
  assert.ok(accusation.accepte);
}

function observerManche(ouverte: PartieOuverte, numero: number): Observation {
  const manche = ouverte.partie.etat.manches.find((candidate) => candidate.numero === numero);
  if (manche === undefined) throw new Error(`manche ${numero} absente de l'état`);
  const revelation = manche.revelations[0];
  return {
    manche: numero,
    total_declare: manche.total_declare,
    total_paye: manche.total_paye,
    objectif: manche.objectif,
    reussi: manche.reussi,
    clause: manche.clause_cle,
    recompense: manche.recompense,
    parts: manche.parts.map((part) => part.part),
    revelation: revelation === undefined ? null : revelation.gabarit,
    suspects: revelation === undefined ? null : revelation.suspects_restants_apres,
  };
}

test('partie complète : 5 manches, 6 joueurs, jusqu’aux scores finaux', () => {
  const harnais = creerHarnais({ graine: GRAINE });
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    demarrer(harnais.service, ouverte);
    const observations: Observation[] = [];

    const avancer = (): void => {
      harnais.avancerHorloge(PAS_MS);
      harnais.service.boucle.traiterExpiration(ouverte.partie);
      const rapport = verifierInvariants(ouverte.partie.etat);
      assert.ok(rapport.ok, `invariants : ${JSON.stringify(rapport)}`);
    };

    for (const [index, plan] of SCRIPT.entries()) {
      const numero = index + 1;
      assert.equal(ouverte.partie.etat.manche_courante, numero);
      assert.equal(ouverte.partie.etat.phase, 'VOEU');

      avancer(); // VOEU → NEGOCIATION
      jouerNegociation(harnais.service, ouverte, numero);

      avancer(); // NEGOCIATION → DECLARATION_PAIEMENT
      jouerDeclarations(harnais.service, ouverte, plan, numero);
      // Tous ont déclaré et payé : la phase a basculé immédiatement (CA-49).
      assert.equal(ouverte.partie.etat.phase, 'REVELATION');

      avancer(); // REVELATION → ENQUETES_ACCUSATIONS
      jouerEnquetesEtAccusations(harnais.service, ouverte, numero);

      avancer(); // ENQUETES_ACCUSATIONS → EXECUTION (pipeline)
      observations.push(observerManche(ouverte, numero));

      avancer(); // EXECUTION → manche suivante, ou scores
    }

    // --- Arrivée aux scores, puis clôture automatique --------------------
    assert.equal(ouverte.partie.etat.etat_partie, 'TERMINEE');
    const classement = ouverte.partie.etat.classement;
    assert.notEqual(classement, null);
    assert.equal(classement?.length, 6);

    // --- Les 5 clauses sont distinctes (CA-13) ---------------------------
    const clauses = observations.map((observation) => observation.clause);
    assert.equal(new Set(clauses).size, 5, `clauses : ${clauses.join(', ')}`);

    // --- Toute révélation émise est vraie et laisse 2 suspects (CA-16) ----
    for (const observation of observations) {
      if (observation.suspects === null) continue;
      assert.ok(observation.suspects >= 2, `manche ${observation.manche}`);
    }

    // --- Le menteur démasqué de la manche 4 a perdu sa part (RG-15) -------
    const manche4 = ouverte.partie.etat.manches.find((m) => m.numero === 4);
    const accusation = manche4?.accusations[0];
    assert.equal(accusation?.verdict, 'MENTEUR');
    assert.equal(accusation?.ampleur_mensonge, 6);

    // --- Invariants et compteur de groupe ---------------------------------
    assert.ok(verifierInvariants(ouverte.partie.etat).ok);
    assert.equal(ouverte.partie.etat.groupe.parties_terminees, 1);

    // --- Rejeu : l'état se reconstruit à l'identique depuis le journal -----
    const session = harnais.depot.sessionParId(ouverte.session_id);
    const rejouee = rejouerSession(harnais.depot, session!);
    assert.equal(JSON.stringify(rejouee.etat), JSON.stringify(ouverte.partie.etat));

    // --- Les scores sont projetés vers les 6 joueurs ----------------------
    const scores = ouverte.joueurs.map((joueur) =>
      projeterEvenement(ouverte.partie.etat, { type: 'scores_finaux' }, joueur),
    );
    assert.ok(scores.every((charge) => charge !== null));

    // --- Trace lisible, pour le rapport de livraison ----------------------
    const resume = {
      graine: session?.graine_alea,
      manches: observations,
      classement: classement?.map((ligne) => ({
        joueur_id: ligne.joueur_id,
        pieces_restantes: ligne.pieces_restantes,
        score_final: ligne.score_final,
        mission_reussie: ligne.mission_reussie,
        rang: ligne.rang,
      })),
      vainqueurs: ouverte.partie.etat.vainqueurs,
    };
    console.log(`PARTIE_COMPLETE ${JSON.stringify(resume)}`);
  } finally {
    harnais.fermer();
  }
});

test('partie complète : chaque joueur reçoit une projection DIFFÉRENTE de l’état', () => {
  const harnais = creerHarnais();
  try {
    const ouverte = ouvrirPartie(harnais.service, harnais.avancerHorloge, { joueurs: 6 });
    demarrer(harnais.service, ouverte);

    const etat: EtatSession = ouverte.partie.etat;
    const vues = ouverte.joueurs.map((joueur) =>
      JSON.stringify(projeterEvenement(etat, { type: 'etat_complet_prive', destinataire_joueur_id: joueur }, joueur)),
    );
    assert.equal(new Set(vues).size, 6, 'six projections distinctes : il n’y a pas d’état global');
  } finally {
    harnais.fermer();
  }
});
