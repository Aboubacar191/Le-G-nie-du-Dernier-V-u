// Battement de cœur — API / x-temps-reel.battement_de_coeur.
//
// « Trames ping/pong NATIVES du protocole WebSocket, pas de commande
//   applicative : une commande applicative compterait dans la limitation de
//   débit et polluerait le journal de commandes. »
//
// Période 15 s. Après 2 pongs manqués : fermeture (code 4408), connecte passe à
// faux, joueur_quitte est projeté vers les autres. La partie continue : le
// joueur n'est jamais éliminé (RG-46) et ses actions non soumises valent 0
// (RG-32).

import { BATTEMENT_PERIODE_MS, BATTEMENT_PONGS_MANQUES_MAX, FERMETURE } from '@gdv/partage';

import type { Connexion, RegistreConnexions } from './registre-connexions.ts';

export class Battement {
  private minuterie: NodeJS.Timeout | null = null;

  private readonly registre: RegistreConnexions;
  private readonly periodeMs: number;

  constructor(registre: RegistreConnexions, periodeMs: number = BATTEMENT_PERIODE_MS) {
    this.registre = registre;
    this.periodeMs = periodeMs;
  }

  demarrer(): void {
    if (this.minuterie !== null) return;
    this.minuterie = setInterval(() => this.battre(), this.periodeMs);
    this.minuterie.unref?.();
  }

  arreter(): void {
    if (this.minuterie === null) return;
    clearInterval(this.minuterie);
    this.minuterie = null;
  }

  /** Enregistre un pong : le compteur de manqués repart à zéro. */
  pong(connexion: Connexion): void {
    connexion.pongs_manques = 0;
  }

  private battre(): void {
    for (const connexion of this.registre.toutes()) {
      if (connexion.pongs_manques >= BATTEMENT_PONGS_MANQUES_MAX) {
        connexion.socket.close(FERMETURE.delaiAuthentification, 'pongs manques');
        continue;
      }
      connexion.pongs_manques += 1;
      connexion.socket.ping();
    }
  }
}
