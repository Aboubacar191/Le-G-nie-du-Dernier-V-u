// Étape 2 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[1] :
//   menteurs = { joueurs tels que montant_declare - montant_paye > 0 } ;
//   ampleur_i = montant_declare_i - montant_paye_i.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape02 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
