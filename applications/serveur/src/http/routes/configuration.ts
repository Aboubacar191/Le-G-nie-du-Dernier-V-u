// Route de configuration : GET /configuration/defauts.
//
// Expose les valeurs par défaut et leurs bornes (RG-60, US-17). Les valeurs viennent
// de @gdv/partage/config/defauts.json et de nulle part ailleurs : aucune constante
// d’équilibrage n’est écrite dans le serveur.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { FastifyInstance } from 'fastify';

export async function enregistrerRoutesConfiguration(_serveur: FastifyInstance): Promise<void> {
  await Promise.resolve();
}
