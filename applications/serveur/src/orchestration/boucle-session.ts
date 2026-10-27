// Boucle de session : reçoit une commande, appelle le moteur, persiste, projette.
//
// Ordre non négociable : le journal de commandes est écrit dans la MÊME
// transaction SQLite que les effets de la commande. Un rejeu ne peut donc
// jamais diverger de l'état persisté.
//
// La projection par destinataire est appelée APRÈS la persistance, et elle
// vient du moteur (ADR-TL-09) : le transport ne construit aucun message.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { EnveloppeCommande } from '@gdv/partage';

export type TraiterCommande = (
  sessionId: string,
  joueurId: string,
  commande: EnveloppeCommande,
) => Promise<void>;
