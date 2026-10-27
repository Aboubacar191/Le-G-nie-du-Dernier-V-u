// Étape 14 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[13] :
//
//   pour chaque accusation de verdict HONNETE : penalite = cout_fausse_accusation * facteur_amende, transférée de l'accusateur vers l'accusé, plafonnée au solde de l'accusateur.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape14 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
