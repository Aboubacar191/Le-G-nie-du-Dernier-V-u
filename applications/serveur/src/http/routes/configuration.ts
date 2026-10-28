// GET /configuration/defauts — valeurs d'équilibrage par défaut et bornes.
//
// Alimente l'écran de réglage de l'hôte avant le lancement (US-17, CA-45).
// RG-60 : ces valeurs viennent d'une configuration UNIQUE ; aucune n'est codée
// en dur dans le moteur. Les bornes permettent au client de refuser une saisie
// absurde sans attendre le serveur — qui revalide de toute façon (RG-71).

import type { FastifyInstance } from 'fastify';

import { BORNES_CONFIGURATION, CONFIG_DEFAUT } from '@gdv/partage';

const SCHEMA_REPONSE = {
  type: 'object',
  required: ['config_par_defaut', 'bornes'],
  properties: {
    config_par_defaut: { type: 'object', additionalProperties: true },
    bornes: { type: 'object', additionalProperties: true },
  },
} as const;

export async function enregistrerRoutesConfiguration(serveur: FastifyInstance): Promise<void> {
  serveur.get(
    '/configuration/defauts',
    { schema: { response: { 200: SCHEMA_REPONSE } } },
    async () => ({ config_par_defaut: CONFIG_DEFAUT, bornes: BORNES_CONFIGURATION }),
  );
  await Promise.resolve();
}
