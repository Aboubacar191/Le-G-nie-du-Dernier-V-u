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

import { enregistrerRouteSante } from './routes/sante.ts';
import { enregistrerRoutesSessions } from './routes/sessions.ts';
import { enregistrerRoutesGroupes } from './routes/groupes.ts';
import { enregistrerRoutesConfiguration } from './routes/configuration.ts';

export interface OptionsServeurHttp {
  readonly versionProtocole: string;
  readonly maintenant?: () => number;
  readonly journalisation?: boolean;
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
    bodyLimit: 4096,
  });

  serveur.addHook('onSend', async (_requete, reponse, charge) => {
    for (const [cle, valeur] of Object.entries(ENTETES_SECURITE)) reponse.header(cle, valeur);
    return charge;
  });

  await enregistrerRouteSante(serveur, {
    versionProtocole: options.versionProtocole,
    maintenant: options.maintenant ?? (() => Date.now()),
  });
  await enregistrerRoutesSessions(serveur);
  await enregistrerRoutesGroupes(serveur);
  await enregistrerRoutesConfiguration(serveur);

  return serveur;
}
