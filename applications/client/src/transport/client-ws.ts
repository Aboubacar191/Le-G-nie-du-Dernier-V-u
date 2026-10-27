// Client WebSocket : reconnexion, corrélation, file d'attente.
//
// Reconnexion exponentielle 0,5 / 1 / 2 / 4 / 8 s AVEC GIGUE : huit téléphones
// qui perdent le Wi-Fi au même instant ne doivent pas revenir tous ensemble.
//
// À la reconnexion, le client ne rejoue RIEN : le serveur re-projette l'état
// complet privé (RG-73). Un message calculé pour un état antérieur du jeu ne
// doit jamais être appliqué.
//
// AMORCE — renseignée par le nœud S5 (dev-frontend).

export const DELAIS_RECONNEXION_MS = [500, 1000, 2000, 4000, 8000] as const;

export interface ClientTempsReel {
  connecter(url: string, jetonSession: string): Promise<void>;
  envoyer(type: string, charge: Readonly<Record<string, unknown>>): Promise<unknown>;
  fermer(): void;
}
