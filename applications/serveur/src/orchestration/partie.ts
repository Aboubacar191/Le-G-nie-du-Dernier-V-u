// Une partie vivante : l'état du moteur, son aléa, son horloge.
//
// Le serveur détient l'état en mémoire et ne contient AUCUNE règle de jeu : il
// appelle le moteur, persiste, projette. Trois choses lui appartiennent en
// propre, et elles sont toutes les trois ici :
//   · l'HORLOGE — le serveur est l'unique horloge (RG-72). En rejeu, elle est
//     FIGÉE sur l'horodatage journalisé, ce qui rend la reconstruction
//     indépendante du moment où on la lance (ADR-TL-05) ;
//   · l'ALÉA — une seule instance par session, semée par graine_alea. Elle
//     avance avec la partie, et sa position fait partie de l'état que le rejeu
//     doit reproduire ;
//   · les IDENTIFIANTS — déterministes et dérivés de la graine, par un
//     générateur SÉPARÉ pour ne pas décaler l'ordre normatif des tirages de jeu.

import type { TypeCommande } from '@gdv/partage';
import {
  appliquer,
  cloturer,
  creerAleaSfc32,
  expirerPhase,
  type Alea,
  type ContexteMoteur,
  type EtatSession,
  type Resultat,
} from '@gdv/moteur';

import { creerFabriqueIdentifiants } from '../securite/identifiants-deterministes.ts';

export class Partie {
  private courant: EtatSession;
  private readonly alea: Alea;
  private readonly fabriqueIdentifiant: () => string;
  private instant: number;

  constructor(etat: EtatSession, graine: string, maintenant: number) {
    this.courant = etat;
    this.alea = creerAleaSfc32(graine);
    this.fabriqueIdentifiant = creerFabriqueIdentifiants(graine);
    this.instant = maintenant;
  }

  get etat(): EtatSession {
    return this.courant;
  }

  get sessionId(): string {
    return this.courant.session_id;
  }

  /** Fixe l'instant utilisé par la prochaine transition. En rejeu : l'horodatage journalisé. */
  figerInstant(maintenant: number): void {
    this.instant = maintenant;
  }

  get instantCourant(): number {
    return this.instant;
  }

  private contexte(auteur?: string): ContexteMoteur {
    return {
      alea: this.alea,
      horloge: { maintenant: () => this.instant },
      identifiant: this.fabriqueIdentifiant,
      ...(auteur === undefined ? {} : { auteur_joueur_id: auteur }),
    };
  }

  /** Remplace l'état si et seulement si la transition a abouti (CA-43). */
  private retenir(resultat: Resultat): Resultat {
    if (resultat.ok) this.courant = resultat.etat;
    return resultat;
  }

  appliquerCommande(
    type: TypeCommande,
    charge: Readonly<Record<string, unknown>>,
    auteur: string,
  ): Resultat {
    return this.retenir(appliquer(this.courant, { type, charge }, this.contexte(auteur)));
  }

  expirerPhaseCourante(): Resultat {
    return this.retenir(expirerPhase(this.courant, this.contexte()));
  }

  cloturerSiNecessaire(): Resultat {
    return this.retenir(cloturer(this.courant, this.contexte()));
  }

  /** Connexion ou déconnexion d'un joueur : la partie continue (RG-46, RG-32). */
  definirEtat(etat: EtatSession): void {
    this.courant = etat;
  }
}
