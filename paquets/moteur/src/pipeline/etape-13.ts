// Étape 13 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[12] :
//   
//   pour chaque accusation de verdict MENTEUR : amende = multiplicateur_amende * ampleur_mensonge * facteur_amende, transférée de l'accusé vers l'accusateur, PLAFONNÉE au solde de l'accusé (le reliquat est abandonné, pas reporté).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape13 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
