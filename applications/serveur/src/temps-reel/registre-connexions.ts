// Registre des connexions : joueurId → socket.
//
// « Une seconde connexion présentant le même jeton REMPLACE la première ;
//   l'ancienne est fermée avec le code 4409. Deux sockets simultanés pour un
//   même joueur sont refusés : ils doubleraient les projections privées sans
//   bénéfice. » (API / x-temps-reel.authentification)
//
// Le numéro de séquence est porté ICI, par connexion, parce qu'il est monotone
// PAR DESTINATAIRE et remis à 1 après chaque etat_complet_prive : deux joueurs
// n'ont ni les mêmes numéros ni le même nombre de messages, et c'est la
// conséquence directe de la projection par destinataire.

import type { WebSocket } from 'ws';

import { FERMETURE } from '@gdv/partage';

export interface Connexion {
  readonly socket: WebSocket;
  readonly joueur_id: string;
  readonly session_id: string;
  sequence: number;
  pongs_manques: number;
  depassements: number;
  horodatages_commandes: number[];
}

export class RegistreConnexions {
  private readonly parJoueur = new Map<string, Connexion>();

  /** Lie la connexion au joueur. Une connexion antérieure est fermée (code 4409). */
  lier(connexion: Connexion): void {
    const precedente = this.parJoueur.get(connexion.joueur_id);
    if (precedente !== undefined && precedente.socket !== connexion.socket) {
      precedente.socket.close(FERMETURE.connexionRemplacee, 'connexion remplacee');
    }
    this.parJoueur.set(connexion.joueur_id, connexion);
  }

  delier(joueurId: string, socket: WebSocket): void {
    const courante = this.parJoueur.get(joueurId);
    if (courante !== undefined && courante.socket === socket) this.parJoueur.delete(joueurId);
  }

  de(joueurId: string): Connexion | undefined {
    return this.parJoueur.get(joueurId);
  }

  deSession(sessionId: string): readonly Connexion[] {
    return [...this.parJoueur.values()].filter(
      (connexion) => connexion.session_id === sessionId,
    );
  }

  toutes(): readonly Connexion[] {
    return [...this.parJoueur.values()];
  }
}
