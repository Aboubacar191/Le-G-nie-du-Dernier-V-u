// Interface du dépôt — abstraction du moteur de stockage.
//
// Le serveur ne parle jamais SQL ailleurs que dans src/persistance/sqlite :
// c'est ce qui permet de tester l'orchestration sans fichier de base, et de
// changer de moteur de stockage sans toucher au reste.
//
// Deux rôles bien distincts, et c'est ADR-TL-05 qui les sépare :
//   · le JOURNAL DE COMMANDES est la source de RECONSTRUCTION. L'état d'une
//     session se rejoue depuis (graine, configuration, joueurs, journal).
//   · les tables normalisées sont une PROJECTION D'AUDIT : elles servent la
//     lecture, le QA et la vérification de RG-42 par requête. Elles ne sont
//     jamais relues pour reconstruire un état.

import type { EtatSession } from '@gdv/moteur';

export interface EnregistrementGroupe {
  readonly id: string;
  readonly parties_terminees: number;
}

export interface EnregistrementJoueur {
  readonly id: string;
  readonly pseudo: string;
  readonly jeton_hache: string;
  readonly est_hote: boolean;
  readonly ordre_arrivee: number;
}

export interface EnregistrementSession {
  readonly id: string;
  readonly code_adhesion: string;
  readonly groupe_id: string;
  readonly graine_alea: string;
  readonly config_json: string;
  readonly mode_avance_actif: boolean;
  readonly version_protocole: string;
  readonly cree_le: number;
}

export interface LigneJournal {
  readonly sequence: number;
  readonly joueur_id: string | null;
  readonly type_commande: string;
  readonly charge_json: string;
  readonly id_correlation: string | null;
  readonly accepte: boolean;
  readonly code_erreur: string | null;
  readonly horodatage_serveur: number;
}

export interface IdentiteJeton {
  readonly joueur_id: string;
  readonly session_id: string;
}

export interface Depot {
  migrer(): void;

  creerGroupe(parametres: { readonly id: string; readonly jeton_hache: string; readonly maintenant: number }): void;
  groupeParJeton(jetonHache: string): EnregistrementGroupe | undefined;
  groupeParId(id: string): EnregistrementGroupe | undefined;
  definirPartiesTerminees(groupeId: string, parties: number): void;

  creerSession(session: EnregistrementSession): void;
  sessionParCode(code: string): EnregistrementSession | undefined;
  sessionParId(id: string): EnregistrementSession | undefined;
  sessionsVivantes(): readonly EnregistrementSession[];

  ajouterJoueur(sessionId: string, joueur: EnregistrementJoueur): void;
  joueursDe(sessionId: string): readonly EnregistrementJoueur[];
  identiteParJeton(jetonHache: string): IdentiteJeton | undefined;

  /** Écrit la ligne de journal ET la projection d'audit dans la MÊME transaction. */
  enregistrer(etat: EtatSession, ligne: LigneJournal): void;
  journalDe(sessionId: string): readonly LigneJournal[];
  prochaineSequence(sessionId: string): number;

  /** Projection d'audit seule, pour les transitions sans commande journalisée. */
  synchroniser(etat: EtatSession): void;

  fermer(): void;
}
