// Routes de session : POST /sessions, GET /sessions/{code_adhesion}/apercu, POST /sessions/{code_adhesion}/joueurs.
//
// Ces trois actes PRÉCÈDENT l’existence d’un jeton de session, donc d’une connexion
// temps réel authentifiée (ADR-TL-13). Le jeton de session créé n’est émis qu’une
// fois, dans la réponse, vers son seul propriétaire, et n’est stocké que haché.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { FastifyInstance } from 'fastify';

export async function enregistrerRoutesSessions(_serveur: FastifyInstance): Promise<void> {
  await Promise.resolve();
}
