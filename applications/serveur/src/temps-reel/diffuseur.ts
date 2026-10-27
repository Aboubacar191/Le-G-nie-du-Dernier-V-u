// ╔════════════════════════════════════════════════════════════════════════╗
// ║  RG-01 — IL N'EXISTE AUCUNE PRIMITIVE DE DIFFUSION.                    ║
// ║  Ce module n'expose QUE envoyerA(joueurId, evenement).                 ║
// ║  Un événement dit « public » est une BOUCLE de projections              ║
// ║  individuelles, chacune recalculée pour son destinataire par le moteur  ║
// ║  — jamais un objet partagé envoyé N fois (ADR-TL-03, ADR-TL-09).        ║
// ║                                                                        ║
// ║  Une règle ESLint interdit de DÉCLARER ici une fonction nommée          ║
// ║  diffuser, broadcast, emitAll ou toAll : la violation ne doit pas       ║
// ║  pouvoir s'écrire par étourderie en une ligne relue sans méfiance.      ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { EnveloppeEvenement } from '@gdv/partage';

export interface Diffuseur {
  /** Seule primitive d'émission du serveur. Un destinataire, un message. */
  envoyerA(joueurId: string, evenement: EnveloppeEvenement): void;
}
