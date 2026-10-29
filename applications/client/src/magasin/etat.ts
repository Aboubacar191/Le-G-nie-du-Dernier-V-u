// Forme de l'état local : la DERNIÈRE PROJECTION REÇUE, et rien d'autre.
//
// Le client ne calcule aucune règle, ne détient aucun secret d'autrui et ne
// filtre rien : s'il filtrait, le secret aurait déjà atteint l'appareil (RG-01).
// Il affiche ce que le serveur lui a projeté.
//
// Rien n'est persisté : etat_complet_prive REMPLACE l'état à chaque connexion
// (politique_de_rejeu : aucun rejeu, re-projection complète).

import type {
  ChargeAttributionPrivee,
  ChargeClauseRecue,
  ChargeDernierVoeuPropose,
  ChargeDernierVoeuResolu,
  ChargeExecutionResultat,
  ChargePartieAbandonnee,
  ChargeResultatEnquete,
  ChargeRevelation,
  ChargeRevelationEcartTotal,
  ChargeScoresFinaux,
  ChargeVoeuAnnonce,
  CodeErreur,
  EtatGroupe,
  EtatPartie,
  JoueurPublic,
  MoiPrive,
  PageMouvements,
  Phase,
  PretVuPartie,
  ResumeManchePublique,
  SessionPublique,
} from '@gdv/partage';

import type { EtatDecalage } from '../logique/decalage-horloge.ts';
import { decalageInitial } from '../logique/decalage-horloge.ts';
import type { EtatLiaison } from '../transport/client-ws.ts';

/** Accusation publique telle que la table la voit, verdict compris (RG-43). */
export interface AccusationVue {
  readonly accusation_id: string;
  readonly accusateur_joueur_id: string;
  readonly accuse_joueur_id: string;
  readonly numero_manche: number;
  readonly verdict: string | null;
}

/** Alerte affichable. Porte une CLÉ de contenu, jamais un texte (RG-61). */
export interface Alerte {
  readonly variante: 'information' | 'avertissement' | 'erreur' | 'succes';
  readonly cle_contenu: string;
  readonly valeurs: Readonly<Record<string, string | number>>;
  readonly code?: CodeErreur;
}

export interface EtatLocal {
  // --- session et table (public) ---------------------------------------------
  session: SessionPublique | null;
  moi: MoiPrive | null;
  joueurs: readonly JoueurPublic[];
  ordre_cercle: readonly string[];
  groupe: EtatGroupe | null;

  // --- temps (RG-72, RG-79) --------------------------------------------------
  phase: Phase | null;
  phase_fin_at: string | null;
  numero_manche: number | null;
  actions_autorisees: readonly string[];

  // --- manche en cours et historique (public) --------------------------------
  manche_courante: ResumeManchePublique | null;
  historique_manches: readonly ResumeManchePublique[];
  voeu: ChargeVoeuAnnonce | null;
  declarations: Readonly<Record<string, number>>;
  nb_declarations: number;
  ecart_total: ChargeRevelationEcartTotal | null;
  revelation: ChargeRevelation | null;
  accusations: readonly AccusationVue[];
  execution: ChargeExecutionResultat | null;

  // --- mes secrets (privés, en mémoire seulement) ----------------------------
  attribution: ChargeAttributionPrivee | null;
  /**
   * Clause reçue. Null signifie « aucun pli » — l'écran ne doit PAS varier
   * selon cette valeur avant révélation volontaire (RG-77, M7-a).
   */
  clause_recue: ChargeClauseRecue | null;
  resultats_enquete: readonly ChargeResultatEnquete[];
  mes_mouvements: PageMouvements | null;
  prets: readonly PretVuPartie[];
  paiement_scelle: boolean;
  proposition_dernier_voeu: ChargeDernierVoeuPropose | null;
  signature_scellee: boolean;

  // --- fins de partie (public) ----------------------------------------------
  dernier_voeu_resolu: ChargeDernierVoeuResolu | null;
  scores: ChargeScoresFinaux | null;
  abandon: ChargePartieAbandonnee | null;

  // --- transport -------------------------------------------------------------
  liaison: EtatLiaison;
  decalage: EtatDecalage;
  derniere_sequence: number;
  alerte: Alerte | null;
  acces_refuse: boolean;
  restitution_en_cours: boolean;
  /** Clés de contenu des événements PUBLICS manqués pendant une absence (ECR-30). */
  resume_absence: readonly Alerte[];
}

export function etatInitial(): EtatLocal {
  return {
    session: null,
    moi: null,
    joueurs: [],
    ordre_cercle: [],
    groupe: null,
    phase: null,
    phase_fin_at: null,
    numero_manche: null,
    actions_autorisees: [],
    manche_courante: null,
    historique_manches: [],
    voeu: null,
    declarations: {},
    nb_declarations: 0,
    ecart_total: null,
    revelation: null,
    accusations: [],
    execution: null,
    attribution: null,
    clause_recue: null,
    resultats_enquete: [],
    mes_mouvements: null,
    prets: [],
    paiement_scelle: false,
    proposition_dernier_voeu: null,
    signature_scellee: false,
    dernier_voeu_resolu: null,
    scores: null,
    abandon: null,
    liaison: 'inactive',
    decalage: decalageInitial(),
    derniere_sequence: 0,
    alerte: null,
    acces_refuse: false,
    restitution_en_cours: false,
    resume_absence: [],
  };
}

/** Durée de la phase courante, lue dans la configuration publique de la session. */
export function dureePhaseS(etat: EtatLocal): number | null {
  if (etat.phase === null || etat.session === null) return null;
  const config = etat.session.config as { durees_phases_s?: Record<string, number> };
  return config.durees_phases_s?.[etat.phase] ?? null;
}

/**
 * Table minimale attendue par les résolveurs de pseudo. Volontairement plus
 * étroite que EtatLocal : les écrans manipulent une vue en lecture seule
 * profonde, et un paramètre trop large les obligerait à la forcer.
 */
export interface TableDeJoueurs {
  readonly joueurs: readonly { readonly joueur_id: string; readonly pseudo: string }[];
}

/** Pseudo d'un joueur. Un identifiant non résolu reste visible, donc corrigeable. */
export const pseudoDe = (table: TableDeJoueurs, joueurId: string): string =>
  table.joueurs.find((joueur) => joueur.joueur_id === joueurId)?.pseudo ?? joueurId;

/** EtatPartie courant, ou null tant qu'aucune projection n'est arrivée. */
export const etatPartie = (etat: EtatLocal): EtatPartie | null =>
  etat.session?.etat_partie ?? null;
