// État d'une session — types.
//
// L'état est détenu par le serveur et n'est JAMAIS émis tel quel : tout ce qui
// sort passe par paquets/moteur/src/projection (ADR-TL-09). Les secrets vivent
// donc ici sans précaution particulière, et nulle part ailleurs.
//
// Transcrit de ARCHI-GDV-001.json / modele_donnees. Un seul écart, assumé et
// motivé : la phase courante est portée au niveau de la SESSION et non de la
// manche, parce que les quatre phases du Dernier Vœu n'appartiennent à aucune
// manche. Deux champs de phase seraient deux vérités.

import type {
  Clause,
  CodeErreur,
  ConfigJeu,
  EtatPartie,
  Gabarit,
  Mission,
  MotifMouvement,
  Phase,
  Role,
  StatutPret,
  Verdict,
} from '@gdv/partage';

import type { Alea } from '../alea/interface.ts';
import type { Horloge } from '../horloge/interface.ts';

export interface Joueur {
  readonly id: string;
  readonly pseudo: string;
  readonly est_hote: boolean;
  readonly position_cercle: number | null;
  readonly connecte: boolean;
  readonly role_secret: Role | null;
  readonly mission_secrete: Mission | null;
  readonly solde_pieces: number;
  readonly score_activite: number;
  readonly mission_reussie: boolean | null;
  readonly score_final: number | null;
}

export interface Contribution {
  readonly joueur_id: string;
  /**
   * NON nullable, à la différence de la colonne SQL homonyme : dans le moteur,
   * une contribution n'EXISTE qu'à partir de la déclaration. « Non déclaré » se
   * dit par l'ABSENCE d'enregistrement, pas par un nul — et un état impossible
   * en moins est une branche invérifiable en moins sur la frontière de
   * sécurité. La matérialisation à 0 de l'expiration (RG-32) crée la ligne.
   */
  readonly montant_declare: number;
  readonly montant_paye: number | null;
  readonly declare_at: number | null;
  readonly paye_at: number | null;
}

export interface Enquete {
  readonly id: string;
  readonly enqueteur_joueur_id: string;
  readonly cible_joueur_id: string;
  readonly cout_paye: number;
  readonly resultat_montant_paye: number;
  readonly resultat_montant_declare: number;
  readonly cree_at: number;
}

export interface Accusation {
  readonly id: string;
  readonly accusateur_joueur_id: string;
  readonly accuse_joueur_id: string;
  readonly verdict: Verdict;
  readonly ampleur_mensonge: number;
  readonly montant_amende_du: number;
  readonly montant_amende_liquide: number;
  readonly liquide_at: number | null;
  readonly cree_at: number;
}

export interface RevelationEmise {
  readonly id: string;
  readonly gabarit: Gabarit;
  readonly variante_formulation: number;
  readonly cibles: readonly string[];
  readonly valeurs: Readonly<Record<string, number>>;
  readonly suspects_restants_apres: number;
  readonly verifiee_vraie: boolean;
  readonly emise_at: number;
}

export interface PartManche {
  readonly joueur_id: string;
  readonly part: number;
  readonly exclu_du_partage: boolean;
}

export interface Manche {
  readonly numero: number;
  readonly objectif: number;
  readonly clause_cle: Clause;
  readonly porteur_clause_joueur_id: string;
  readonly contributions: readonly Contribution[];
  readonly enquetes: readonly Enquete[];
  readonly accusations: readonly Accusation[];
  readonly revelations: readonly RevelationEmise[];
  readonly total_declare: number | null;
  readonly total_paye: number | null;
  readonly reussi: boolean | null;
  readonly recompense: number | null;
  readonly multiplicateur_applique: number | null;
  readonly facteur_amende: number | null;
  readonly parts: readonly PartManche[];
  readonly reliquat_non_distribue: number | null;
  readonly consolation_appliquee: boolean;
  readonly total_consolation: number | null;
  readonly bonus_epices_verse: boolean;
  readonly cloture: boolean;
  readonly cloture_at: number | null;
}

export interface Mouvement {
  readonly id: string;
  readonly joueur_id: string;
  readonly manche_numero: number | null;
  readonly delta: number;
  readonly motif: MotifMouvement;
  readonly contrepartie_joueur_id: string | null;
  readonly solde_apres: number;
  readonly sequence: number;
  readonly cree_at: number;
}

export interface Pret {
  readonly id: string;
  readonly preteur_joueur_id: string;
  readonly emprunteur_joueur_id: string;
  readonly principal: number;
  readonly du_total: number;
  readonly rembourse: number;
  readonly manche_emission: number;
  readonly statut: StatutPret;
  readonly cree_at: number;
  readonly repondu_at: number | null;
}

export interface SignatureDernierVoeu {
  readonly joueur_id: string;
  readonly a_signe: boolean | null;
  readonly cree_at: number;
}

export interface EtatGroupeSession {
  readonly id: string;
  readonly parties_terminees: number;
  readonly parties_requises: number;
}

export interface LigneClassementInterne {
  readonly joueur_id: string;
  readonly pieces_restantes: number;
  readonly score_final: number;
  readonly mission_reussie: boolean;
  readonly rang: number;
}

export interface EtatSession {
  readonly session_id: string;
  readonly code_adhesion: string;
  readonly etat_partie: EtatPartie;
  readonly config: ConfigJeu;
  readonly mode_avance_actif: boolean;
  readonly manche_courante: number;
  readonly phase: Phase | null;
  readonly phase_fin_at: number | null;
  readonly joueurs: readonly Joueur[];
  readonly manches: readonly Manche[];
  readonly prets: readonly Pret[];
  readonly mouvements: readonly Mouvement[];
  readonly signatures: readonly SignatureDernierVoeu[];
  /** Clauses encore tirables : le tirage est SANS REMISE (RG-18, CA-13). */
  readonly clauses_disponibles: readonly Clause[];
  readonly genie_libere: boolean | null;
  readonly classement: readonly LigneClassementInterne[] | null;
  readonly vainqueurs: readonly string[];
  readonly groupe: EtatGroupeSession;
  readonly cree_le: number;
  readonly termine_le: number | null;
}

export interface ErreurMetier {
  readonly code: CodeErreur;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Contexte d'appel : tout ce que le moteur ne peut pas produire lui-même.
 * L'aléa, l'horloge et la génération d'identifiants entrent par injection —
 * c'est la condition du déterminisme et du rejeu (ADR-TL-08, RG-72).
 */
export interface ContexteMoteur {
  readonly alea: Alea;
  readonly horloge: Horloge;
  /** Fabrique d'identifiants, injectée : crypto est banni du moteur. */
  readonly identifiant: () => string;
  /** Identité de l'émetteur, DÉDUITE de la connexion authentifiée (CA-44). */
  readonly auteur_joueur_id?: string;
  readonly id_correlation?: string;
}

export interface RapportInvariants {
  readonly solde_negatif: readonly string[];
  readonly solde_incoherent: readonly string[];
  readonly ok: boolean;
}

/**
 * Invariants monétaires, vérifiables à tout instant (RG-41, RG-42, CA-32).
 *
 * Rendus sous forme de RAPPORT et non d'exception : le QA doit pouvoir les
 * évaluer sur un état quelconque sans faire échouer le moteur, et un rapport se
 * lit dans une sortie de test là où une exception masque les autres joueurs en
 * défaut.
 *
 * La fonction vit à côté du type qu'elle produit, et non dans l'index : c'est
 * le seul endroit où RapportInvariants a un sens.
 */
export function verifierInvariants(etat: EtatSession): RapportInvariants {
  const negatifs: string[] = [];
  const incoherents: string[] = [];
  for (const joueur of etat.joueurs) {
    if (joueur.solde_pieces < 0) negatifs.push(joueur.id);
    let cumul = 0;
    for (const mouvement of etat.mouvements) {
      if (mouvement.joueur_id === joueur.id) cumul += mouvement.delta;
    }
    if (cumul !== joueur.solde_pieces) incoherents.push(joueur.id);
  }
  return {
    solde_negatif: negatifs,
    solde_incoherent: incoherents,
    ok: negatifs.length === 0 && incoherents.length === 0,
  };
}
