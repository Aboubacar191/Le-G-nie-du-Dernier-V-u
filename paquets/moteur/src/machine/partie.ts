// Transitions de machine_etats_partie (SPEC).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { EtatPartie } from '@gdv/partage';
import type { EtatSession, Effet, ErreurMetier } from '../etat/index.ts';

export type TransitionPartie = (
  etat: EtatSession,
  vers: EtatPartie,
) => { ok: true; etat: EtatSession; effets: readonly Effet[] } | { ok: false; erreur: ErreurMetier };
