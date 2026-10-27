// Étape 11 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[10] :
//
//   si NON reussi ET clause CONSOLATION active : chaque joueur reçoit plancher(montant_paye_i / 2).
//
// Condition : echec
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape11 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
