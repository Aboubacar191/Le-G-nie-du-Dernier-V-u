// Application des événements de SESSION et de fin de partie.
//
// Un applicateur par type d'événement, et un seul : le branchement se fait par
// table de correspondance, jamais par une cascade de conditions — un aiguillage
// de trente branches est un endroit où l'on oublie un cas sans que rien ne le
// dise. Le test evenements-couverts.test.ts exige les 30 types du contrat.

import type {
  ChargeEtatCompletPrive,
  ChargeEtatPartieChange,
  ChargeGroupeMisAJour,
  ChargeJoueurPretChange,
  ChargeJoueurRejoint,
  ChargePartieAbandonnee,
  ChargePresence,
  ChargeScoresFinaux,
  ChargeErreur,
  ChargePartieDemarree,
  JoueurPublic,
} from '@gdv/partage';

import type { Alerte, EtatLocal } from './etat.ts';

export type Applicateur = (etat: EtatLocal, charge: unknown) => void;

const CODES_ACCES_REFUSE = ['JETON_INVALIDE', 'JETON_ABSENT', 'USURPATION_IDENTITE'];

/** Remet à zéro tout ce qui est propre à une manche. Appelé au changement de manche. */
export function reinitialiserManche(etat: EtatLocal): void {
  etat.clause_recue = null;
  etat.declarations = {};
  etat.nb_declarations = 0;
  etat.ecart_total = null;
  etat.revelation = null;
  etat.execution = null;
  etat.paiement_scelle = false;
  etat.resultats_enquete = [];
}

function appliquerEtatComplet(etat: EtatLocal, charge: unknown): void {
  const projection = charge as ChargeEtatCompletPrive;
  etat.session = projection.session;
  etat.moi = projection.moi;
  etat.joueurs = projection.joueurs;
  etat.manche_courante = projection.manche_courante;
  etat.historique_manches = projection.historique_manches;
  etat.phase = projection.phase;
  etat.phase_fin_at = projection.phase_fin_at;
  etat.numero_manche = projection.manche_courante?.numero ?? null;
  etat.mes_mouvements = projection.mes_mouvements;
  etat.groupe = projection.groupe;
  etat.prets = projection.moi.mes_prets;
  etat.resultats_enquete = [];
  etat.acces_refuse = false;

  // RG-73 et M1 : la restitution n'ouvre AUCUN voile. Les secrets propres sont
  // présents dans la projection mais l'affichage reste masqué tant qu'un geste
  // délibéré n'a pas eu lieu. Le paiement se restitue comme SCELLÉ, sans chiffre.
  etat.paiement_scelle = projection.moi.montant_paye !== null;
  etat.signature_scellee = projection.moi.ma_signature_dernier_voeu !== null;

  const declarations: Record<string, number> = {};
  for (const ligne of projection.manche_courante?.declarations ?? []) {
    declarations[ligne.joueur_id] = ligne.montant_declare;
  }
  etat.declarations = declarations;
  etat.nb_declarations = Object.keys(declarations).length;
  etat.accusations = (projection.manche_courante?.accusations ?? []).map((accusation) => ({
    accusation_id: accusation.accusation_id,
    accusateur_joueur_id: accusation.accusateur_joueur_id,
    accuse_joueur_id: accusation.accuse_joueur_id,
    numero_manche: projection.manche_courante?.numero ?? 0,
    verdict: accusation.verdict,
  }));
}

function remplacerJoueur(
  etat: EtatLocal,
  joueurId: string,
  transformer: (joueur: JoueurPublic) => JoueurPublic,
): void {
  etat.joueurs = etat.joueurs.map((joueur) =>
    joueur.joueur_id === joueurId ? transformer(joueur) : joueur,
  );
}

function appliquerErreur(etat: EtatLocal, charge: unknown): void {
  const erreur = charge as ChargeErreur;
  // Le message serveur n'est PAS affiché : l'affichage passe par la clé de
  // contenu, pour que trancher l'univers ne demande aucune reprise (RG-61).
  const alerte: Alerte = {
    variante: 'erreur',
    cle_contenu: `code_erreur.${erreur.code}`,
    valeurs: {},
    code: erreur.code,
  };
  etat.alerte = alerte;
  if (CODES_ACCES_REFUSE.includes(erreur.code)) etat.acces_refuse = true;
}

export const APPLICATEURS_SESSION: Readonly<Record<string, Applicateur>> = Object.freeze({
  etat_complet_prive: appliquerEtatComplet,

  accuse_reception: (etat) => {
    etat.alerte = null;
  },

  erreur: appliquerErreur,

  etat_partie_change: (etat, charge) => {
    const evenement = charge as ChargeEtatPartieChange;
    if (etat.session !== null) {
      etat.session = { ...etat.session, etat_partie: evenement.etat_partie };
    }
    if (evenement.manche_courante !== etat.numero_manche) reinitialiserManche(etat);
    etat.numero_manche = evenement.manche_courante;
  },

  joueur_rejoint: (etat, charge) => {
    const evenement = charge as ChargeJoueurRejoint;
    const deja = etat.joueurs.some((joueur) => joueur.joueur_id === evenement.joueur.joueur_id);
    // L'insertion ne déplace aucune ligne existante (ECR-06, état contenu).
    if (!deja) etat.joueurs = [...etat.joueurs, evenement.joueur];
  },

  joueur_quitte: (etat, charge) => {
    const evenement = charge as ChargePresence;
    // RG-46 : le joueur n'est pas éliminé. Sa carte reste en place, marquée
    // « Hors du cercle », et il reste accusable et destinataire de transferts.
    remplacerJoueur(etat, evenement.joueur_id, (joueur) => ({ ...joueur, connecte: false }));
  },

  joueur_reconnecte: (etat, charge) => {
    const evenement = charge as ChargePresence;
    remplacerJoueur(etat, evenement.joueur_id, (joueur) => ({ ...joueur, connecte: true }));
  },

  joueur_pret_change: (etat, charge) => {
    const evenement = charge as ChargeJoueurPretChange;
    remplacerJoueur(etat, evenement.joueur_id, (joueur) => ({ ...joueur, pret: evenement.pret }));
  },

  partie_demarree: (etat, charge) => {
    const evenement = charge as ChargePartieDemarree;
    etat.ordre_cercle = evenement.ordre_cercle;
    if (etat.session !== null) {
      etat.session = { ...etat.session, mode_avance_actif: evenement.mode_avance_actif };
    }
  },

  scores_finaux: (etat, charge) => {
    etat.scores = charge as ChargeScoresFinaux;
  },

  partie_abandonnee: (etat, charge) => {
    etat.abandon = charge as ChargePartieAbandonnee;
  },

  groupe_mis_a_jour: (etat, charge) => {
    etat.groupe = (charge as ChargeGroupeMisAJour).groupe;
  },
});
