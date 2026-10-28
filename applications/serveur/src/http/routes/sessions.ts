// Routes d'amorçage : création, aperçu, adhésion.
//
// Ces trois routes sont en REST et non en temps réel parce qu'elles
// s'exécutent AVANT qu'un jeton de session existe, donc avant qu'une connexion
// authentifiée soit possible (ADR-TL-13). La connexion temps réel n'existe
// JAMAIS sans jeton : il n'y a aucun état de socket anonyme à gérer.
//
// Les jetons sont émis UNE SEULE FOIS ici et ne sont jamais réémis ni
// récupérables (ADR-TL-15). Ils ne voyagent dans aucune URL.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { SchemaSurchargeConfig } from '@gdv/partage';

import { creerPartie, rejoindrePartie, type Service } from '../../service.ts';

const LONGUEUR_PSEUDO_MAX = 20;
const MOTIF_CODE = '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$';

const SCHEMA_CORPS_CREATION = {
  type: 'object',
  additionalProperties: false,
  required: ['pseudo'],
  properties: {
    pseudo: { type: 'string', minLength: 1, maxLength: LONGUEUR_PSEUDO_MAX },
    jeton_groupe: { type: ['string', 'null'] },
    config_surchargee: { type: ['object', 'null'], additionalProperties: true },
    activer_mode_avance: { type: ['boolean', 'null'] },
  },
} as const;

const SCHEMA_CORPS_ADHESION = {
  type: 'object',
  additionalProperties: false,
  required: ['pseudo'],
  properties: { pseudo: { type: 'string', minLength: 1, maxLength: LONGUEUR_PSEUDO_MAX } },
} as const;

const SCHEMA_PARAMS_CODE = {
  type: 'object',
  required: ['code_adhesion'],
  properties: { code_adhesion: { type: 'string', pattern: MOTIF_CODE } },
} as const;

interface CorpsCreation {
  readonly pseudo: string;
  readonly jeton_groupe?: string | null;
  readonly config_surchargee?: unknown;
  readonly activer_mode_avance?: boolean | null;
}

function adresse(requete: FastifyRequest): string {
  return requete.ip;
}

function erreur(reponse: FastifyReply, statut: number, code: string, message: string): FastifyReply {
  return reponse.status(statut).send({ code, message });
}

function creer(serveur: FastifyInstance, service: Service): void {
  serveur.post<{ Body: CorpsCreation }>(
    '/sessions',
    { schema: { body: SCHEMA_CORPS_CREATION } },
    async (requete, reponse) => {
      if (!service.quotaCreation.autoriser(adresse(requete))) {
        return erreur(reponse, 429, 'TROP_DE_REQUETES', 'Trop de créations de session.');
      }
      // La surcharge est revalidée par Zod en plus du schéma de route : le
      // schéma JSON de Fastify ne connaît pas les bornes par paramètre, et une
      // surcharge hors bornes doit être refusée, pas rognée.
      const surcharge = SchemaSurchargeConfig.safeParse(
        requete.body.config_surchargee ?? undefined,
      );
      if (!surcharge.success) {
        return reponse.status(422).send({
          code: 'MESSAGE_MALFORME',
          message: 'Surcharge de configuration hors bornes.',
          erreurs: { config_surchargee: surcharge.error.issues.map((probleme) => probleme.message) },
        });
      }

      const resultat = creerPartie(service, {
        pseudo: requete.body.pseudo,
        jeton_groupe: requete.body.jeton_groupe ?? null,
        config_surchargee: requete.body.config_surchargee,
        activer_mode_avance: requete.body.activer_mode_avance ?? null,
      });
      if (!resultat.ok && resultat.code === 'JETON_INVALIDE') {
        return erreur(reponse, 401, 'JETON_INVALIDE', 'Jeton de groupe invalide.');
      }
      if (!resultat.ok) {
        return reponse.status(422).send({
          code: 'MESSAGE_MALFORME',
          message: 'Surcharge de configuration invalide.',
          erreurs: resultat.erreurs,
        });
      }

      return reponse.status(201).send({
        session_id: resultat.session_id,
        code_adhesion: resultat.code_adhesion,
        url_adhesion: `/adhesion/${resultat.code_adhesion}`,
        joueur_id: resultat.joueur_id,
        jeton_session: resultat.jeton_session,
        jeton_groupe: resultat.jeton_groupe,
        mode_avance_actif: resultat.mode_avance_actif,
        config_effective: resultat.config,
        url_temps_reel: '/tr',
        version_protocole: service.version_protocole,
      });
    },
  );
}

function apercevoir(serveur: FastifyInstance, service: Service): void {
  serveur.get<{ Params: { code_adhesion: string } }>(
    '/sessions/:code_adhesion/apercu',
    { schema: { params: SCHEMA_PARAMS_CODE } },
    async (requete, reponse) => {
      if (!service.quotaAdhesion.autoriser(adresse(requete))) {
        return erreur(reponse, 429, 'TROP_DE_REQUETES', 'Trop de tentatives.');
      }
      const session = service.depot.sessionParCode(requete.params.code_adhesion);
      const partie = session === undefined ? undefined : service.boucle.partie(session.id);
      if (session === undefined || partie === undefined) {
        // Réponse IDENTIQUE à un code mal formé : distinguer permettrait
        // d'énumérer les codes actifs.
        return erreur(reponse, 404, 'SESSION_INTROUVABLE', 'Session introuvable.');
      }
      const etat = partie.etat;
      const ouverte = etat.etat_partie === 'CREEE' || etat.etat_partie === 'SALLE_ATTENTE';
      const pleine = etat.joueurs.length >= etat.config.joueurs_max;
      const motif = ouverte ? (pleine ? 'SESSION_PLEINE' : null) : 'ETAT_PARTIE_INCOMPATIBLE';

      return reponse.status(200).send({
        code_adhesion: etat.code_adhesion,
        etat_partie: etat.etat_partie,
        nb_joueurs: etat.joueurs.length,
        joueurs_max: etat.config.joueurs_max,
        peut_rejoindre: ouverte && !pleine,
        motif_refus: motif,
        // N'expose PAS joueur_id : avant d'avoir rejoint, rien ne justifie de
        // connaître les identifiants de la table.
        joueurs: etat.joueurs.map((joueur) => ({
          pseudo: joueur.pseudo,
          connecte: joueur.connecte,
        })),
      });
    },
  );
}

const CORRESPONDANCE_REFUS: Readonly<Record<string, number>> = {
  SESSION_INTROUVABLE: 404,
  SESSION_PLEINE: 409,
  PSEUDO_INDISPONIBLE: 409,
  ETAT_PARTIE_INCOMPATIBLE: 403,
};

function rejoindre(serveur: FastifyInstance, service: Service): void {
  serveur.post<{ Params: { code_adhesion: string }; Body: { pseudo: string } }>(
    '/sessions/:code_adhesion/joueurs',
    { schema: { params: SCHEMA_PARAMS_CODE, body: SCHEMA_CORPS_ADHESION } },
    async (requete, reponse) => {
      if (!service.quotaAdhesion.autoriser(adresse(requete))) {
        return erreur(reponse, 429, 'TROP_DE_REQUETES', 'Trop de tentatives.');
      }
      const resultat = rejoindrePartie(service, requete.params.code_adhesion, requete.body.pseudo);
      if (!resultat.ok) {
        return erreur(
          reponse,
          CORRESPONDANCE_REFUS[resultat.code] ?? 409,
          resultat.code,
          'Adhésion refusée.',
        );
      }
      return reponse.status(201).send({
        session_id: resultat.session_id,
        joueur_id: resultat.joueur_id,
        jeton_session: resultat.jeton_session,
        config_effective: resultat.config,
        url_temps_reel: '/tr',
        version_protocole: service.version_protocole,
      });
    },
  );
}

export async function enregistrerRoutesSessions(
  serveur: FastifyInstance,
  service?: Service,
): Promise<void> {
  if (service === undefined) return;
  creer(serveur, service);
  apercevoir(serveur, service);
  rejoindre(serveur, service);
  await Promise.resolve();
}
