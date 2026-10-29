// Canal REST — API-GDV-001 / paths.
//
// « REST, strictement minimal : tout ce qui doit fonctionner AVANT qu'un jeton
//   de session existe (création, aperçu, adhésion, configuration) plus la sonde
//   de santé. »
//
// Les six routes du contrat, et aucune autre. Une route qui n'est pas au
// contrat n'existe pas : on ne la devine pas, on la réclame au tech-lead.
//
// Aucune réponse n'est mise en cache (vite.config.ts : NetworkOnly sur /api) :
// une réponse d'adhésion en cache contiendrait un jeton de session.

import type { CodeErreur, EtatGroupe, EtatPartie } from '@gdv/partage';

/**
 * Préfixe des routes REST.
 *
 * API-GDV-001 / servers déclare `https://{hote}/api` : les six routes du
 * contrat vivent donc sous /api. Le serveur livré au nœud S4 les enregistre à
 * la RACINE (/sante, /sessions, …), sans préfixe. L'écart est consigné dans
 * RAPPORT-FRONTEND-001 / defauts_contrat_releves ; il est absorbé en
 * développement par la réécriture de vite.config.ts, qui retire le préfixe.
 * Le client, lui, reste conforme au contrat : c'est le contrat qui est la
 * source de vérité, pas l'implémentation.
 */
export const BASE_REST = '/api';

/** En-tête du jeton de groupe (API-GDV-001 / securitySchemes.jetonGroupe). */
export const EN_TETE_JETON_GROUPE = 'X-Jeton-Groupe';

/** Les six routes du contrat, nommées pour que toute addition soit visible. */
export const ROUTES_REST = Object.freeze({
  sante: '/sante',
  configurationDefauts: '/configuration/defauts',
  sessions: '/sessions',
  apercu: (code: string) => `/sessions/${encodeURIComponent(code)}/apercu`,
  joueurs: (code: string) => `/sessions/${encodeURIComponent(code)}/joueurs`,
  groupeMoi: '/groupes/moi',
});

export interface EchecRest {
  readonly ok: false;
  readonly code: CodeErreur;
  readonly statut: number;
  /** Message serveur, destiné au diagnostic. L'affichage passe par le contenu. */
  readonly message: string;
}

export interface SuccesRest<T> {
  readonly ok: true;
  readonly valeur: T;
}

export type ResultatRest<T> = SuccesRest<T> | EchecRest;

export interface ConfigJeuPublique {
  readonly joueurs_min: number;
  readonly joueurs_max: number;
  readonly pieces_initiales: number;
  readonly nb_manches: number;
  readonly objectif_par_joueur: number;
  readonly cout_enquete: number;
  readonly cout_enquete_inspecteur_tresor: number;
  readonly cout_fausse_accusation: number;
  readonly recompense_signature_dernier_voeu: number;
  readonly parties_requises_pour_debloquer_dernier_voeu: number;
  readonly durees_phases_s: Readonly<Record<string, number>>;
  readonly [autre: string]: unknown;
}

export interface ReponseSessionCreee {
  readonly session_id: string;
  readonly code_adhesion: string;
  readonly url_adhesion: string;
  readonly joueur_id: string;
  readonly jeton_session: string;
  readonly jeton_groupe: string;
  readonly mode_avance_actif: boolean;
  readonly config_effective: ConfigJeuPublique;
  readonly url_temps_reel: string;
  readonly version_protocole: string;
}

export interface ReponseAdhesionAcceptee {
  readonly session_id: string;
  readonly joueur_id: string;
  readonly jeton_session: string;
  readonly config_effective: ConfigJeuPublique;
  readonly url_temps_reel: string;
  readonly version_protocole: string;
}

export interface ApercuSession {
  readonly code_adhesion: string;
  readonly etat_partie: EtatPartie;
  readonly nb_joueurs: number;
  readonly joueurs_max: number;
  readonly peut_rejoindre: boolean;
  readonly motif_refus: CodeErreur | null;
  readonly joueurs: readonly { readonly pseudo: string; readonly connecte: boolean }[];
}

export interface EtatSante {
  readonly statut: 'ok' | 'degrade';
  readonly version_protocole: string;
  readonly horodatage: string;
}

export interface ReponseConfigurationDefauts {
  readonly config_par_defaut: ConfigJeuPublique;
  readonly bornes: Readonly<Record<string, unknown>>;
}

function echecReseau(erreur: unknown): EchecRest {
  return {
    ok: false,
    code: 'ERREUR_INTERNE',
    statut: 0,
    message: erreur instanceof Error ? erreur.message : 'réseau injoignable',
  };
}

async function lireErreur(reponse: Response): Promise<EchecRest> {
  try {
    const corps: unknown = await reponse.json();
    const objet = (corps ?? {}) as { code?: string; message?: string };
    return {
      ok: false,
      code: (objet.code ?? 'ERREUR_INTERNE') as CodeErreur,
      statut: reponse.status,
      message: objet.message ?? reponse.statusText,
    };
  } catch {
    return {
      ok: false,
      code: 'ERREUR_INTERNE',
      statut: reponse.status,
      message: reponse.statusText,
    };
  }
}

async function appeler<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<ResultatRest<T>> {
  try {
    const reponse = await fetch(`${BASE_REST}${chemin}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!reponse.ok) return await lireErreur(reponse);
    return { ok: true, valeur: (await reponse.json()) as T };
  } catch (erreur) {
    return echecReseau(erreur);
  }
}

export const sonderSante = (): Promise<ResultatRest<EtatSante>> =>
  appeler<EtatSante>(ROUTES_REST.sante);

export const lireConfigurationParDefaut = (): Promise<
  ResultatRest<ReponseConfigurationDefauts>
> => appeler<ReponseConfigurationDefauts>(ROUTES_REST.configurationDefauts);

export interface CorpsCreerSession {
  readonly pseudo: string;
  readonly jeton_groupe?: string | null;
  readonly config_surchargee?: Readonly<Record<string, unknown>> | null;
  readonly activer_mode_avance?: boolean | null;
}

export const creerSession = (
  corps: CorpsCreerSession,
): Promise<ResultatRest<ReponseSessionCreee>> =>
  appeler<ReponseSessionCreee>(ROUTES_REST.sessions, {
    method: 'POST',
    body: JSON.stringify(corps),
  });

export const apercevoirSession = (code: string): Promise<ResultatRest<ApercuSession>> =>
  appeler<ApercuSession>(ROUTES_REST.apercu(code));

export const rejoindreSession = (
  code: string,
  pseudo: string,
): Promise<ResultatRest<ReponseAdhesionAcceptee>> =>
  appeler<ReponseAdhesionAcceptee>(ROUTES_REST.joueurs(code), {
    method: 'POST',
    body: JSON.stringify({ pseudo }),
  });

export const lireGroupeCourant = (
  jetonGroupe: string,
): Promise<ResultatRest<EtatGroupe>> =>
  appeler<EtatGroupe>(ROUTES_REST.groupeMoi, {
    headers: { [EN_TETE_JETON_GROUPE]: jetonGroupe },
  });
