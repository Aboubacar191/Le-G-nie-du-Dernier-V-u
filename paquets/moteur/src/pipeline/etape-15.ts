// Étape 15 du pipeline d'exécution (RG-40 : 17 étapes ORDONNÉES).
// Opération normative, SPEC-GDV-001.json / pipeline_execution.etapes[14] :
//
//   prélèvement des prêts échus (émis à la manche précédente) : du_total = plafond(principal * (1 + taux_interet_pret)) ;
//   prélèvement plafonné au solde de l'emprunteur, le reliquat reste dû et sera prélevé aux manches suivantes.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.

import type { EtatSession, Effet } from '../etat/index.ts';

export type Etape15 = (
  etat: EtatSession,
) => { etat: EtatSession; effets: readonly Effet[] };
