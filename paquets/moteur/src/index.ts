// @gdv/moteur — MOTEUR PUR.
//
// Aucune E/S, aucun module node:, aucune dépendance hors @gdv/partage.
// Entrée : (etat, commande, contexte). Sortie : (etat, effets) ou erreur typée.
// Testable intégralement sans serveur, sans socket et sans base.
//
// Les cinq signatures publiques exigées par l'ARCHI sont déclarées ici.
// Leurs implémentations relèvent du nœud S4 (dev-backend) : ce paquet ne
// contient à ce stade AUCUNE logique de jeu.

import type { EnveloppeCommande } from '@gdv/partage';
import type { EtatSession, Effet, ErreurMetier, ContexteMoteur } from './etat/index.ts';

export type * from './etat/index.ts';
export type { Alea } from './alea/interface.ts';
export type { Horloge } from './horloge/interface.ts';
export type { Plancher, Plafond, PlafonnerAuSolde } from './monnaie/index.ts';
export type { ProjeterVuePrivee, ProjeterEvenement } from './projection/index.ts';
export { NOMBRE_ETAPES_PIPELINE } from './pipeline/index.ts';

/** Résultat d'une transition : jamais une exception pour un refus métier (CA-43). */
export type Resultat =
  | { readonly ok: true; readonly etat: EtatSession; readonly effets: readonly Effet[] }
  | { readonly ok: false; readonly etat: EtatSession; readonly erreur: ErreurMetier };

/** Applique une commande client. L'autorisation est vérifiée ici (RG-71). */
export type Appliquer = (
  etat: EtatSession,
  commande: EnveloppeCommande,
  contexte: ContexteMoteur,
) => Resultat;

/** Démarre une partie : distribution des rôles, missions, clauses, porteur. */
export type Demarrer = (etat: EtatSession, contexte: ContexteMoteur) => Resultat;

/** Expiration d'une phase : décidée par l'ordonnanceur serveur, l'unique horloge (RG-72). */
export type ExpirerPhase = (etat: EtatSession, contexte: ContexteMoteur) => Resultat;
