// Serveur HTTP (Fastify 5, ADR-TL-02).
//
// REST est volontairement minimal : il ne couvre que ce qui doit fonctionner
// AVANT l'existence d'un jeton de session (création, aperçu, adhésion,
// configuration) plus la sonde de santé. Tout le jeu passe par le canal temps
// réel.
//
// PRÉFIXE /api — RUP-04, ADR-TL-23, ferme ANO-11 (mesurée à 0 route sur 6).
// Les six opérations sont servies sous /api et NULLE PART AILLEURS. Le préfixe
// est appliqué en UN SEUL point, par une encapsulation Fastify : chaque fichier
// de routes continue de déclarer son chemin contractuel sans savoir où il est
// monté, et il n'existe qu'un endroit où se tromper. Il est LU dans
// PREFIXE_REST, lui-même dérivé de servers[0].url du contrat — un littéral écrit
// ici serait la troisième source de vérité que ADR-TL-23 supprime.
//
// La réécriture du proxy de développement du client est retirée dans le même
// correctif : tant qu'elle existe, le dépôt a deux sources de vérité pour le
// préfixe et l'écart reste invisible en développement et total en production.

import Fastify, { type FastifyInstance } from 'fastify';

import { PREFIXE_REST, TAILLE_MAX_TRAME_OCTETS } from '@gdv/partage';

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

  serveur.addHook('onSend', async (requete, reponse, charge) => {
    for (const [cle, valeur] of Object.entries(ENTETES_SECURITE)) reponse.header(cle, valeur);
    // ANO-10, versant serveur. L'engagement « aucune réponse de /api n'est mise
    // en cache » s'exprime désormais par un prédicat UNIQUE et auditable, celui
    // que x-prefixe-rest.justification_par_exigence exige. Il est posé ICI en
    // plus du service worker du client : une directive de cache absente de la
    // réponse laisse le choix au navigateur et à tout proxy intermédiaire, que
    // le service worker ne gouverne pas.
    if (requete.url.startsWith(`${PREFIXE_REST}/`)) {
      reponse.header('cache-control', 'no-store');
    }
    return charge;
  });

  // Encapsulation Fastify : UN seul point d'application du préfixe. Les quatre
  // modules de routes déclarent leurs chemins contractuels sans savoir où ils
  // sont montés.
  await serveur.register(
    async (api) => {
      await enregistrerRouteSante(api, {
        versionProtocole: options.versionProtocole,
        maintenant: options.maintenant ?? (() => Date.now()),
      });
      await enregistrerRoutesSessions(api, options.service);
      await enregistrerRoutesGroupes(api, options.service);
      await enregistrerRoutesConfiguration(api);
    },
    { prefix: PREFIXE_REST },
  );

  return serveur;
}
