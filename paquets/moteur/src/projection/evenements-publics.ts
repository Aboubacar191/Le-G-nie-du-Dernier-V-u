// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  Projecteurs des événements de classe « tous ».                        ║
// ║  « tous » signifie que la projection se trouve être IDENTIQUE pour     ║
// ║  chacun, pas qu'un objet global est diffusé : chaque message est       ║
// ║  recalculé et envoyé individuellement (ADR-TL-03).                     ║
// ║  Un message de classe tous ne peut contenir que des données classées   ║
// ║  « visible_par: tous » dans matrice_visibilite.                        ║
// ║  Couverture exigée : 100 % des lignes ET des branches.                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { exigerJoueur, joueursConnectes, mancheCourante, manchePar, ordreCercle } from '../etat/acces.ts';
import { ACTIONS_PAR_PHASE } from '../machine/manche.ts';
import { versIso } from '../horloge/iso.ts';
import type {
  EffetAccusationDeclaree,
  EffetAccusationResolue,
  EffetDeclarationPubliee,
  EffetDernierVoeuResolu,
  EffetExecutionResultat,
  EffetJoueurRejoint,
  EffetPartieAbandonnee,
  EffetPresence,
  EffetRevelation,
  EffetRevelationEcartTotal,
  EffetVoeuAnnonce,
} from '../etat/effets.ts';
import type { EtatSession } from '../etat/types.ts';
import { joueurPublic, partsPubliques } from './charges.ts';
import type { ProjectionBrute } from './evenements-prives.ts';

const AUCUN_PROPRIETAIRE: readonly string[] = [];

function publique(charge: Readonly<Record<string, unknown>>): ProjectionBrute {
  return { proprietaires: AUCUN_PROPRIETAIRE, charge };
}

export function projeterEtatPartieChange(etat: EtatSession): ProjectionBrute {
  return publique({
    etat_partie: etat.etat_partie,
    manche_courante: etat.manche_courante,
  });
}

/**
 * « x-destinataires : tous les joueurs DÉJÀ PRÉSENTS. » L'arrivant ne reçoit pas
 * l'annonce de sa propre arrivée : il reçoit un EvtEtatCompletPrive, qui la
 * contient et bien davantage. Lui envoyer les deux remettrait en plus son
 * compteur de séquence à 1 après l'avoir déjà incrémenté, et le client y verrait
 * une anomalie de séquence là où il n'y a qu'un doublon.
 */
export function projeterJoueurRejoint(
  etat: EtatSession,
  effet: EffetJoueurRejoint,
  destinataire: string,
): ProjectionBrute | null {
  if (destinataire === effet.joueur_id) return null;
  return publique({
    joueur: joueurPublic(exigerJoueur(etat, effet.joueur_id)),
    nb_joueurs: etat.joueurs.length,
  });
}

/**
 * « x-destinataires : tous les AUTRES joueurs. Le reconnecté reçoit, lui, un
 * EvtEtatCompletPrive. » Pour joueur_quitte, « tous les joueurs restants ».
 * Dans les deux cas, le sujet de l'événement n'en est pas destinataire.
 */
export function projeterPresence(
  etat: EtatSession,
  effet: EffetPresence,
  destinataire: string,
): ProjectionBrute | null {
  if (destinataire === effet.joueur_id) return null;
  return publique({
    joueur_id: effet.joueur_id,
    nb_connectes: joueursConnectes(etat).length,
  });
}

/** L'ordre des places est public : il est de toute façon visible dans la pièce. */
export function projeterPartieDemarree(etat: EtatSession): ProjectionBrute {
  return publique({
    ordre_cercle: ordreCercle(etat).map((joueur) => joueur.id),
    nb_joueurs: etat.joueurs.length,
    mode_avance_actif: etat.mode_avance_actif,
  });
}

/** RG-07 : l'objectif est annoncé publiquement. Ni la clause, ni son porteur. */
export function projeterVoeuAnnonce(
  etat: EtatSession,
  effet: EffetVoeuAnnonce,
): ProjectionBrute | null {
  const manche = manchePar(etat, effet.numero_manche);
  if (manche === undefined) return null;
  return publique({
    numero_manche: manche.numero,
    objectif: manche.objectif,
    nb_manches: etat.config.nb_manches,
  });
}

export function projeterPhaseChangee(etat: EtatSession): ProjectionBrute | null {
  if (etat.phase === null || etat.phase_fin_at === null) return null;
  return publique({
    phase: etat.phase,
    phase_fin_at: versIso(etat.phase_fin_at),
    numero_manche: etat.manche_courante,
    actions_autorisees: ACTIONS_PAR_PHASE[etat.phase],
  });
}

/** RG-31 / CA-08 : la déclaration est une ANNONCE, publiée dès sa soumission. */
export function projeterDeclarationPubliee(
  etat: EtatSession,
  effet: EffetDeclarationPubliee,
): ProjectionBrute | null {
  const manche = mancheCourante(etat);
  if (manche === undefined) return null;
  return publique({
    joueur_id: effet.joueur_id,
    montant_declare: effet.montant_declare,
    nb_declarations: manche.contributions.length,
    nb_joueurs: etat.joueurs.length,
  });
}

/** CA-14 : agrégat sur toute la table, il ne désigne personne. */
export function projeterRevelationEcartTotal(
  etat: EtatSession,
  effet: EffetRevelationEcartTotal,
): ProjectionBrute | null {
  const manche = manchePar(etat, effet.numero_manche);
  if (manche === undefined) return null;
  return publique({
    numero_manche: effet.numero_manche,
    total_declare: effet.total_declare,
    total_paye: effet.total_paye,
    objectif: manche.objectif,
  });
}

/** suspects_restants porte minimum 2 au contrat : la valeur vient du journal. */
export function projeterRevelation(effet: EffetRevelation): ProjectionBrute {
  return publique({
    numero_manche: effet.numero_manche,
    revelation: {
      gabarit: effet.revelation.gabarit,
      variante_formulation: effet.revelation.variante_formulation,
      cibles: effet.revelation.cibles,
      valeurs: effet.revelation.valeurs,
    },
    suspects_restants: effet.revelation.suspects_restants_apres,
  });
}

export function projeterAccusationDeclaree(effet: EffetAccusationDeclaree): ProjectionBrute {
  return publique({
    accusation_id: effet.accusation.id,
    accusateur_joueur_id: effet.accusation.accusateur_joueur_id,
    accuse_joueur_id: effet.accusation.accuse_joueur_id,
    numero_manche: effet.numero_manche,
  });
}

/** NE CONTIENT NI ampleur_mensonge NI montant d'amende (RG-75) : seul le verdict. */
export function projeterAccusationResolue(effet: EffetAccusationResolue): ProjectionBrute {
  return publique({
    accusation_id: effet.accusation_id,
    verdict: effet.verdict,
    liquidation_differee: true,
  });
}

/**
 * Étape 16. DEUX RESTRICTIONS tenues ici par CONSTRUCTION : aucun montant de
 * consolation individuel (seul le total agrégé sort, RG-74) et aucune identité
 * de porteur de clause (jamais en v1). Les deux champs n'existent pas dans
 * l'objet construit : il n'y a rien à retirer.
 */
/**
 * Chiffres d'une manche CLOSE. L'étape 17 les renseigne tous ; s'il en manque
 * un, la manche n'est pas dans l'état où l'étape 16 peut publier, et RIEN ne
 * sort. Un repli à zéro publierait un résultat inventé — « récompense 0 » alors
 * que le pipeline n'a pas tourné — et la table n'aurait aucun moyen de le voir.
 */
interface ChiffresManche {
  readonly total_declare: number;
  readonly total_paye: number;
  readonly reussi: boolean;
  readonly recompense: number;
  readonly multiplicateur_applique: number;
  readonly reliquat_non_distribue: number;
}

function chiffresDeMancheClose(manche: {
  readonly total_declare: number | null;
  readonly total_paye: number | null;
  readonly reussi: boolean | null;
  readonly recompense: number | null;
  readonly multiplicateur_applique: number | null;
  readonly reliquat_non_distribue: number | null;
}): ChiffresManche | null {
  const {
    total_declare,
    total_paye,
    reussi,
    recompense,
    multiplicateur_applique,
    reliquat_non_distribue,
  } = manche;
  if (
    total_declare === null ||
    total_paye === null ||
    reussi === null ||
    recompense === null ||
    multiplicateur_applique === null ||
    reliquat_non_distribue === null
  ) {
    return null;
  }
  return {
    total_declare,
    total_paye,
    reussi,
    recompense,
    multiplicateur_applique,
    reliquat_non_distribue,
  };
}

export function projeterExecutionResultat(
  etat: EtatSession,
  effet: EffetExecutionResultat,
): ProjectionBrute | null {
  const manche = manchePar(etat, effet.numero_manche);
  if (manche === undefined || !manche.cloture) return null;
  const chiffres = chiffresDeMancheClose(manche);
  if (chiffres === null) return null;
  const amendes = manche.accusations
    .filter((accusation) => accusation.liquide_at !== null)
    .map((accusation) => {
      const menteur = accusation.verdict === 'MENTEUR';
      return {
        accusation_id: accusation.id,
        debiteur_joueur_id: menteur
          ? accusation.accuse_joueur_id
          : accusation.accusateur_joueur_id,
        crediteur_joueur_id: menteur
          ? accusation.accusateur_joueur_id
          : accusation.accuse_joueur_id,
        montant_liquide: accusation.montant_amende_liquide,
        montant_du: accusation.montant_amende_du,
      };
    });

  return publique({
    numero_manche: manche.numero,
    reussi: chiffres.reussi,
    total_declare: chiffres.total_declare,
    total_paye: chiffres.total_paye,
    objectif: manche.objectif,
    recompense: chiffres.recompense,
    multiplicateur_applique: chiffres.multiplicateur_applique,
    clause_revelee: manche.clause_cle,
    effet_clause: `EFFET_${manche.clause_cle}`,
    parts: partsPubliques(manche),
    reliquat_non_distribue: chiffres.reliquat_non_distribue,
    consolation_appliquee: manche.consolation_appliquee,
    total_consolation: manche.total_consolation,
    amendes_liquidees: amendes,
    bonus_epices_verse: manche.bonus_epices_verse,
  });
}

/** RG-54 / CA-39 : le NOMBRE de signataires et la conséquence. Aucune identité. */
export function projeterDernierVoeuResolu(effet: EffetDernierVoeuResolu): ProjectionBrute {
  return publique({
    nb_signataires: effet.nb_signataires,
    consequence: effet.consequence,
    genie_libere: effet.genie_libere,
  });
}

/** RG-76 : un abandon ne révèle AUCUN secret. Le compteur n'est pas incrémenté. */
export function projeterPartieAbandonnee(effet: EffetPartieAbandonnee): ProjectionBrute {
  return publique({
    motif: effet.motif_abandon,
    compteur_groupe_incremente: false,
  });
}
