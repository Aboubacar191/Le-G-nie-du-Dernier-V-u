// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  Projecteurs des événements NON publics : classes proprietaire,        ║
// ║  enqueteur, porteur_clause_et_faiseur et hote.                         ║
// ║  Chacun déclare ses PROPRIÉTAIRES ; c'est appartientALaClasse qui      ║
// ║  tranche, avec la classe que déclare le CONTRAT. Un projecteur ne      ║
// ║  décide jamais seul qui a le droit de recevoir.                        ║
// ║  Couverture exigée : 100 % des lignes ET des branches.                 ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { trouverJoueur } from '../etat/acces.ts';
import { versIso } from '../horloge/iso.ts';
import type {
  EffetAccuseReception,
  EffetAttributionPrivee,
  EffetClauseRecue,
  EffetDernierVoeuPropose,
  EffetErreur,
  EffetEtatCompletPrive,
  EffetGroupeMisAJour,
  EffetPaiementEnregistre,
  EffetPretPreleve,
  EffetPretPropose,
  EffetPretResolu,
  EffetResultatEnquete,
  EffetSoldeMisAJour,
  EffetTransfertEnregistre,
} from '../etat/effets.ts';
import type { EtatSession } from '../etat/types.ts';
import { pageMouvements, pretVuPartie } from './charges.ts';
import { destinatairesDeLaClause } from './regles-visibilite.ts';
import { projeterVuePrivee } from './vue-privee.ts';

export interface ProjectionBrute {
  readonly proprietaires: readonly string[];
  readonly charge: Readonly<Record<string, unknown>>;
}

export function projeterAccuseReception(effet: EffetAccuseReception): ProjectionBrute {
  return {
    proprietaires: [effet.auteur_joueur_id],
    charge: {
      id_correlation: effet.id_correlation,
      type_commande: effet.type_commande,
      accepte: true,
    },
  };
}

/** Un refus révèle une TENTATIVE : il ne part qu'à son auteur (x-visibilite). */
export function projeterErreur(effet: EffetErreur): ProjectionBrute {
  return {
    proprietaires: [effet.auteur_joueur_id],
    charge: {
      code: effet.code,
      message: effet.message,
      details: null,
      id_correlation: effet.id_correlation,
    },
  };
}

export function projeterEtatCompletPrive(
  etat: EtatSession,
  effet: EffetEtatCompletPrive,
): ProjectionBrute | null {
  const charge = projeterVuePrivee(etat, effet.destinataire_joueur_id);
  if (charge === null) return null;
  return {
    proprietaires: [effet.destinataire_joueur_id],
    charge: charge as unknown as Readonly<Record<string, unknown>>,
  };
}

/**
 * US-04 / CA-05 : un message par joueur, ne contenant que SA propre
 * attribution. Il n'existe aucune variante listant plusieurs joueurs.
 */
export function projeterAttributionPrivee(
  etat: EtatSession,
  effet: EffetAttributionPrivee,
): ProjectionBrute | null {
  const joueur = trouverJoueur(etat, effet.joueur_id);
  if (joueur === undefined || joueur.role_secret === null) return null;
  return {
    proprietaires: [effet.joueur_id],
    charge: {
      role_secret: joueur.role_secret,
      mission_secrete: joueur.mission_secrete,
      solde_initial: etat.config.pieces_initiales,
    },
  };
}

/**
 * CA-12 : la clause est reçue par le porteur et par tout FAISEUR_CONTRATS, et
 * par personne d'autre. je_suis_porteur parle du DESTINATAIRE et ne désigne
 * jamais un autre joueur : l'identité du porteur n'est révélée à personne.
 */
export function projeterClauseRecue(
  etat: EtatSession,
  effet: EffetClauseRecue,
  destinataire: string,
): ProjectionBrute {
  return {
    proprietaires: destinatairesDeLaClause(etat, effet.porteur_joueur_id),
    charge: {
      clause: effet.clause,
      numero_manche: effet.numero_manche,
      je_suis_porteur: destinataire === effet.porteur_joueur_id,
    },
  };
}

/** Aucun montant, même pour son propriétaire : un champ en moins est une fuite en moins. */
export function projeterPaiementEnregistre(effet: EffetPaiementEnregistre): ProjectionBrute {
  return {
    proprietaires: [effet.joueur_id],
    charge: { numero_manche: effet.numero_manche, enregistre: true },
  };
}

export function projeterTransfertEnregistre(effet: EffetTransfertEnregistre): ProjectionBrute {
  return {
    proprietaires: [effet.emetteur_joueur_id, effet.destinataire_joueur_id],
    charge: {
      emetteur_joueur_id: effet.emetteur_joueur_id,
      destinataire_joueur_id: effet.destinataire_joueur_id,
      montant: effet.montant,
    },
  };
}

function partiesDuPret(pret: {
  readonly preteur_joueur_id: string;
  readonly emprunteur_joueur_id: string;
}): readonly string[] {
  return [pret.preteur_joueur_id, pret.emprunteur_joueur_id];
}

export function projeterPretPropose(effet: EffetPretPropose): ProjectionBrute {
  return {
    proprietaires: partiesDuPret(effet.pret),
    charge: { pret: pretVuPartie(effet.pret) },
  };
}

export function projeterPretResolu(effet: EffetPretResolu): ProjectionBrute {
  return {
    proprietaires: partiesDuPret(effet.pret),
    charge: { pret: pretVuPartie(effet.pret), accepte: effet.accepte },
  };
}

/**
 * DEUX variantes nommées au contrat (x-charge-par-destinataire), et non une
 * charge complète dont certains champs seraient mis à null — ADR-TL-22, ANO-07.
 *
 * La conjonction montant_preleve et reliquat_du livre le solde EXACT de
 * l'emprunteur : dès que le reliquat dû est non nul, le montant prélevé EST le
 * solde de l'emprunteur. Le prêteur reçoit donc la variante RÉDUITE
 * {numero_manche, pret_id, statut} — pas la variante complète amputée. La
 * distinction n'est pas cosmétique : une charge aux six clés dont trois valent
 * null est l'« ensemble intermédiaire » que (P-c) déclare défaut bloquant, et
 * c'est la trace du développeur qui vide la charge par soustraction. Ici chaque
 * variante est ÉCRITE, donc un champ ajouté demain n'apparaît dans aucune des
 * deux sans décision.
 */
export function projeterPretPreleve(
  effet: EffetPretPreleve,
  destinataire: string,
): ProjectionBrute {
  const proprietaires = partiesDuPret(effet.pret);
  if (destinataire === effet.pret.emprunteur_joueur_id) {
    return {
      proprietaires,
      charge: {
        numero_manche: effet.pret.manche_emission,
        pret_id: effet.pret.id,
        statut: effet.pret.statut,
        pret: pretVuPartie(effet.pret),
        montant_preleve: effet.montant_preleve,
        reliquat_du: effet.reliquat_du,
      },
    };
  }
  return {
    proprietaires,
    charge: {
      numero_manche: effet.pret.manche_emission,
      pret_id: effet.pret.id,
      statut: effet.pret.statut,
    },
  };
}

/**
 * RG-27 / CA-19 : le résultat ne part qu'à l'enquêteur. Aucun message n'est émis
 * vers la cible ni vers la table, ni maintenant ni plus tard — c'est ce qui
 * rend le chantage possible.
 */
export function projeterResultatEnquete(effet: EffetResultatEnquete): ProjectionBrute {
  return {
    proprietaires: [effet.enqueteur_joueur_id],
    charge: {
      cible_joueur_id: effet.cible_joueur_id,
      montant_paye: effet.montant_paye,
      montant_declare: effet.montant_declare,
      cout_paye: effet.cout_paye,
      numero_manche: effet.numero_manche,
    },
  };
}

/** CA-36 : ne contient QUE le solde du destinataire et SES propres mouvements. */
export function projeterSoldeMisAJour(
  etat: EtatSession,
  effet: EffetSoldeMisAJour,
): ProjectionBrute | null {
  const joueur = trouverJoueur(etat, effet.joueur_id);
  if (joueur === undefined) return null;
  return {
    proprietaires: [effet.joueur_id],
    charge: {
      solde_pieces: joueur.solde_pieces,
      derniers_mouvements: pageMouvements(etat, effet.joueur_id),
    },
  };
}

export function projeterDernierVoeuPropose(
  etat: EtatSession,
  effet: EffetDernierVoeuPropose,
): ProjectionBrute | null {
  if (etat.phase_fin_at === null) return null;
  return {
    proprietaires: [effet.joueur_id],
    charge: {
      montant_propose: etat.config.recompense_signature_dernier_voeu,
      phase_fin_at: versIso(etat.phase_fin_at),
    },
  };
}

/** Seul événement de classe hote (US-18, CA-47). */
export function projeterGroupeMisAJour(
  etat: EtatSession,
  _effet: EffetGroupeMisAJour,
): ProjectionBrute {
  return {
    proprietaires: etat.joueurs.filter((joueur) => joueur.est_hote).map((joueur) => joueur.id),
    charge: {
      groupe: {
        groupe_id: etat.groupe.id,
        parties_terminees: etat.groupe.parties_terminees,
        dernier_voeu_debloque: etat.groupe.parties_terminees >= etat.groupe.parties_requises,
        parties_requises: etat.groupe.parties_requises,
      },
    },
  };
}
