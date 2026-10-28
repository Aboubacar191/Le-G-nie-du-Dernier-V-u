// @gdv/moteur — MOTEUR PUR.
//
// Aucune E/S, aucun module node:, aucune dépendance hors @gdv/partage.
// Entrée : (etat, commande, contexte). Sortie : (etat, effets) ou erreur typée.
// Testable intégralement sans serveur, sans socket et sans base.
//
// Trois portes d'entrée, et trois seulement :
//   appliquer()    — une commande client, autorisée ici et nulle part ailleurs ;
//   expirerPhase() — l'expiration d'un minuteur, décidée par l'ordonnanceur
//                    serveur, qui est l'unique horloge (RG-72) ;
//   cloturer()     — le passage automatique de SCORES à TERMINEE.
//
// Aucune de ces portes n'expose l'exécution du pipeline, la sélection d'une
// révélation, la distribution ni le calcul des scores : ces opérations n'ont
// pas de commande (CA-50) et ne sont atteignables que par une transition.

import type { TypeCommande } from '@gdv/partage';

import { appliquerCommande, type ResultatCommande } from './commandes/index.ts';
import type { ContexteMoteur, EtatSession } from './etat/types.ts';
import { succes } from './commandes/resultat.ts';
import {
  abandonner,
  apresCloture,
  cloturerPartie,
  doitCloturer,
  resoudreEtScorer,
} from './machine/fin-de-partie.ts';
import { avancerDUnePhase } from './machine/flux.ts';

export type * from './etat/types.ts';
export type * from './etat/effets.ts';
export * from './etat/index.ts';
export * from './monnaie/index.ts';
export * from './machine/manche.ts';
export * from './machine/partie.ts';
export * from './machine/flux.ts';
export * from './machine/fin-de-partie.ts';
export * from './distribution/index.ts';
export * from './revelations/index.ts';
export * from './scores/index.ts';
export * from './commandes/index.ts';
export * from './pipeline/index.ts';
export { creerAleaSfc32, type CreerAleaSfc32 } from './alea/sfc32.ts';
export { versIso, dateCivile } from './horloge/iso.ts';
export { ORDRE_CONSOMMATION_ALEA } from './alea/interface.ts';
export { creerHorlogeFigee } from './horloge/interface.ts';
export { TYPES_EFFET } from './etat/effets.ts';
export type { Alea } from './alea/interface.ts';
export type { Horloge } from './horloge/interface.ts';
export {
  appartientALaClasse,
  destinatairesDeLaClause,
  estDansLaSession,
  estHoteDeLaSession,
  projeterEvenement,
  projeterVuePrivee,
} from './projection/index.ts';
export type { ProjeterEvenement, ProjeterVuePrivee } from './projection/index.ts';

export type Resultat = ResultatCommande;

/** Applique une commande client. L'autorisation est vérifiée ici (RG-71). */
export function appliquer(
  etat: EtatSession,
  commande: { readonly type: TypeCommande; readonly charge: Readonly<Record<string, unknown>> },
  contexte: ContexteMoteur,
): Resultat {
  return appliquerCommande(etat, commande.type, commande.charge, contexte);
}

/**
 * Expiration de la phase courante. C'est la seule façon dont le temps fait
 * avancer la partie : aucun client ne peut la provoquer, et l'hôte ne peut
 * qu'accélérer la NEGOCIATION (RG-72).
 *
 * Trois sorties possibles selon la phase qui expire :
 *   · EXECUTION       → manche suivante, Dernier Vœu, ou scores ;
 *   · DV_SIGNATURE    → résolution du Dernier Vœu puis scores ;
 *   · toute autre     → phase suivante de la séquence.
 */
export function expirerPhase(etat: EtatSession, contexte: ContexteMoteur): Resultat {
  if (etat.phase === 'EXECUTION') {
    const suite = apresCloture(etat, contexte);
    return succes(suite.etat, suite.effets);
  }
  if (etat.phase === 'DV_SIGNATURE') {
    const suite = resoudreEtScorer(etat, contexte);
    return succes(suite.etat, suite.effets);
  }
  const avance = avancerDUnePhase(etat, contexte);
  if (avance === null) return succes(etat, []);
  return succes(avance.etat, avance.effets);
}

/** SCORES → TERMINEE. Seul moment où le compteur du groupe est incrémenté. */
export function cloturer(etat: EtatSession, contexte: ContexteMoteur): Resultat {
  if (!doitCloturer(etat)) return succes(etat, []);
  const suite = cloturerPartie(etat, contexte);
  return succes(suite.etat, suite.effets);
}

/** Abandon par inactivité, décidé par le serveur. Ne révèle AUCUN secret (RG-76). */
export function abandonnerParInactivite(
  etat: EtatSession,
  contexte: ContexteMoteur,
): Resultat {
  const suite = abandonner(etat, 'INACTIVITE_DEPASSEE', contexte);
  return succes(suite.etat, suite.effets);
}

export type Appliquer = typeof appliquer;
export type Demarrer = typeof appliquer;
export type ExpirerPhase = typeof expirerPhase;
