// Registre des connexions : joueurId → socket.
//
// « Une seconde connexion présentant le même jeton REMPLACE la première ;
//   l'ancienne est fermée avec le code 4409. Deux sockets simultanés pour un
//   même joueur sont refusés : ils doubleraient les projections privées sans
//   bénéfice. » (API / x-temps-reel.authentification)
//
// RUP-01 — LE NUMÉRO DE SÉQUENCE N'EST PLUS ICI. Il était porté par la
// connexion, monotone PAR DESTINATAIRE et remis à 1 après chaque
// etat_complet_prive : deux joueurs n'avaient ni les mêmes numéros ni le même
// nombre de messages, et cette phrase était écrite au contrat comme une
// conséquence assumée de la projection par destinataire. C'était la TRACE de la
// fuite que ANO-01 et ANO-02 ont exploitée. Le compteur a migré vers la SESSION
// (diffuseur.ts), avec un point d'incrément unique et aucune remise à 1.
//
// Le champ n'est pas conservé « au cas où » : une structure qui porte encore un
// compteur par destinataire est une invitation à s'en servir, et deux compteurs
// recréeraient exactement la divergence que la rupture supprime.

import type { WebSocket } from 'ws';

import { FERMETURE } from '@gdv/partage';

export interface Connexion {
  readonly socket: WebSocket;
  readonly joueur_id: string;
  readonly session_id: string;
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
