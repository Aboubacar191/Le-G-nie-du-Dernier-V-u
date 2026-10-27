// Étape 10 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[9] :
//
//   pour tout joueur de rôle MARCHAND_EPICES : +bonus_marchand_epices_par_voeu_reussi.
//
// Condition : reussi
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape10 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
