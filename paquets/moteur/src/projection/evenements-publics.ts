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
import { joueurPublic } from './charges.ts';
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
 * Émis à TOUS, L'ARRIVANT COMPRIS (RUP-02, RG-80).
 *
 * La version précédente excluait le sujet de l'événement — « tous les joueurs
 * DÉJÀ PRÉSENTS » — au motif qu'il recevait de toute façon un
 * EvtEtatCompletPrive. Un destinataire de moins est une trame de moins, donc une
 * divergence de dénombrement, et le dénombrement est la dimension que l'audit a
 * mesurée en fuite. Le second motif invoqué — « lui envoyer les deux remettrait
 * son compteur de séquence à 1 » — a DISPARU avec RUP-01 : la séquence est
 * désormais portée par la session et n'est jamais remise à 1.
 *
 * L'état de connexion est classé visible_par: tous par matrice_visibilite : la
 * charge est donc identique pour les N destinataires, l'arrivant compris, et
 * x-emission vaut uniforme_charge_identique.
 */
export function projeterJoueurRejoint(
  etat: EtatSession,
  effet: EffetJoueurRejoint,
): ProjectionBrute {
  return publique({
    joueur: joueurPublic(exigerJoueur(etat, effet.joueur_id)),
    nb_joueurs: etat.joueurs.length,
  });
}

/**
 * Émis à TOUS, LE JOUEUR CONCERNÉ COMPRIS (RUP-02, RG-80) — et non plus « à
 * tous les autres ». Même raison que ci-dessus : un destinataire de moins est
 * une trame de moins. L'état de connexion est public.
 */
export function projeterPresence(
  etat: EtatSession,
  effet: EffetPresence,
): ProjectionBrute {
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

/**
 * suspects_restants porte minimum 2 au contrat : la valeur vient du journal.
 *
 * RUP-02, x-emission = uniforme_par_manche. L'événement est émis à CHAQUE manche
 * en phase REVELATION, y compris quand AUCUN gabarit n'est éligible (CA-15) ;
 * la charge est alors la variante neutre {numero_manche}. L'absence précédente
 * ne discriminait aucun joueur — elle était la même pour les N — mais elle
 * révélait la CONDITION qui la déclenche, c'est-à-dire l'état de l'ensemble des
 * suspects : c'est RG-81, et RG-80 énonce de son côté qu'un champ ne peut pas
 * être publié dans certaines manches et omis dans d'autres. Le coût de la
 * fermeture étant nul, elle est faite ici.
 */
export function projeterRevelation(effet: EffetRevelation): ProjectionBrute {
  if (effet.revelation === null) {
    return publique({ numero_manche: effet.numero_manche });
  }
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
}

function chiffresDeMancheClose(manche: {
  readonly total_declare: number | null;
  readonly total_paye: number | null;
  readonly reussi: boolean | null;
  readonly recompense: number | null;
  readonly multiplicateur_applique: number | null;
}): ChiffresManche | null {
  const {
    total_declare,
    total_paye,
    reussi,
    recompense,
    multiplicateur_applique,
  } = manche;
  if (
    total_declare === null ||
    total_paye === null ||
    reussi === null ||
    recompense === null ||
    multiplicateur_applique === null
  ) {
    return null;
  }
  return {
    total_declare,
    total_paye,
    reussi,
    recompense,
    multiplicateur_applique,
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
    consolation_appliquee: manche.consolation_appliquee,
    amendes_liquidees: amendes,
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
