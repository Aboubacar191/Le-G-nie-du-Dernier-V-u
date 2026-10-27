// Ordonnanceur de phases — UNIQUE HORLOGE du jeu (RG-72).
//
// Les minuteries sont reconstruites depuis manches.phase_fin_at au démarrage :
// un redémarrage en pleine phase ne doit pas figer la partie, ni rallonger la
// phase en cours.
//
// Aucun client ne décide d'une expiration : les minuteurs affichés côté client
// sont décoratifs et dérivés de phase_fin_at.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export interface OrdonnanceurPhases {
  programmer(sessionId: string, finAt: number): void;
  annuler(sessionId: string): void;
  reconstruireDepuisPersistance(): Promise<void>;
}
