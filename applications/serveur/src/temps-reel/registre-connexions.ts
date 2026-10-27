// Registre des connexions : joueurId → socket.
//
// Une seule connexion par joueur : une seconde connexion présentant le même
// jeton remplace la première, fermée avec le code 4409. Deux sockets simultanés
// doubleraient les projections privées sans aucun bénéfice.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export interface RegistreConnexions {
  enregistrer(joueurId: string, socket: unknown): void;
  retirer(joueurId: string): void;
  socketDe(joueurId: string): unknown | undefined;
  joueursConnectes(): readonly string[];
}
