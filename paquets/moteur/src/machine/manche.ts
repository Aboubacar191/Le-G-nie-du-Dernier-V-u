// Transitions de machine_etats_manche — RG-30 : la phase progresse strictement dans l’ordre, sans saut ni retour.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
import type { Phase } from '@gdv/partage';
import type { EtatSession, Effet, ErreurMetier } from '../etat/index.ts';

export type TransitionPhase = (
  etat: EtatSession,
  vers: Phase,
) => { ok: true; etat: EtatSession; effets: readonly Effet[] } | { ok: false; erreur: ErreurMetier };
