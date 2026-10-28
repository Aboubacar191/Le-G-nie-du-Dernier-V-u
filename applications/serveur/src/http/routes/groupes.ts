// GET /groupes/moi — état du groupe porteur du jeton fourni.
//
// US-18 / CA-47 / CA-48. Authentifié par le jeton de groupe persisté sur
// l'appareil de l'hôte, transmis en EN-TÊTE X-Jeton-Groupe : un jeton dans une
// URL finit dans les journaux d'accès et l'historique du navigateur.
//
// Donnée réservée à l'hôte : c'est la seule information du produit dont la
// classe de destinataire est « hote ».

import type { FastifyInstance } from 'fastify';

import { CONFIG_DEFAUT } from '@gdv/partage';

import { hacher } from '../../securite/jetons.ts';
import type { Service } from '../../service.ts';

const EN_TETE_JETON = 'x-jeton-groupe';

// Sérialisation par schéma : un champ non déclaré ici ne PEUT PAS être
// sérialisé par accident (ADR-TL-02). C'est le second filet contre la fuite de
// champ, et il vaut pour la réponse d'erreur comme pour la réponse utile.
const SCHEMA_REPONSE = {
  type: 'object',
  additionalProperties: false,
  required: ['groupe_id', 'parties_terminees', 'dernier_voeu_debloque', 'parties_requises'],
  properties: {
    groupe_id: { type: 'string' },
    parties_terminees: { type: 'integer', minimum: 0 },
    dernier_voeu_debloque: { type: 'boolean' },
    parties_requises: { type: 'integer', minimum: 0 },
  },
} as const;

const SCHEMA_ERREUR = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],
  properties: { code: { type: 'string' }, message: { type: 'string' } },
} as const;

export async function enregistrerRoutesGroupes(
  serveur: FastifyInstance,
  service?: Service,
): Promise<void> {
  if (service === undefined) return;
  serveur.get(
    '/groupes/moi',
    { schema: { response: { 200: SCHEMA_REPONSE, 401: SCHEMA_ERREUR } } },
    async (requete, reponse) => {
      const jeton = requete.headers[EN_TETE_JETON];
      if (typeof jeton !== 'string' || jeton.length === 0) {
        return reponse
          .status(401)
          .send({ code: 'JETON_ABSENT', message: 'En-tête X-Jeton-Groupe absent.' });
      }
      const groupe = service.depot.groupeParJeton(hacher(jeton));
      if (groupe === undefined) {
        return reponse
          .status(401)
          .send({ code: 'JETON_INVALIDE', message: 'Jeton de groupe inconnu.' });
      }
      const requises = CONFIG_DEFAUT.parties_requises_pour_debloquer_dernier_voeu;
      return reponse.status(200).send({
        groupe_id: groupe.id,
        parties_terminees: groupe.parties_terminees,
        dernier_voeu_debloque: groupe.parties_terminees >= requises,
        parties_requises: requises,
      });
    },
  );
  await Promise.resolve();
}
