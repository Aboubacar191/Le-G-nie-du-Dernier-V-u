// Émission vers UN destinataire. Il n'existe pas d'autre primitive.
//
// RG-01 / ADR-TL-03 : « La couche transport n'expose qu'une seule primitive :
//   envoyerA(joueurId, evenement). Il n'existe littéralement pas de fonction
//   capable de diffuser un état global : une violation de RG-01 ne peut pas
//   s'écrire par étourderie en une ligne. »
//
// Une règle ESLint interdit en plus de DÉCLARER dans ce répertoire toute
// fonction nommée diffuser, broadcast, emitAll ou toAll. Un événement dit
// « public » est une boucle de projections individuelles, écrite dans la couche
// d'orchestration, qui appelle cette primitive une fois par destinataire.
//
// L'horodatage emis_a est formaté ICI, avec Date : le moteur ne peut pas s'en
// servir — il doit rester rejouable (ADR-TL-08) — mais la couche transport,
// elle, n'a aucune raison de s'en priver. Et la règle de couches veut que le
// temps réel ne touche le moteur que par la projection.
//
// Ce module ne décide RIEN : il reçoit une charge DÉJÀ projetée par le moteur
// et l'enveloppe. Il ne filtre pas, il ne complète pas, il ne devine pas.

import type { TypeEvenement } from '@gdv/partage';


import type { Connexion, RegistreConnexions } from './registre-connexions.ts';

const SEQUENCE_INITIALE = 1;

export interface Enveloppe {
  readonly type: TypeEvenement;
  readonly sequence: number;
  readonly emis_a: string;
  readonly id_correlation?: string | null;
  readonly charge: Readonly<Record<string, unknown>>;
}

export class Diffuseur {
  private readonly registre: RegistreConnexions;
  private readonly maintenant: () => number;

  constructor(registre: RegistreConnexions, maintenant: () => number) {
    this.registre = registre;
    this.maintenant = maintenant;
  }

  /**
   * Envoie une charge déjà projetée au seul joueur désigné.
   * emis_a est posé par le SERVEUR, unique horloge (RG-72) : le client en dérive
   * un décalage moyen glissant pour que huit décomptes restent alignés (RG-79).
   */
  envoyerA(
    joueurId: string,
    type: TypeEvenement,
    charge: Readonly<Record<string, unknown>>,
    idCorrelation?: string | null,
  ): boolean {
    const connexion = this.registre.de(joueurId);
    if (connexion === undefined) return false;
    if (type === 'etat_complet_prive') connexion.sequence = SEQUENCE_INITIALE - 1;
    connexion.sequence += 1;
    const enveloppe: Enveloppe = {
      type,
      sequence: connexion.sequence,
      emis_a: new Date(this.maintenant()).toISOString(),
      id_correlation: idCorrelation ?? null,
      charge,
    };
    this.ecrire(connexion, enveloppe);
    return true;
  }

  private ecrire(connexion: Connexion, enveloppe: Enveloppe): void {
    connexion.socket.send(JSON.stringify(enveloppe));
  }
}
