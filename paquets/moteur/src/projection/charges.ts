// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  Construction par AJOUT : chaque fonction de ce fichier énumère les    ║
// ║  champs qu'elle a le droit d'écrire. Un champ ajouté plus tard à une   ║
// ║  entité est ABSENT par défaut, et c'est tout l'intérêt.                ║
// ║  Couverture exigée : 100 % des lignes ET des branches.                 ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Objets de charge partagés par la vue privée et par les événements. Ils sont
// construits ici une seule fois pour que la liste blanche n'existe qu'en un
// endroit : deux listes blanches, c'est une qui sera oubliée.

import type {
  ConfigJeu,
  DeclarationPublique,
  AccusationPublique,
  JoueurPublic,
  MouvementPiece,
  PageMouvements,
  PretVuPartie,
  ResumeManchePublique,
  RevelationPublique,
} from '@gdv/partage';

import { versIso } from '../horloge/iso.ts';
import type { EtatSession, Joueur, Manche, Mouvement, Pret } from '../etat/types.ts';

/** Pagination (ARCHI standards.pagination : 50 par défaut, 200 au maximum). */
const PAGE_PAR_DEFAUT = 50;
const PAGE_MAXIMUM = 200;

/**
 * Projection publique d'un joueur. Ne contient JAMAIS solde_pieces,
 * role_secret, mission_secrete, score_activite ni jeton (matrice_visibilite).
 */
export function joueurPublic(joueur: Joueur): JoueurPublic {
  return {
    joueur_id: joueur.id,
    pseudo: joueur.pseudo,
    position_cercle: joueur.position_cercle,
    connecte: joueur.connecte,
    est_hote: joueur.est_hote,
    pret: joueur.pret,
  };
}

export function joueursPublics(etat: EtatSession): readonly JoueurPublic[] {
  return etat.joueurs.map(joueurPublic);
}

/** ISO 8601 UTC, calculé en arithmétique entière : Date est banni du moteur. */
function horodatage(ms: number): string {
  return versIso(ms);
}

function mouvementPublicPourSonProprietaire(mouvement: Mouvement): MouvementPiece {
  return {
    sequence: mouvement.sequence,
    manche_numero: mouvement.manche_numero,
    delta: mouvement.delta,
    motif: mouvement.motif,
    contrepartie_joueur_id: mouvement.contrepartie_joueur_id,
    solde_apres: mouvement.solde_apres,
    cree_at: horodatage(mouvement.cree_at),
  };
}

/**
 * Journal de pièces du SEUL destinataire (CA-36). Paginé par curseur : une
 * liste de mouvements croît avec la partie, et une liste non paginée fonctionne
 * en développement puis tombe en production.
 */
export function pageMouvements(
  etat: EtatSession,
  joueurId: string,
  limite: number = PAGE_PAR_DEFAUT,
): PageMouvements {
  const taille = Math.min(Math.max(limite, 1), PAGE_MAXIMUM);
  const siens = etat.mouvements
    .filter((mouvement) => mouvement.joueur_id === joueurId)
    .slice()
    .sort((a, b) => b.sequence - a.sequence);
  const page = siens.slice(0, taille);
  const dernier = page[page.length - 1];
  const tronque = siens.length > page.length;
  return {
    elements: page.map(mouvementPublicPourSonProprietaire),
    curseur_suivant: tronque && dernier !== undefined ? String(dernier.sequence) : null,
    tronque,
  };
}

/** Visible du SEUL prêteur et du SEUL emprunteur (matrice_visibilite). */
export function pretVuPartie(pret: Pret): PretVuPartie {
  return {
    pret_id: pret.id,
    preteur_joueur_id: pret.preteur_joueur_id,
    emprunteur_joueur_id: pret.emprunteur_joueur_id,
    principal: pret.principal,
    du_total: pret.du_total,
    rembourse: pret.rembourse,
    manche_emission: pret.manche_emission,
    statut: pret.statut,
  };
}

/**
 * Déclarations publiées. Une déclaration non soumise n'a PAS d'enregistrement :
 * elle est donc absente de cette liste, et la table peut distinguer « il a
 * annoncé zéro » de « il n'a rien annoncé » — jusqu'à la matérialisation de
 * l'expiration (RG-32), qui crée la ligne à 0.
 *
 * Aucune garde de nullité ici : montant_declare n'est pas nullable dans le
 * moteur. Une garde inatteignable est une branche invérifiable, et c'est
 * exactement le genre d'endroit où une fuite se cache sans qu'aucun test ne la
 * voie.
 */
export function declarationsPubliques(manche: Manche): readonly DeclarationPublique[] {
  return manche.contributions.map((contribution) => ({
    joueur_id: contribution.joueur_id,
    montant_declare: contribution.montant_declare,
  }));
}

/** L'ampleur du mensonge n'est PAS incluse : elle révélerait le paiement (RG-75). */
export function accusationsPubliques(manche: Manche): readonly AccusationPublique[] {
  return manche.accusations.map((accusation) => ({
    accusation_id: accusation.id,
    accusateur_joueur_id: accusation.accusateur_joueur_id,
    accuse_joueur_id: accusation.accuse_joueur_id,
    verdict: accusation.verdict,
  }));
}

export function revelationsPubliques(manche: Manche): readonly RevelationPublique[] {
  return manche.revelations.map((revelation) => ({
    gabarit: revelation.gabarit,
    variante_formulation: revelation.variante_formulation,
    cibles: revelation.cibles,
    valeurs: revelation.valeurs,
  }));
}

/**
 * Résumé PUBLIC d'une manche. total_paye reste nul avant la phase REVELATION,
 * et clause_revelee avant l'étape 16 de l'exécution : les deux sont portés par
 * la manche elle-même, qui ne les renseigne qu'au moment prévu. La projection
 * n'a donc aucune date à connaître, et aucun mécanisme de libération parallèle
 * n'est inventé (ARCHI registre_champs_secrets.liberation_temporelle).
 */
export function resumeManchePublique(manche: Manche): ResumeManchePublique {
  return {
    numero: manche.numero,
    objectif: manche.objectif,
    cloture: manche.cloture,
    total_declare: manche.total_declare,
    total_paye: manche.total_paye,
    reussi: manche.reussi,
    recompense: manche.recompense,
    clause_revelee: manche.cloture ? manche.clause_cle : null,
    declarations: declarationsPubliques(manche),
    revelations: revelationsPubliques(manche),
    accusations: accusationsPubliques(manche),
  };
}

/**
 * Configuration de jeu publique : ce sont les règles, connues de toute la table
 * (ARCHI conventions.configuration_de_jeu.exposition). Énumérée champ par
 * champ, et non recopiée en bloc : un paramètre ajouté plus tard à la
 * configuration interne ne sortira pas tout seul.
 */
export function configPublique(config: ConfigJeu): Readonly<Record<string, unknown>> {
  return {
    joueurs_min: config.joueurs_min,
    joueurs_max: config.joueurs_max,
    pieces_initiales: config.pieces_initiales,
    nb_manches: config.nb_manches,
    objectif_par_joueur: config.objectif_par_joueur,
    multiplicateur_recompense: config.multiplicateur_recompense,
    multiplicateur_recompense_tresor_honnetes: config.multiplicateur_recompense_tresor_honnetes,
    multiplicateur_amende: config.multiplicateur_amende,
    cout_enquete: config.cout_enquete,
    cout_enquete_inspecteur_tresor: config.cout_enquete_inspecteur_tresor,
    cout_fausse_accusation: config.cout_fausse_accusation,
    accusations_max_par_joueur_par_manche: config.accusations_max_par_joueur_par_manche,
    bonus_mission_reussie: config.bonus_mission_reussie,
    bonus_marchand_epices_par_voeu_reussi: config.bonus_marchand_epices_par_voeu_reussi,
    taux_interet_pret: config.taux_interet_pret,
    fraction_retenue_genie: config.fraction_retenue_genie,
    fraction_consolation: config.fraction_consolation,
    recompense_signature_dernier_voeu: config.recompense_signature_dernier_voeu,
    manche_min_revelation_passe: config.manche_min_revelation_passe,
    parties_requises_pour_debloquer_dernier_voeu:
      config.parties_requises_pour_debloquer_dernier_voeu,
    durees_phases_s: { ...config.durees_phases_s },
  };
}

export { horodatage };
