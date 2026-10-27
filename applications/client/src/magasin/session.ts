// Magasin de session : l'état local EST la dernière projection reçue.
//
// En LECTURE SEULE. Le client ne calcule aucune règle, ne détient aucun secret
// d'autrui et ne filtre rien : s'il filtrait, le secret aurait déjà atteint
// l'appareil (RG-01). Il affiche ce que le serveur lui a projeté, et rien de plus.
//
// AMORCE — renseignée par le nœud S5 (dev-frontend).

import type { EtatPartie, Phase } from '@gdv/partage';

export interface EtatLocal {
  /** Dernière projection privée reçue, telle quelle. */
  readonly projection: Readonly<Record<string, unknown>> | null;
  readonly etat_partie: EtatPartie | null;
  readonly phase: Phase | null;
  /** Numéro de séquence du dernier événement appliqué (détection de trou). */
  readonly derniere_sequence: number;
}
