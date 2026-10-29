// Registre des écrans : IdEcran → composant.
//
// Table de données, comme le routeur : la correspondance est EXHAUSTIVE par
// construction, et le type Record<IdEcran, Component> fait échouer la
// compilation si un écran du contrat de conception n'a pas de composant. Un
// écran oublié ne peut donc pas passer la porte de types.
//
// Les surfaces SUPERPOSÉES (pli, transfert, prêts, résultat d'enquête,
// confirmation d'accusation, panneau de solde, liaison perdue) ne figurent pas
// comme écrans de fond : elles sont montées par leurs écrans parents, parce
// qu'elles portent des propriétés que seul le parent connaît.

import type { Component } from 'vue';

import type { IdEcran } from '../logique/resolution-ecran.ts';
import EcranAccesRefuse from './EcranAccesRefuse.vue';
import EcranAccueil from './EcranAccueil.vue';
import EcranAnnonceVoeu from './EcranAnnonceVoeu.vue';
import EcranAttentePlacement from './EcranAttentePlacement.vue';
import EcranAttributionPrivee from './EcranAttributionPrivee.vue';
import EcranConfirmationAccusation from './EcranConfirmationAccusation.vue';
import EcranCreationSession from './EcranCreationSession.vue';
import EcranDeclaration from './EcranDeclaration.vue';
import EcranDvDebat from './EcranDvDebat.vue';
import EcranDvProposition from './EcranDvProposition.vue';
import EcranDvResolution from './EcranDvResolution.vue';
import EcranDvSignature from './EcranDvSignature.vue';
import EcranEnquetesAccusations from './EcranEnquetesAccusations.vue';
import EcranExecution from './EcranExecution.vue';
import EcranInvitation from './EcranInvitation.vue';
import EcranLiaisonPerdue from './EcranLiaisonPerdue.vue';
import EcranMonOr from './EcranMonOr.vue';
import EcranNegociation from './EcranNegociation.vue';
import EcranPaiementSecret from './EcranPaiementSecret.vue';
import EcranPartieAbandonnee from './EcranPartieAbandonnee.vue';
import EcranPlacementHote from './EcranPlacementHote.vue';
import EcranPliGenie from './EcranPliGenie.vue';
import EcranPropositionPret from './EcranPropositionPret.vue';
import EcranReconnexion from './EcranReconnexion.vue';
import EcranReglagesEquilibrage from './EcranReglagesEquilibrage.vue';
import EcranRejoindre from './EcranRejoindre.vue';
import EcranReponsePret from './EcranReponsePret.vue';
import EcranResultatEnquete from './EcranResultatEnquete.vue';
import EcranRevelation from './EcranRevelation.vue';
import EcranSalleAttente from './EcranSalleAttente.vue';
import EcranScoresFinaux from './EcranScoresFinaux.vue';
import EcranTransfert from './EcranTransfert.vue';

/** Les 32 écrans du contrat de conception, sans exception ni ajout. */
export const ECRANS_PAR_ID: Readonly<Record<IdEcran, Component>> = Object.freeze({
  'ECR-01': EcranAccueil,
  'ECR-02': EcranCreationSession,
  'ECR-03': EcranReglagesEquilibrage,
  'ECR-04': EcranInvitation,
  'ECR-05': EcranRejoindre,
  'ECR-06': EcranSalleAttente,
  'ECR-07': EcranPlacementHote,
  'ECR-08': EcranAttentePlacement,
  'ECR-09': EcranAttributionPrivee,
  'ECR-10': EcranAnnonceVoeu,
  'ECR-11': EcranPliGenie,
  'ECR-12': EcranNegociation,
  'ECR-13': EcranTransfert,
  'ECR-14': EcranPropositionPret,
  'ECR-15': EcranReponsePret,
  'ECR-16': EcranDeclaration,
  'ECR-17': EcranPaiementSecret,
  'ECR-18': EcranRevelation,
  'ECR-19': EcranEnquetesAccusations,
  'ECR-20': EcranResultatEnquete,
  'ECR-21': EcranConfirmationAccusation,
  'ECR-22': EcranExecution,
  'ECR-23': EcranDvProposition,
  'ECR-24': EcranDvDebat,
  'ECR-25': EcranDvSignature,
  'ECR-26': EcranDvResolution,
  'ECR-27': EcranScoresFinaux,
  'ECR-28': EcranMonOr,
  'ECR-29': EcranLiaisonPerdue,
  'ECR-30': EcranReconnexion,
  'ECR-31': EcranPartieAbandonnee,
  'ECR-32': EcranAccesRefuse,
});
