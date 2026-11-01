// Émission vers UN destinataire. Il n'existe pas d'autre primitive d'écriture.
//
// RG-01 / ADR-TL-03 : « La couche transport n'expose qu'une seule primitive :
//   envoyerA(joueurId, evenement). Il n'existe littéralement pas de fonction
//   capable de diffuser un état global : une violation de RG-01 ne peut pas
//   s'écrire par étourderie en une ligne. »
//
// RUP-02 — ÉMISSION DE LOT, et ce n'est PAS un assouplissement de RG-01.
// L'interdit mécanique demeure : aucune fonction nommée diffuser, broadcast,
// emitAll ni toAll ne peut être déclarée ici, et la primitive unitaire reste
// envoyerA. `envoyerLot` reçoit N charges DÉJÀ PROJETÉES SÉPARÉMENT par le
// moteur, une par destinataire, et les écrit une par une. La distinction n'est
// pas cosmétique, c'est elle qui préserve RG-01 : si une seule charge était
// sérialisée puis envoyée N fois, le premier événement de classe proprietaire
// fuiterait vers les sept autres joueurs. Ce module ne projette RIEN et ne sait
// pas ce qu'est un joueur ; il reçoit un lot, il compte des octets, il écrit.
//
// RUP-01 — SÉQUENCE PAR SESSION. Le compteur a MIGRÉ de la connexion vers la
// session, et il n'existe qu'UN point d'incrément : `suivanteDe`. Deux appelants
// qui incrémenteraient deux compteurs distincts recréeraient exactement la
// divergence que RUP-01 supprime. Les N trames d'un lot portent le MÊME numéro,
// parce qu'elles sont la même trame projetée N fois. La remise à 1 en
// reconnexion est SUPPRIMÉE : un compteur remis à 1 pour le seul joueur qui se
// reconnecte rendrait les séquences discernables entre joueurs et réintroduirait
// le canal.
//
// RUP-03 — REMPLISSAGE. Appliqué en DERNIER, juste avant l'écriture, à une cible
// COMMUNE pour les N trames d'un lot. Voir remplissage.ts.
//
// L'horodatage emis_a est formaté ICI, avec Date : le moteur ne peut pas s'en
// servir — il doit rester rejouable (ADR-TL-08) — mais la couche transport,
// elle, n'a aucune raison de s'en priver.
//
// Ce module ne décide RIEN : il reçoit des charges DÉJÀ projetées par le moteur
// et les enveloppe. Il ne filtre pas, il ne devine pas.

import type { TypeEvenement } from '@gdv/partage';

import type { Connexion, RegistreConnexions } from './registre-connexions.ts';
import { cibleAuPalier, cibleCommune, completer, octets } from './remplissage.ts';

/** Valeur du compteur d'une session qui n'a encore rien émis. */
const SEQUENCE_AVANT_PREMIERE_EMISSION = 0;

export interface Enveloppe {
  readonly type: TypeEvenement;
  readonly sequence: number;
  readonly emis_a: string;
  readonly id_correlation?: string | null;
  readonly charge: Readonly<Record<string, unknown>>;
}

/** Une charge déjà projetée, et son destinataire. */
export interface PartDeLot {
  readonly joueur_id: string;
  readonly charge: Readonly<Record<string, unknown>>;
}

export class Diffuseur {
  private readonly registre: RegistreConnexions;
  private readonly maintenant: () => number;

  /**
   * Compteur de séquence PAR SESSION (RUP-01). Unique source, unique point
   * d'incrément. La structure est ici et non dans Connexion : une séquence
   * portée par la connexion EST la portée « par destinataire » que la rupture
   * supprime.
   */
  private readonly sequences = new Map<string, number>();

  constructor(registre: RegistreConnexions, maintenant: () => number) {
    this.registre = registre;
    this.maintenant = maintenant;
  }

  /** LE point d'incrément, et le seul. Un lot consomme UN numéro. */
  private suivanteDe(sessionId: string): number {
    const suivante = (this.sequences.get(sessionId) ?? SEQUENCE_AVANT_PREMIERE_EMISSION) + 1;
    this.sequences.set(sessionId, suivante);
    return suivante;
  }

  /**
   * Valeur COURANTE, sans incrément. Réservée aux trames EXEMPTÉES de l'émission
   * uniforme — etat_complet_prive et les cinq codes d'erreur de protocole.
   *
   * Elles ne consomment PAS de numéro, et c'est une conséquence directe de
   * RUP-01 : une trame adressée à un seul joueur qui incrémenterait le compteur
   * de session creuserait un TROU de séquence chez les N−1 autres, lesquels
   * déclencheraient une reconnexion en boucle. « EvtEtatCompletPrive porte la
   * valeur courante du compteur de session. »
   */
  private couranteDe(sessionId: string): number {
    return this.sequences.get(sessionId) ?? SEQUENCE_AVANT_PREMIERE_EMISSION;
  }

  /** Mémoire du compteur d'une session close : rien ne doit survivre à la partie. */
  oublierSession(sessionId: string): void {
    this.sequences.delete(sessionId);
  }

  /** Lecture, pour les tests et les sondes. N'incrémente pas. */
  sequenceDe(sessionId: string): number {
    return this.couranteDe(sessionId);
  }

  /**
   * Envoie une charge déjà projetée au seul joueur désigné, SANS consommer de
   * numéro de séquence. Primitive unitaire, réservée aux trames exemptées.
   *
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
    const enveloppe = this.enveloppe(
      type,
      this.couranteDe(connexion.session_id),
      charge,
      idCorrelation,
    );
    // Hors lot : complétée au prochain multiple du palier. Le résidu
    // inter-palier de etat_complet_prive est inscrit en dette assumée.
    this.ecrire(connexion, completer(enveloppe, cibleAuPalier(octets(JSON.stringify(enveloppe)))));
    return true;
  }

  /**
   * Un LOT : N charges distinctes, déjà projetées une par une par le moteur, UN
   * seul numéro de séquence, une cible de taille COMMUNE, et N écritures dans le
   * MÊME tour de boucle d'événements — sans attente d'E/S intercalée, sans tri
   * par destinataire et sans échelonnement. Une trame qui partirait vers un seul
   * téléphone à l'instant où son destinataire agit serait lisible même si le
   * dénombrement final était égal.
   *
   * Rend le nombre de trames réellement écrites : un joueur déconnecté n'a pas
   * de socket, et son absence est déjà publique (EvtJoueurQuitte).
   */
  envoyerLot(
    sessionId: string,
    type: TypeEvenement,
    lot: readonly PartDeLot[],
    idCorrelation?: string | null,
  ): number {
    if (lot.length === 0) return 0;
    const sequence = this.suivanteDe(sessionId);
    const emisA = this.horodatage();

    // DEUX PASSES, et c'est nécessaire : la cible commune est le maximum des N
    // longueurs, elle n'est donc connue qu'une fois les N enveloppes construites.
    const prevues: { readonly connexion: Connexion; readonly texte: string }[] = [];
    const enveloppes: { readonly connexion: Connexion; readonly trame: Enveloppe }[] = [];
    for (const part of lot) {
      const connexion = this.registre.de(part.joueur_id);
      if (connexion === undefined) continue;
      enveloppes.push({
        connexion,
        trame: { type, sequence, emis_a: emisA, id_correlation: idCorrelation ?? null, charge: part.charge },
      });
    }
    const cible = cibleCommune(enveloppes.map(({ trame }) => JSON.stringify(trame)));
    for (const { connexion, trame } of enveloppes) {
      prevues.push({ connexion, texte: completer(trame, cible) });
    }
    for (const { connexion, texte } of prevues) this.ecrire(connexion, texte);
    return prevues.length;
  }

  private horodatage(): string {
    return new Date(this.maintenant()).toISOString();
  }

  private enveloppe(
    type: TypeEvenement,
    sequence: number,
    charge: Readonly<Record<string, unknown>>,
    idCorrelation?: string | null,
  ): Enveloppe {
    return {
      type,
      sequence,
      emis_a: this.horodatage(),
      id_correlation: idCorrelation ?? null,
      charge,
    };
  }

  private ecrire(connexion: Connexion, texte: string): void {
    connexion.socket.send(texte);
  }
}
