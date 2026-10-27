// Mise à niveau WebSocket (ws 8.x brut, ADR-TL-03).
//
// Trois garde-fous sont posés DIRECTEMENT sur la mise à niveau, avant toute
// désérialisation : plafond de taille de trame (4096 octets), contrôle
// d'origine, minuterie d'authentification de 5 s. Aucune négociation de
// transport, aucun repli long-polling.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

import type { Server as ServeurHttp } from 'node:http';

export interface OptionsServeurTempsReel {
  readonly origineAutorisee: string | null;
  readonly tailleMaxTrameOctets: number;
  readonly delaiMaxAuthentificationMs: number;
}

export type MonterServeurTempsReel = (
  http: ServeurHttp,
  options: OptionsServeurTempsReel,
) => { fermer: () => Promise<void> };
