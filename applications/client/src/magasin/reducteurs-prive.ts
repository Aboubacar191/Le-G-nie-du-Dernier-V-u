// Application des événements PRIVÉS : ceux dont ce joueur est propriétaire.
//
// Tout ce qui est appliqué ici est un secret au sens de matrice_visibilite, et
// n'est affichable qu'à travers VoileSecret. Aucun de ces champs ne peut
// atteindre un bandeau, un en-tête ni une alerte (mesure M6 : les zones
// publiques sont publiques PAR CONSTRUCTION).

import type {
  ChargeAttributionPrivee,
  ChargeClauseRecue,
  ChargeDernierVoeuPropose,
  ChargePretPreleve,
  ChargePretPropose,
  ChargePretResolu,
  ChargeResultatEnquete,
  ChargeSoldeMisAJour,
  ChargeTransfertEnregistre,
  PretVuPartie,
} from '@gdv/partage';

import type { EtatLocal } from './etat.ts';
import type { Applicateur } from './reducteurs-session.ts';

function fusionnerPret(etat: EtatLocal, pret: PretVuPartie): void {
  const connu = etat.prets.some((existant) => existant.pret_id === pret.pret_id);
  etat.prets = connu
    ? etat.prets.map((existant) => (existant.pret_id === pret.pret_id ? pret : existant))
    : [...etat.prets, pret];
}

export const APPLICATEURS_PRIVE: Readonly<Record<string, Applicateur>> = Object.freeze({
  attribution_privee: (etat, charge) => {
    const attribution = charge as ChargeAttributionPrivee;
    etat.attribution = attribution;
    if (etat.moi !== null) {
      etat.moi = {
        ...etat.moi,
        role_secret: attribution.role_secret,
        mission_secrete: attribution.mission_secrete,
        solde_pieces: attribution.solde_initial,
      };
    }
  },

  clause_recue: (etat, charge) => {
    // RG-18 / RG-77 : l'absence de clause et sa présence doivent produire le
    // MÊME écran masqué. L'écran affiche donc la carte inconditionnellement ;
    // ce champ ne décide que du CONTENU révélé sous maintien, jamais de la
    // présence de la carte.
    etat.clause_recue = charge as ChargeClauseRecue;
  },

  paiement_enregistre: (etat) => {
    // M5 : état terminal, sans valeur, définitivement. Le montant n'est pas
    // conservé — le réafficher après validation serait une persistance.
    etat.paiement_scelle = true;
  },

  transfert_enregistre: (etat, charge) => {
    const transfert = charge as ChargeTransfertEnregistre;
    // Projeté à l'émetteur ET au destinataire seulement. Jamais publié : il
    // permettrait de recouper les soldes et de remonter aux paiements.
    const estEmetteur = transfert.emetteur_joueur_id === etat.moi?.joueur_id;
    etat.alerte = {
      variante: 'succes',
      cle_contenu: estEmetteur ? 'motif_mouvement.transfert_emis' : 'motif_mouvement.transfert_recu',
      valeurs: {},
    };
  },

  pret_propose: (etat, charge) => {
    fusionnerPret(etat, (charge as ChargePretPropose).pret);
  },

  pret_resolu: (etat, charge) => {
    fusionnerPret(etat, (charge as ChargePretResolu).pret);
  },

  pret_preleve: (etat, charge) => {
    fusionnerPret(etat, (charge as ChargePretPreleve).pret);
  },

  resultat_enquete: (etat, charge) => {
    const resultat = charge as ChargeResultatEnquete;
    // L'information achetée n'est pas perdue à la fermeture de la feuille : elle
    // reste consultable SOUS VOILE dans le panneau privé (M8).
    etat.resultats_enquete = [...etat.resultats_enquete, resultat];
  },

  solde_mis_a_jour: (etat, charge) => {
    const evenement = charge as ChargeSoldeMisAJour;
    etat.mes_mouvements = evenement.derniers_mouvements;
    if (etat.moi !== null) {
      etat.moi = { ...etat.moi, solde_pieces: evenement.solde_pieces };
    }
  },

  dernier_voeu_propose: (etat, charge) => {
    const proposition = charge as ChargeDernierVoeuPropose;
    etat.proposition_dernier_voeu = proposition;
    etat.phase_fin_at = proposition.phase_fin_at;
  },
});
