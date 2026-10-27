// Sonde de santé — GET /sante (API-GDV-001.json / paths./sante).
//
// Publique et sans effet de bord. N'expose AUCUN compteur de sessions ni
// identifiant : ce serait divulguer l'activité du serveur sans besoin.
//
// La réponse est produite par le schéma de sortie déclaré ci-dessous : avec la
// sérialisation par schéma de Fastify, un champ non déclaré ne PEUT PAS être
// sérialisé par accident (ADR-TL-02). C'est le second filet contre la fuite de
// champ, et il vaut dès la première route.

import type { FastifyInstance } from 'fastify';

export interface OptionsSante {
  readonly versionProtocole: string;
  /** Horloge injectée : le serveur est l'unique horloge (RG-72). */
  readonly maintenant: () => number;
}

const SCHEMA_ETAT_SANTE = {
  type: 'object',
  additionalProperties: false,
  required: ['statut', 'version_protocole', 'horodatage'],
  properties: {
    statut: { type: 'string', enum: ['ok', 'degrade'] },
    version_protocole: { type: 'string' },
    horodatage: { type: 'string' },
  },
} as const;

export async function enregistrerRouteSante(
  serveur: FastifyInstance,
  options: OptionsSante,
): Promise<void> {
  serveur.get(
    '/sante',
    { schema: { response: { 200: SCHEMA_ETAT_SANTE } } },
    async () => ({
      statut: 'ok',
      version_protocole: options.versionProtocole,
      horodatage: new Date(options.maintenant()).toISOString(),
    }),
  );
  await Promise.resolve();
}
