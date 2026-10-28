// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  Projection par AJOUT : chaque champ écrit ici l'est parce qu'il        ║
// ║  APPARTIENT au destinataire ou qu'il est public. Rien n'est retiré.    ║
// ║  Couverture exigée : 100 % des lignes ET des branches.                 ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// projeterVuePrivee : état complet projeté POUR UN SEUL joueur (RG-73, CA-42).
// Émis à l'authentification et à chaque reconnexion. Le client ne conserve
// aucune donnée de jeu : tout provient de cette projection, historiques
// compris, et AUCUN secret d'autrui n'y transite.
//
// Le bloc « moi » est la seule partie du message qui contient des secrets, et
// ils appartiennent tous au destinataire. Tout le reste est public.

import type {
  ChargeEtatCompletPrive,
  EtatGroupe,
  MoiPrive,
  PretVuPartie,
  ResultatEnqueteItem,
} from '@gdv/partage';

import { contributionDe, mancheCourante, trouverJoueur } from '../etat/acces.ts';
import { versIso } from '../horloge/iso.ts';
import type { EtatSession, Joueur } from '../etat/types.ts';
import {
  configPublique,
  joueursPublics,
  pageMouvements,
  pretVuPartie,
  resumeManchePublique,
} from './charges.ts';
import { destinatairesDeLaClause } from './regles-visibilite.ts';

/** Résultats d'enquête du SEUL enquêteur, sur la manche courante. */
function mesEnquetes(etat: EtatSession, joueurId: string): readonly ResultatEnqueteItem[] {
  const manche = mancheCourante(etat);
  if (manche === undefined) return [];
  return manche.enquetes
    .filter((enquete) => enquete.enqueteur_joueur_id === joueurId)
    .map((enquete) => ({
      cible_joueur_id: enquete.cible_joueur_id,
      montant_paye: enquete.resultat_montant_paye,
      manche_numero: manche.numero,
    }));
}

/** Prêts dont le destinataire est partie prenante, et eux seuls. */
function mesPrets(etat: EtatSession, joueurId: string): readonly PretVuPartie[] {
  return etat.prets
    .filter(
      (pret) =>
        pret.preteur_joueur_id === joueurId || pret.emprunteur_joueur_id === joueurId,
    )
    .map(pretVuPartie);
}

/**
 * Clause connue DU DESTINATAIRE : la sienne s'il est porteur ou
 * FAISEUR_CONTRATS, nulle sinon. La clause publique d'une manche close passe,
 * elle, par resumeManchePublique.clause_revelee.
 */
function maClause(etat: EtatSession, joueurId: string): MoiPrive['clause_connue'] {
  const manche = mancheCourante(etat);
  if (manche === undefined) return null;
  const autorises = destinatairesDeLaClause(etat, manche.porteur_clause_joueur_id);
  return autorises.includes(joueurId) ? manche.clause_cle : null;
}

function aAccuseCetteManche(etat: EtatSession, joueurId: string): boolean {
  const manche = mancheCourante(etat);
  if (manche === undefined) return false;
  return manche.accusations.some(
    (accusation) => accusation.accusateur_joueur_id === joueurId,
  );
}

function moiPrive(etat: EtatSession, joueur: Joueur): MoiPrive {
  const manche = mancheCourante(etat);
  const contribution = manche === undefined ? undefined : contributionDe(manche, joueur.id);
  const signature = etat.signatures.find((ligne) => ligne.joueur_id === joueur.id);
  return {
    joueur_id: joueur.id,
    pseudo: joueur.pseudo,
    position_cercle: joueur.position_cercle,
    est_hote: joueur.est_hote,
    solde_pieces: joueur.solde_pieces,
    role_secret: joueur.role_secret,
    mission_secrete: joueur.mission_secrete,
    clause_connue: maClause(etat, joueur.id),
    montant_declare: contribution?.montant_declare ?? null,
    montant_paye: contribution?.montant_paye ?? null,
    a_accuse_cette_manche: aAccuseCetteManche(etat, joueur.id),
    mes_enquetes_de_la_manche: mesEnquetes(etat, joueur.id),
    mes_prets: mesPrets(etat, joueur.id),
    ma_signature_dernier_voeu: signature?.a_signe ?? null,
  };
}

/** L'état du groupe est la SEULE donnée de classe hote (US-18, CA-47). */
function groupePourHote(etat: EtatSession, joueur: Joueur): EtatGroupe | null {
  if (!joueur.est_hote) return null;
  return {
    groupe_id: etat.groupe.id,
    parties_terminees: etat.groupe.parties_terminees,
    dernier_voeu_debloque: etat.groupe.parties_terminees >= etat.groupe.parties_requises,
    parties_requises: etat.groupe.parties_requises,
  };
}

/**
 * Vue privée complète. Rend null si le destinataire n'est pas de la session :
 * il n'existe aucune projection « par défaut », et un identifiant inconnu ne
 * reçoit pas une vue amputée mais RIEN du tout.
 */
export function projeterVuePrivee(
  etat: EtatSession,
  destinataire: string,
): ChargeEtatCompletPrive | null {
  const joueur = trouverJoueur(etat, destinataire);
  if (joueur === undefined) return null;

  const courante = mancheCourante(etat);
  return {
    session: {
      session_id: etat.session_id,
      code_adhesion: etat.code_adhesion,
      etat_partie: etat.etat_partie,
      mode_avance_actif: etat.mode_avance_actif,
      config: configPublique(etat.config),
    },
    moi: moiPrive(etat, joueur),
    joueurs: joueursPublics(etat),
    manche_courante: courante === undefined ? null : resumeManchePublique(courante),
    phase: etat.phase,
    phase_fin_at: etat.phase_fin_at === null ? null : versIso(etat.phase_fin_at),
    historique_manches: etat.manches
      .filter((manche) => manche.cloture)
      .map(resumeManchePublique),
    mes_mouvements: pageMouvements(etat, destinataire),
    groupe: groupePourHote(etat, joueur),
  };
}

export type ProjeterVuePrivee = typeof projeterVuePrivee;
