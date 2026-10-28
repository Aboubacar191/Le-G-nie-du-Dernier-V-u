// Outillage : mener une partie complète à travers la BOUCLE DE SESSION réelle.
//
// Les commandes passent par traiterCommande, les expirations par
// traiterExpiration : journal, projection d'audit et incrément du compteur de
// groupe sont donc réellement exercés, pas simulés.

import { randomUUID } from 'node:crypto';

import type { TypeCommande } from '@gdv/partage';

import { creerPartie, rejoindrePartie, type Service } from '../../src/service.ts';
import type { Partie } from '../../src/orchestration/partie.ts';

const PAS_HORLOGE_MS = 1000;
const LIMITE_EXPIRATIONS = 200;

export interface PartieOuverte {
  readonly partie: Partie;
  readonly session_id: string;
  readonly code_adhesion: string;
  readonly jeton_groupe: string;
  readonly jetons: readonly string[];
  readonly joueurs: readonly string[];
  readonly mode_avance_actif: boolean;
}

export interface OptionsPartie {
  readonly joueurs?: number;
  readonly jeton_groupe?: string;
  readonly config?: Record<string, unknown>;
  readonly activer_mode_avance?: boolean;
}

/** Crée une session, y fait entrer les joueurs, et rend ses jetons. */
export function ouvrirPartie(
  service: Service,
  avancerHorloge: (ms: number) => void,
  options: OptionsPartie = {},
): PartieOuverte {
  const effectif = options.joueurs ?? 6;
  const creation = creerPartie(service, {
    pseudo: 'Hote',
    jeton_groupe: options.jeton_groupe ?? null,
    config_surchargee: options.config,
    activer_mode_avance: options.activer_mode_avance ?? null,
  });
  if (!creation.ok) throw new Error(`création refusée : ${creation.code}`);

  const jetons = [creation.jeton_session];
  const joueurs = [creation.joueur_id];
  for (let index = 1; index < effectif; index += 1) {
    avancerHorloge(PAS_HORLOGE_MS);
    const adhesion = rejoindrePartie(service, creation.code_adhesion, `Joueur${index}`);
    if (!adhesion.ok) throw new Error(`adhésion refusée : ${adhesion.code}`);
    jetons.push(adhesion.jeton_session);
    joueurs.push(adhesion.joueur_id);
  }

  const partie = service.boucle.partie(creation.session_id);
  if (partie === undefined) throw new Error('partie absente de la boucle');

  return {
    partie,
    session_id: creation.session_id,
    code_adhesion: creation.code_adhesion,
    jeton_groupe: creation.jeton_groupe,
    jetons,
    joueurs,
    mode_avance_actif: creation.mode_avance_actif,
  };
}

export function commander(
  service: Service,
  ouverte: PartieOuverte,
  auteur: string,
  type: TypeCommande,
  charge: Record<string, unknown> = {},
): { accepte: boolean; code_erreur: string | null } {
  const compte = service.boucle.traiterCommande(
    ouverte.partie,
    auteur,
    type,
    charge,
    randomUUID(),
  );
  return { accepte: compte.accepte, code_erreur: compte.code_erreur };
}

/** Démarre la partie : effectif validé, ordre des places, distribution. */
export function demarrer(service: Service, ouverte: PartieOuverte): void {
  const hote = ouverte.joueurs[0] as string;
  const demarrage = commander(service, ouverte, hote, 'demarrer_partie');
  if (!demarrage.accepte) throw new Error(`demarrer_partie : ${String(demarrage.code_erreur)}`);
  const ordre = commander(service, ouverte, hote, 'definir_ordre_places', {
    ordre: [...ouverte.joueurs],
  });
  if (!ordre.accepte) throw new Error(`definir_ordre_places : ${String(ordre.code_erreur)}`);
}

/**
 * Fait expirer les phases jusqu'à ce que la partie soit terminée. Aucune action
 * de joueur : les contributions non soumises valent 0 (RG-32), les vœux
 * échouent, et la partie va jusqu'aux scores.
 */
export function deroulerJusquALaFin(
  service: Service,
  ouverte: PartieOuverte,
  avancerHorloge: (ms: number) => void,
): void {
  let pas = 0;
  while (ouverte.partie.etat.etat_partie !== 'TERMINEE' && pas < LIMITE_EXPIRATIONS) {
    avancerHorloge(PAS_HORLOGE_MS);
    service.boucle.traiterExpiration(ouverte.partie);
    pas += 1;
  }
  if (ouverte.partie.etat.etat_partie !== 'TERMINEE') {
    throw new Error(`partie non terminée après ${pas} expirations`);
  }
}

/** Partie complète, du code d'adhésion à l'état TERMINEE. */
export function jouerPartieComplete(
  service: Service,
  avancerHorloge: (ms: number) => void,
  options: OptionsPartie = {},
): PartieOuverte {
  const ouverte = ouvrirPartie(service, avancerHorloge, options);
  demarrer(service, ouverte);
  deroulerJusquALaFin(service, ouverte, avancerHorloge);
  return ouverte;
}
