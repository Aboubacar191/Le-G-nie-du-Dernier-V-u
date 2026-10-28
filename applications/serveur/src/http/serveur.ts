// Serveur HTTP (Fastify 5, ADR-TL-02).
//
// REST est volontairement minimal : il ne couvre que ce qui doit fonctionner
// AVANT l'existence d'un jeton de session (création, aperçu, adhésion,
// configuration) plus la sonde de santé. Tout le jeu passe par le canal temps
// réel.
//
// Seule la sonde de santé est câblée à ce stade : les routes de session, de
// groupe et de configuration sont des amorces du nœud S4.

import Fastify, { type FastifyInstance } from 'fastify';

import { TAILLE_MAX_TRAME_OCTETS } from '@gdv/partage';

import type { Service } from '../service.ts';
import { enregistrerRouteSante } from './routes/sante.ts';
import { enregistrerRoutesSessions } from './routes/sessions.ts';
import { enregistrerRoutesGroupes } from './routes/groupes.ts';
import { enregistrerRoutesConfiguration } from './routes/configuration.ts';

export interface OptionsServeurHttp {
  readonly versionProtocole: string;
  readonly maintenant?: () => number;
  readonly journalisation?: boolean;
  readonly service?: Service;
}

/**
 * En-têtes de sécurité imposés à toute réponse (ARCHI
 * conventions.securite_operationnelle). Le seul vecteur d'exfiltration du jeton
 * conservé en localStorage serait une XSS : la politique est stricte dès ici.
 */
const ENTETES_SECURITE: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
};

export async function creerServeur(options: OptionsServeurHttp): Promise<FastifyInstance> {
  const serveur = Fastify({
    logger: options.journalisation ?? false,
    // Le plafond coupe l'inondation mémoire par un client modifié AVANT toute
    // désérialisation (ARCHI standards.taille_max_message_octets).
    bodyLimit: TAILLE_MAX_TRAME_OCTETS,
  });

  serveur.addHook('onSend', async (_requete, reponse, charge) => {
    for (const [cle, valeur] of Object.entries(ENTETES_SECURITE)) reponse.header(cle, valeur);
    return charge;
  });

  await enregistrerRouteSante(serveur, {
    versionProtocole: options.versionProtocole,
    maintenant: options.maintenant ?? (() => Date.now()),
  });
  await enregistrerRoutesSessions(serveur, options.service);
  await enregistrerRoutesGroupes(serveur, options.service);
  await enregistrerRoutesConfiguration(serveur);

  return serveur;
}
