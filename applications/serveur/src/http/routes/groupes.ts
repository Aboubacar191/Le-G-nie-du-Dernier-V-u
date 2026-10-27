// Routes de groupe : GET /groupes/moi.
//
// L’état du groupe appartient au porteur du jeton de groupe, c’est-à-dire à l’hôte
// (classe de destinataire « hote »).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { FastifyInstance } from 'fastify';

export async function enregistrerRoutesGroupes(_serveur: FastifyInstance): Promise<void> {
  await Promise.resolve();
}
