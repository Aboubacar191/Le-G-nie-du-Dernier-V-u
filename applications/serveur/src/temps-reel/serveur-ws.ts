// Canal temps réel : mise à niveau, contrôle d'origine, plafond de taille,
// minuterie d'authentification de 5 s.
//
// Ce fichier est le point d'entrée de TOUTE trame venant d'un client. L'ordre
// des contrôles y est délibéré, du moins coûteux au plus coûteux, et du plus
// général au plus métier :
//   taille → JSON → enveloppe stricte → authentification → débit → type connu
//   → usurpation → charge stricte → idempotence → moteur.
//
// Le silence n'est jamais une réponse : « le serveur n'ignore jamais
// silencieusement une trame — un silence serait indiscernable d'une perte
// réseau ». Chaque trame reçoit un accusé ou une erreur, portant le même
// id_correlation.

import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer, type WebSocket } from 'ws';

import {
  COMPRESSION_AUTORISEE,
  DELAI_MAX_AUTHENTIFICATION_MS,
  FERMETURE,
  SCHEMAS_COMMANDE,
  SchemaEnveloppeCommande,
  pretendDesignerUnAuteur,
  TAILLE_MAX_TRAME_OCTETS,
  type CodeErreur,
  type TypeCommande,
} from '@gdv/partage';
import type { BoucleSession } from '../orchestration/boucle-session.ts';
import type { Service } from '../service.ts';
import { authentifier } from './authentification.ts';
import { Battement } from './battement.ts';
import { verifierDebit } from './debit.ts';
import { acheminerRefus } from './refus.ts';
import type { Connexion } from './registre-connexions.ts';

const CHEMIN_CANAL = '/tr';

/**
 * RUP-03, versant configuration : la compression de trame est INTERDITE, et
 * c'est une exigence de SÉCURITÉ depuis l'API 1.1.0, non plus une absence de
 * gain. Appliquée APRÈS remplissage, elle rendrait la taille compressée fonction
 * du CONTENU — une charge neutre faite de mille octets de remplissage se
 * comprime beaucoup mieux qu'une charge pleine complétée à la même taille — et
 * l'écart de taille sur le fil réapparaîtrait, c'est-à-dire exactement le canal
 * que RUP-03 ferme.
 *
 * `perMessageDeflate: false` est écrit EXPLICITEMENT et non laissé au défaut de
 * la bibliothèque : un défaut n'est pas un engagement, il change de version en
 * version, et un engagement de sécurité implicite n'est pas un engagement.
 *
 * Ce qui reste HORS DU CODE et relève de l'ingenieur-devops : une compression
 * réintroduite au niveau du cadre WebSocket par un proxy inverse ou une
 * terminaison TLS annulerait silencieusement le correctif, sans qu'aucun test de
 * ce dépôt ne le voie.
 */
const COMPRESSION_WS = false;

interface EtatSocket {
  connexion: Connexion | null;
  minuterie: NodeJS.Timeout | null;
}

export class ServeurTempsReel {
  private readonly ws: WebSocketServer;
  private readonly battement: Battement;
  private readonly etats = new WeakMap<WebSocket, EtatSocket>();

  private readonly service: Service;
  private readonly origineAutorisee: string | null;

  constructor(service: Service, origineAutorisee: string | null) {
    this.service = service;
    this.origineAutorisee = origineAutorisee;
    if (COMPRESSION_AUTORISEE) {
      throw new Error(
        'API-GDV-001.json / x-temps-reel.canal.compression n’interdit plus la compression. ' +
          'RUP-03 en fait une exigence de SÉCURITÉ : le serveur refuse de démarrer plutôt ' +
          'que d’annuler le remplissage en silence.',
      );
    }
    this.ws = new WebSocketServer({
      noServer: true,
      maxPayload: TAILLE_MAX_TRAME_OCTETS,
      perMessageDeflate: COMPRESSION_WS,
    });
    this.battement = new Battement(service.registre);
  }

  /** Mise à niveau avec CONTRÔLE D'ORIGINE (ARCHI securite_operationnelle). */
  brancher(serveurHttp: Server): void {
    serveurHttp.on('upgrade', (requete: IncomingMessage, prise: Duplex, entete: Buffer) => {
      const chemin = (requete.url ?? '').split('?')[0];
      if (chemin !== CHEMIN_CANAL || !this.origineAcceptee(requete)) {
        prise.destroy();
        return;
      }
      this.ws.handleUpgrade(requete, prise, entete, (socket) => this.accueillir(socket));
    });
    this.battement.demarrer();
  }

  arreter(): void {
    this.battement.arreter();
    this.ws.close();
  }

  private origineAcceptee(requete: IncomingMessage): boolean {
    if (this.origineAutorisee === null) return true;
    return requete.headers.origin === this.origineAutorisee;
  }

  private accueillir(socket: WebSocket): void {
    const etat: EtatSocket = { connexion: null, minuterie: null };
    this.etats.set(socket, etat);

    // Le socket anonyme ne reçoit RIEN et ne survit pas au délai : au-delà,
    // fermeture 4408, aucun message n'ayant été émis.
    etat.minuterie = setTimeout(() => {
      if (etat.connexion === null) socket.close(FERMETURE.delaiAuthentification, 'delai');
    }, DELAI_MAX_AUTHENTIFICATION_MS);
    etat.minuterie.unref?.();

    socket.on('message', (donnees: Buffer) => this.recevoir(socket, donnees));
    socket.on('pong', () => {
      if (etat.connexion !== null) this.battement.pong(etat.connexion);
    });
    socket.on('close', () => this.quitter(socket));
  }

  private quitter(socket: WebSocket): void {
    const etat = this.etats.get(socket);
    if (etat?.minuterie !== null && etat?.minuterie !== undefined) clearTimeout(etat.minuterie);
    const connexion = etat?.connexion;
    if (connexion === undefined || connexion === null) return;
    this.service.registre.delier(connexion.joueur_id, socket);
    const partie = this.service.boucle.partie(connexion.session_id);
    if (partie === undefined) return;
    this.service.boucle.signalerPresence(partie, connexion.joueur_id, false);
  }

  /** Refus : le CANAL de sortie est décidé par refus.ts, pas ici. */
  private refuser(
    socket: WebSocket,
    code: CodeErreur,
    message: string,
    idCorrelation: string | null,
    fermeture?: number,
  ): void {
    acheminerRefus(this.service, socket, this.etats.get(socket)?.connexion ?? null, {
      code,
      message,
      id_correlation: idCorrelation,
    });
    if (fermeture !== undefined) socket.close(fermeture, code);
  }

  private recevoir(socket: WebSocket, donnees: Buffer): void {
    if (donnees.byteLength > TAILLE_MAX_TRAME_OCTETS) {
      this.refuser(socket, 'MESSAGE_MALFORME', 'Trame trop grande.', null);
      return;
    }
    let brut: unknown;
    try {
      brut = JSON.parse(donnees.toString('utf8'));
    } catch {
      this.refuser(socket, 'MESSAGE_MALFORME', 'Trame JSON illisible.', null);
      return;
    }
    const enveloppe = SchemaEnveloppeCommande.safeParse(brut);
    if (!enveloppe.success) {
      this.refuser(socket, 'MESSAGE_MALFORME', 'Enveloppe non conforme.', null);
      return;
    }
    this.aiguiller(socket, enveloppe.data);
  }

  private aiguiller(
    socket: WebSocket,
    enveloppe: { id_correlation: string; type: TypeCommande; charge: Record<string, unknown> },
  ): void {
    const etat = this.etats.get(socket);
    if (etat === undefined) return;

    if (enveloppe.type === 'authentifier') {
      this.authentifierSocket(socket, etat, enveloppe);
      return;
    }
    if (etat.connexion === null) {
      this.refuser(
        socket,
        'JETON_ABSENT',
        'Trame reçue avant authentifier.',
        enveloppe.id_correlation,
        FERMETURE.jetonInvalide,
      );
      return;
    }
    const debit = verifierDebit(etat.connexion, this.service.maintenant());
    if (!debit.autorise) {
      this.refuser(
        socket,
        'TROP_DE_REQUETES',
        'Débit de commandes dépassé.',
        enveloppe.id_correlation,
        debit.fermer ? FERMETURE.tropDeRequetes : undefined,
      );
      return;
    }
    this.traiter(socket, etat.connexion, enveloppe);
  }

  private authentifierSocket(
    socket: WebSocket,
    etat: EtatSocket,
    enveloppe: { id_correlation: string; charge: Record<string, unknown> },
  ): void {
    const resultat = authentifier(
      this.service.depot,
      enveloppe.charge,
      this.service.version_protocole,
    );
    if (!resultat.ok) {
      this.refuser(
        socket,
        resultat.code,
        resultat.message,
        enveloppe.id_correlation,
        FERMETURE.jetonInvalide,
      );
      return;
    }
    const partie = this.service.boucle.partie(resultat.session_id);
    if (partie === undefined) {
      this.refuser(
        socket,
        'SESSION_INTROUVABLE',
        'Session inconnue.',
        enveloppe.id_correlation,
        FERMETURE.jetonInvalide,
      );
      return;
    }

    const connexion: Connexion = {
      socket,
      joueur_id: resultat.joueur_id,
      session_id: resultat.session_id,
      pongs_manques: 0,
      depassements: 0,
      horodatages_commandes: [],
    };
    etat.connexion = connexion;
    if (etat.minuterie !== null) clearTimeout(etat.minuterie);
    this.service.registre.lier(connexion);

    // Le reconnecté reçoit etat_complet_prive ; les AUTRES reçoivent
    // joueur_reconnecte (API / reconnexion.visibilite_de_la_deconnexion).
    this.service.boucle.signalerPresence(partie, resultat.joueur_id, true);
    this.service.boucle.envoyerEtatComplet(partie, resultat.joueur_id);
    this.service.ordonnanceur.programmer(resultat.session_id);
  }

  /**
   * Réponse DÉJÀ donnée à ce couple (joueur, corrélation) : elle est rendue
   * telle quelle, SANS réexécuter l'effet (RG-70). Rend true si la commande a
   * été traitée par la mémoire et n'a donc rien à faire de plus.
   */
  private repondreDepuisLaMemoire(
    socket: WebSocket,
    connexion: Connexion,
    idCorrelation: string,
  ): boolean {
    const memorisee = this.service.correlation.retrouver(connexion.joueur_id, idCorrelation);
    if (memorisee === undefined) return false;
    if (memorisee.accepte) {
      // RUP-02 : le rejeu réémet un accusé à TOUS, comme l'accusé d'origine. Le
      // réémettre au seul auteur ferait d'une reconnexion après coupure un canal
      // de plus — « ce joueur a rejoué une commande », donc « ce joueur en avait
      // émis une ».
      const partie = this.service.boucle.partie(connexion.session_id);
      if (partie === undefined) return false;
      this.service.boucle.emettreAccuse(
        partie,
        connexion.joueur_id,
        memorisee.type_commande,
        idCorrelation,
      );
      return true;
    }
    this.refuser(
      socket,
      memorisee.code_erreur ?? 'ERREUR_INTERNE',
      memorisee.message ?? 'Commande refusée.',
      idCorrelation,
    );
    return true;
  }

  private traiter(
    socket: WebSocket,
    connexion: Connexion,
    enveloppe: { id_correlation: string; type: TypeCommande; charge: Record<string, unknown> },
  ): void {
    if (this.repondreDepuisLaMemoire(socket, connexion, enveloppe.id_correlation)) return;

    // USURPATION AVANT VALIDATION STRICTE, et l'ordre est le fond du contrôle :
    // le schéma strict refuserait de toute façon la clé surnuméraire, mais avec
    // MESSAGE_MALFORME — et l'incident de sécurité ne serait alors pas
    // journalisé pour ce qu'il est (CA-44, codes_erreur.USURPATION_IDENTITE :
    // « Journalisé comme incident de sécurité, sans le jeton »).
    if (pretendDesignerUnAuteur(enveloppe.charge, connexion.joueur_id)) {
      this.refuser(
        socket,
        'USURPATION_IDENTITE',
        'La charge prétend agir au nom d’un autre joueur.',
        enveloppe.id_correlation,
      );
      return;
    }

    // Validation STRICTE de la charge contre le schéma de la commande : une clé
    // inconnue est un refus, jamais un dépouillement silencieux (ADR-TL-17).
    const schema = SCHEMAS_COMMANDE[enveloppe.type];
    if (!schema.safeParse(enveloppe.charge).success) {
      this.refuser(
        socket,
        'MESSAGE_MALFORME',
        'Charge non conforme au schéma de la commande.',
        enveloppe.id_correlation,
      );
      return;
    }

    const partie = this.service.boucle.partie(connexion.session_id);
    if (partie === undefined) {
      this.refuser(socket, 'SESSION_INTROUVABLE', 'Session inconnue.', enveloppe.id_correlation);
      return;
    }

    this.soumettreAuMoteur(socket, connexion, partie, enveloppe);
  }

  /** Dernier temps : le moteur tranche, la réponse est mémorisée, l'horloge reprogrammée. */
  private soumettreAuMoteur(
    socket: WebSocket,
    connexion: Connexion,
    partie: Parameters<BoucleSession['traiterCommande']>[0],
    enveloppe: { id_correlation: string; type: TypeCommande; charge: Record<string, unknown> },
  ): void {
    const compte = this.service.boucle.traiterCommande(
      partie,
      connexion.joueur_id,
      enveloppe.type,
      enveloppe.charge,
      enveloppe.id_correlation,
    );
    this.service.correlation.memoriser(connexion.joueur_id, enveloppe.id_correlation, {
      accepte: compte.accepte,
      type_commande: enveloppe.type,
      code_erreur: compte.code_erreur,
      message: compte.message,
    });
    if (!compte.accepte) {
      this.refuser(
        socket,
        compte.code_erreur ?? 'ERREUR_INTERNE',
        compte.message ?? 'Commande refusée.',
        enveloppe.id_correlation,
      );
      return;
    }
    this.service.ordonnanceur.programmer(connexion.session_id);
  }
}
