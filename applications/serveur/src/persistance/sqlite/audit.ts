// Projection d'AUDIT des tables normalisées (ADR-TL-05).
//
// Ces tables ne sont JAMAIS relues pour reconstruire un état : la
// reconstruction se fait par rejeu du journal. Elles existent pour que le QA et
// l'exploitation puissent interroger une partie en SQL, et surtout pour que
// RG-42 — solde = somme des mouvements — soit vérifiable par une requête
// plutôt que par une relecture de code.
//
// La synchronisation est un remplacement complet des lignes filles de la
// session, dans une transaction. Au volume de ce jeu — 8 joueurs, 5 manches,
// quelques centaines de lignes — c'est plus sûr qu'un diff incrémental, qui
// aurait besoin d'avoir raison à chaque fois pour ne pas mentir.

import type { DatabaseSync } from 'node:sqlite';

import type { EtatSession, Manche } from '@gdv/moteur';

const bit = (valeur: boolean): number => (valeur ? 1 : 0);
const bitOuNul = (valeur: boolean | null): number | null =>
  valeur === null ? null : bit(valeur);

const TABLES_FILLES_PAR_MANCHE = ['contributions', 'revelations', 'enquetes', 'accusations'];
const TABLES_FILLES_PAR_SESSION = [
  'manches',
  'mouvements_pieces',
  'prets',
  'signatures_dernier_voeu',
];

function purger(bdd: DatabaseSync, sessionId: string): void {
  for (const table of TABLES_FILLES_PAR_MANCHE) {
    bdd
      .prepare(
        `DELETE FROM ${table} WHERE manche_id IN (SELECT id FROM manches WHERE session_id = ?)`,
      )
      .run(sessionId);
  }
  for (const table of TABLES_FILLES_PAR_SESSION) {
    bdd.prepare(`DELETE FROM ${table} WHERE session_id = ?`).run(sessionId);
  }
}

function ecrireSession(bdd: DatabaseSync, etat: EtatSession): void {
  bdd
    .prepare(
      `UPDATE sessions SET etat_partie = ?, mode_avance_actif = ?, manche_courante = ?,
         phase = ?, phase_fin_at = ?, genie_libere = ?, termine_le = ? WHERE id = ?`,
    )
    .run(
      etat.etat_partie,
      bit(etat.mode_avance_actif),
      etat.manche_courante,
      etat.phase,
      etat.phase_fin_at,
      bitOuNul(etat.genie_libere),
      etat.termine_le,
      etat.session_id,
    );
}

function ecrireJoueurs(bdd: DatabaseSync, etat: EtatSession): void {
  const requete = bdd.prepare(
    `UPDATE joueurs SET position_cercle = ?, connecte = ?, role_secret = ?, mission_secrete = ?,
       solde_pieces = ?, score_activite = ?, mission_reussie = ?, score_final = ?,
       derniere_activite_le = ? WHERE id = ?`,
  );
  for (const joueur of etat.joueurs) {
    requete.run(
      joueur.position_cercle,
      bit(joueur.connecte),
      joueur.role_secret,
      joueur.mission_secrete,
      joueur.solde_pieces,
      joueur.score_activite,
      bitOuNul(joueur.mission_reussie),
      joueur.score_final,
      etat.cree_le,
      joueur.id,
    );
  }
}

function identifiantManche(sessionId: string, numero: number): string {
  return `${sessionId}:manche:${numero}`;
}

function ecrireUneManche(bdd: DatabaseSync, sessionId: string, manche: Manche): void {
  bdd
    .prepare(
      `INSERT INTO manches (id, session_id, numero, objectif, clause_cle,
         porteur_clause_joueur_id, total_declare, total_paye, reussi, recompense,
         multiplicateur_applique, facteur_amende, reliquat_non_distribue,
         consolation_appliquee, total_consolation, bonus_epices_verse, cloture, cloture_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      identifiantManche(sessionId, manche.numero),
      sessionId,
      manche.numero,
      manche.objectif,
      manche.clause_cle,
      manche.porteur_clause_joueur_id,
      manche.total_declare,
      manche.total_paye,
      bitOuNul(manche.reussi),
      manche.recompense,
      manche.multiplicateur_applique,
      manche.facteur_amende,
      manche.reliquat_non_distribue,
      bit(manche.consolation_appliquee),
      manche.total_consolation,
      bit(manche.bonus_epices_verse),
      bit(manche.cloture),
      manche.cloture_at,
    );
}

function ecrireContributions(bdd: DatabaseSync, mancheId: string, manche: Manche): void {
  const requete = bdd.prepare(
    `INSERT INTO contributions (id, manche_id, joueur_id, montant_declare, montant_paye,
       declare_at, paye_at) VALUES (?,?,?,?,?,?,?)`,
  );
  for (const contribution of manche.contributions) {
    requete.run(
      `${mancheId}:c:${contribution.joueur_id}`,
      mancheId,
      contribution.joueur_id,
      contribution.montant_declare,
      contribution.montant_paye,
      contribution.declare_at,
      contribution.paye_at,
    );
  }
}

function ecrireRevelations(bdd: DatabaseSync, mancheId: string, manche: Manche): void {
  const requete = bdd.prepare(
    `INSERT INTO revelations (id, manche_id, gabarit, variante_formulation, cibles_json,
       valeurs_json, suspects_restants_apres, verifiee_vraie, emise_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  for (const revelation of manche.revelations) {
    requete.run(
      revelation.id,
      mancheId,
      revelation.gabarit,
      revelation.variante_formulation,
      JSON.stringify(revelation.cibles),
      JSON.stringify(revelation.valeurs),
      revelation.suspects_restants_apres,
      bit(revelation.verifiee_vraie),
      revelation.emise_at,
    );
  }
}

function ecrireEnquetes(bdd: DatabaseSync, mancheId: string, manche: Manche): void {
  const requete = bdd.prepare(
    `INSERT INTO enquetes (id, manche_id, enqueteur_joueur_id, cible_joueur_id, cout_paye,
       resultat_montant_paye, cree_at) VALUES (?,?,?,?,?,?,?)`,
  );
  for (const enquete of manche.enquetes) {
    requete.run(
      enquete.id,
      mancheId,
      enquete.enqueteur_joueur_id,
      enquete.cible_joueur_id,
      enquete.cout_paye,
      enquete.resultat_montant_paye,
      enquete.cree_at,
    );
  }
}

function ecrireAccusations(bdd: DatabaseSync, mancheId: string, manche: Manche): void {
  const requete = bdd.prepare(
    `INSERT INTO accusations (id, manche_id, accusateur_joueur_id, accuse_joueur_id, verdict,
       ampleur_mensonge, montant_amende_du, montant_amende_liquide, liquide_at, cree_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const accusation of manche.accusations) {
    requete.run(
      accusation.id,
      mancheId,
      accusation.accusateur_joueur_id,
      accusation.accuse_joueur_id,
      accusation.verdict,
      accusation.ampleur_mensonge,
      accusation.montant_amende_du,
      accusation.montant_amende_liquide,
      accusation.liquide_at,
      accusation.cree_at,
    );
  }
}

function ecrireManches(bdd: DatabaseSync, etat: EtatSession): void {
  for (const manche of etat.manches) {
    const mancheId = identifiantManche(etat.session_id, manche.numero);
    ecrireUneManche(bdd, etat.session_id, manche);
    ecrireContributions(bdd, mancheId, manche);
    ecrireRevelations(bdd, mancheId, manche);
    ecrireEnquetes(bdd, mancheId, manche);
    ecrireAccusations(bdd, mancheId, manche);
  }
}

function ecrireMouvements(bdd: DatabaseSync, etat: EtatSession): void {
  const requete = bdd.prepare(
    `INSERT INTO mouvements_pieces (id, session_id, manche_numero, joueur_id, delta, motif,
       contrepartie_joueur_id, solde_apres, sequence, cree_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const mouvement of etat.mouvements) {
    requete.run(
      mouvement.id,
      etat.session_id,
      mouvement.manche_numero,
      mouvement.joueur_id,
      mouvement.delta,
      mouvement.motif,
      mouvement.contrepartie_joueur_id,
      mouvement.solde_apres,
      mouvement.sequence,
      mouvement.cree_at,
    );
  }
}

function ecrirePrets(bdd: DatabaseSync, etat: EtatSession): void {
  const requete = bdd.prepare(
    `INSERT INTO prets (id, session_id, preteur_joueur_id, emprunteur_joueur_id, principal,
       du_total, rembourse, manche_emission, statut, cree_at, repondu_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const pret of etat.prets) {
    requete.run(
      pret.id,
      etat.session_id,
      pret.preteur_joueur_id,
      pret.emprunteur_joueur_id,
      pret.principal,
      pret.du_total,
      pret.rembourse,
      pret.manche_emission,
      pret.statut,
      pret.cree_at,
      pret.repondu_at,
    );
  }
}

function ecrireSignatures(bdd: DatabaseSync, etat: EtatSession): void {
  const requete = bdd.prepare(
    `INSERT INTO signatures_dernier_voeu (id, session_id, joueur_id, a_signe, cree_at)
     VALUES (?,?,?,?,?)`,
  );
  for (const signature of etat.signatures) {
    requete.run(
      `${etat.session_id}:dv:${signature.joueur_id}`,
      etat.session_id,
      signature.joueur_id,
      bitOuNul(signature.a_signe),
      signature.cree_at,
    );
  }
}

/** Remplace l'intégralité de la projection d'audit de la session. */
export function synchroniserAudit(bdd: DatabaseSync, etat: EtatSession): void {
  purger(bdd, etat.session_id);
  ecrireSession(bdd, etat);
  ecrireJoueurs(bdd, etat);
  ecrireManches(bdd, etat);
  ecrireMouvements(bdd, etat);
  ecrirePrets(bdd, etat);
  ecrireSignatures(bdd, etat);
}
