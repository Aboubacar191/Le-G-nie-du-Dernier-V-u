// Dépôt SQLite via node:sqlite (ADR-TL-04).
//
// Fichier unique, journal WAL, foreign_keys activées, écriture transactionnelle
// par commande acceptée. Module INTÉGRÉ au runtime : zéro dépendance, zéro
// compilation native sous Windows.
//
// La durabilité n'est pas un luxe ici : groupes.parties_terminees doit survivre
// à un redémarrage (RG-50, RG-59, CA-47, CA-48), et un serveur qui redémarre en
// pleine partie ruinerait trente minutes de jeu de huit personnes assises
// ensemble, sans aucun recours — la fiabilité est au rang 2.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

import type { EtatSession } from '@gdv/moteur';

import type {
  Depot,
  EnregistrementGroupe,
  EnregistrementJoueur,
  EnregistrementSession,
  IdentiteJeton,
  LigneJournal,
} from '../depot.ts';
import { synchroniserAudit } from './audit.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const DOSSIER_MIGRATIONS = resolve(ICI, '..', '..', '..', 'migrations');
const MIGRATIONS = ['001-schema-initial.sql', '002-catalogue-clauses.sql'];
const ETATS_TERMINAUX = "('TERMINEE','ABANDONNEE')";

const bit = (valeur: boolean): number => (valeur ? 1 : 0);

interface LigneSession {
  readonly id: string;
  readonly code_adhesion: string;
  readonly groupe_id: string;
  readonly graine_alea: string;
  readonly config_json: string;
  readonly mode_avance_actif: number;
  readonly version_protocole: string;
  readonly cree_le: number;
}

function versSession(ligne: LigneSession): EnregistrementSession {
  return {
    id: ligne.id,
    code_adhesion: ligne.code_adhesion,
    groupe_id: ligne.groupe_id,
    graine_alea: ligne.graine_alea,
    config_json: ligne.config_json,
    mode_avance_actif: ligne.mode_avance_actif === 1,
    version_protocole: ligne.version_protocole,
    cree_le: ligne.cree_le,
  };
}

const COLONNES_SESSION =
  'id, code_adhesion, groupe_id, graine_alea, config_json, mode_avance_actif, ' +
  'version_protocole, cree_le';

export class DepotSqlite implements Depot {
  private readonly bdd: DatabaseSync;

  constructor(chemin: string) {
    if (chemin !== ':memory:') mkdirSync(dirname(chemin), { recursive: true });
    this.bdd = new DatabaseSync(chemin);
    this.bdd.exec('PRAGMA journal_mode = WAL');
    this.bdd.exec('PRAGMA foreign_keys = ON');
  }

  migrer(): void {
    for (const migration of MIGRATIONS) {
      this.bdd.exec(readFileSync(join(DOSSIER_MIGRATIONS, migration), 'utf8'));
    }
  }

  private transaction(action: () => void): void {
    this.bdd.exec('BEGIN');
    try {
      action();
      this.bdd.exec('COMMIT');
    } catch (erreur) {
      this.bdd.exec('ROLLBACK');
      throw erreur;
    }
  }

  creerGroupe(parametres: {
    readonly id: string;
    readonly jeton_hache: string;
    readonly maintenant: number;
  }): void {
    this.bdd
      .prepare(
        `INSERT INTO groupes (id, jeton_hote_hache, parties_terminees, dernier_voeu_debloque,
           cree_le, derniere_activite_le) VALUES (?,?,0,0,?,?)`,
      )
      .run(parametres.id, parametres.jeton_hache, parametres.maintenant, parametres.maintenant);
  }

  groupeParJeton(jetonHache: string): EnregistrementGroupe | undefined {
    const ligne = this.bdd
      .prepare('SELECT id, parties_terminees FROM groupes WHERE jeton_hote_hache = ?')
      .get(jetonHache) as EnregistrementGroupe | undefined;
    return ligne;
  }

  groupeParId(id: string): EnregistrementGroupe | undefined {
    return this.bdd
      .prepare('SELECT id, parties_terminees FROM groupes WHERE id = ?')
      .get(id) as EnregistrementGroupe | undefined;
  }

  definirPartiesTerminees(groupeId: string, parties: number): void {
    this.bdd
      .prepare(
        'UPDATE groupes SET parties_terminees = ?, dernier_voeu_debloque = ? WHERE id = ?',
      )
      .run(parties, bit(parties > 0), groupeId);
  }

  creerSession(session: EnregistrementSession): void {
    this.bdd
      .prepare(
        `INSERT INTO sessions (id, code_adhesion, groupe_id, etat_partie, config_json,
           mode_avance_actif, manche_courante, phase, phase_fin_at, graine_alea, genie_libere,
           version_protocole, sequence_journal, cree_le, termine_le)
         VALUES (?,?,?,'CREEE',?,?,0,NULL,NULL,?,NULL,?,0,?,NULL)`,
      )
      .run(
        session.id,
        session.code_adhesion,
        session.groupe_id,
        session.config_json,
        bit(session.mode_avance_actif),
        session.graine_alea,
        session.version_protocole,
        session.cree_le,
      );
  }

  sessionParCode(code: string): EnregistrementSession | undefined {
    const ligne = this.bdd
      .prepare(
        `SELECT ${COLONNES_SESSION} FROM sessions
         WHERE code_adhesion = ? AND etat_partie NOT IN ${ETATS_TERMINAUX}`,
      )
      .get(code) as LigneSession | undefined;
    return ligne === undefined ? undefined : versSession(ligne);
  }

  sessionParId(id: string): EnregistrementSession | undefined {
    const ligne = this.bdd
      .prepare(`SELECT ${COLONNES_SESSION} FROM sessions WHERE id = ?`)
      .get(id) as LigneSession | undefined;
    return ligne === undefined ? undefined : versSession(ligne);
  }

  sessionsVivantes(): readonly EnregistrementSession[] {
    const lignes = this.bdd
      .prepare(
        `SELECT ${COLONNES_SESSION} FROM sessions
         WHERE etat_partie NOT IN ${ETATS_TERMINAUX} ORDER BY cree_le`,
      )
      .all() as unknown as LigneSession[];
    return lignes.map(versSession);
  }

  ajouterJoueur(sessionId: string, joueur: EnregistrementJoueur): void {
    this.bdd
      .prepare(
        `INSERT INTO joueurs (id, session_id, pseudo, jeton_session_hache, position_cercle,
           connecte, role_secret, mission_secrete, solde_pieces, est_hote, score_activite,
           mission_reussie, score_final, ordre_arrivee, rejoint_le, derniere_activite_le)
         VALUES (?,?,?,?,NULL,1,NULL,NULL,0,?,0,NULL,NULL,?,?,?)`,
      )
      .run(
        joueur.id,
        sessionId,
        joueur.pseudo,
        joueur.jeton_hache,
        bit(joueur.est_hote),
        joueur.ordre_arrivee,
        Date.now(),
        Date.now(),
      );
  }

  joueursDe(sessionId: string): readonly EnregistrementJoueur[] {
    const lignes = this.bdd
      .prepare(
        `SELECT id, pseudo, jeton_session_hache AS jeton_hache, est_hote, ordre_arrivee
         FROM joueurs WHERE session_id = ? ORDER BY ordre_arrivee`,
      )
      .all(sessionId) as unknown as { id: string; pseudo: string; jeton_hache: string; est_hote: number; ordre_arrivee: number }[];
    return lignes.map((ligne) => ({
      id: ligne.id,
      pseudo: ligne.pseudo,
      jeton_hache: ligne.jeton_hache,
      est_hote: ligne.est_hote === 1,
      ordre_arrivee: ligne.ordre_arrivee,
    }));
  }

  identiteParJeton(jetonHache: string): IdentiteJeton | undefined {
    return this.bdd
      .prepare(
        'SELECT id AS joueur_id, session_id FROM joueurs WHERE jeton_session_hache = ?',
      )
      .get(jetonHache) as IdentiteJeton | undefined;
  }

  prochaineSequence(sessionId: string): number {
    const ligne = this.bdd
      .prepare('SELECT sequence_journal AS sequence FROM sessions WHERE id = ?')
      .get(sessionId) as { sequence: number } | undefined;
    return (ligne?.sequence ?? 0) + 1;
  }

  /**
   * Journal et audit dans la MÊME transaction : un rejeu ne peut donc jamais
   * diverger de l'état persisté (ARCHI journal_commandes.contraintes).
   */
  enregistrer(etat: EtatSession, ligne: LigneJournal): void {
    this.transaction(() => {
      this.bdd
        .prepare(
          `INSERT INTO journal_commandes (id, session_id, sequence, joueur_id, type_commande,
             charge_json, id_correlation, accepte, code_erreur, horodatage_serveur, cree_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          `${etat.session_id}:j:${ligne.sequence}`,
          etat.session_id,
          ligne.sequence,
          ligne.joueur_id,
          ligne.type_commande,
          ligne.charge_json,
          ligne.id_correlation,
          bit(ligne.accepte),
          ligne.code_erreur,
          ligne.horodatage_serveur,
          ligne.horodatage_serveur,
        );
      this.bdd
        .prepare('UPDATE sessions SET sequence_journal = ? WHERE id = ?')
        .run(ligne.sequence, etat.session_id);
      if (ligne.accepte) synchroniserAudit(this.bdd, etat);
    });
  }

  journalDe(sessionId: string): readonly LigneJournal[] {
    const lignes = this.bdd
      .prepare(
        `SELECT sequence, joueur_id, type_commande, charge_json, id_correlation, accepte,
           code_erreur, horodatage_serveur
         FROM journal_commandes WHERE session_id = ? AND accepte = 1 ORDER BY sequence`,
      )
      .all(sessionId) as unknown as (Omit<LigneJournal, 'accepte'> & { accepte: number })[];
    return lignes.map((ligne) => ({ ...ligne, accepte: ligne.accepte === 1 }));
  }

  synchroniser(etat: EtatSession): void {
    this.transaction(() => synchroniserAudit(this.bdd, etat));
  }

  fermer(): void {
    this.bdd.close();
  }
}

export function ouvrirDepot(chemin: string): Depot {
  const depot = new DepotSqlite(chemin);
  depot.migrer();
  return depot;
}
