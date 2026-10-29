// Canal temps réel — API-GDV-001 / x-temps-reel.
//
// Séquence d'ouverture imposée par le contrat :
//   1. ouverture du socket, qui est anonyme et ne reçoit RIEN ;
//   2. PREMIÈRE trame = commande authentifier (jeton_session, version_protocole) ;
//   3. le serveur répond par etat_complet_prive, projeté pour ce joueur seul.
//
// Reconnexion exponentielle 0,5 / 1 / 2 / 4 / 8 s AVEC GIGUE : huit téléphones
// qui perdent le Wi-Fi au même instant ne doivent pas revenir tous ensemble.
//
// AUCUN REJEU. Le client n'accumule rien de durable : son état est la dernière
// projection reçue. À la reconnexion, le serveur RE-PROJETTE l'état complet
// (RG-73) ; un message calculé pour un état antérieur du jeu ne doit jamais
// être appliqué. Un trou de séquence déclenche donc une reconnexion, pas une
// tentative de reconstitution locale.
//
// Le battement de cœur est en trames ping/pong NATIVES du protocole
// (x-temps-reel.battement_de_coeur). L'API WebSocket du navigateur ne les
// expose pas : le navigateur répond au ping tout seul, et le client n'a donc
// rien à émettre. Côté client, la détection de coupure passe par onclose, que
// le serveur déclenche après deux pongs manqués (code 4408).

import {
  DELAI_MAX_AUTHENTIFICATION_MS,
  type EnveloppeEvenement,
  type TypeCommande,
} from '@gdv/partage';

export const DELAIS_RECONNEXION_MS = [500, 1000, 2000, 4000, 8000] as const;
export const GIGUE_RELATIVE = 0.2;

/** Fermetures après lesquelles le client ne revient plus : le jeton est mort. */
const FERMETURES_DEFINITIVES: readonly number[] = Object.freeze([4401, 4409]);

/** Les deux seuls types qui attestent une authentification réussie. */
const PREUVES_AUTHENTIFICATION: readonly string[] = Object.freeze([
  'etat_complet_prive',
  'accuse_reception',
]);

export type EtatLiaison =
  | 'inactive'
  | 'connexion'
  | 'authentification'
  | 'etablie'
  | 'perdue'
  | 'refusee';

export interface Journal {
  avertir(message: string, details?: Readonly<Record<string, unknown>>): void;
}

/** Surface du WebSocket réellement utilisée : le test n'a pas besoin d'un navigateur. */
export interface WebSocketCompatible {
  send(donnees: string): void;
  close(code?: number, raison?: string): void;
  onopen: ((evenement: unknown) => void) | null;
  onmessage: ((evenement: { data: unknown }) => void) | null;
  onclose: ((evenement: { code: number; reason: string }) => void) | null;
  onerror: ((evenement: unknown) => void) | null;
}

export interface OptionsClient {
  readonly url: string;
  readonly jetonSession: string;
  readonly versionProtocole: string;
  /** Appelé pour CHAQUE enveloppe reçue, dans l'ordre d'arrivée. */
  readonly surEvenement: (enveloppe: EnveloppeEvenement, recuAMs: number) => void;
  readonly surLiaison: (etat: EtatLiaison) => void;
  /** Trou de séquence : le porteur doit déclencher une re-projection complète. */
  readonly surTrouDeSequence: (attendue: number, recue: number) => void;
  readonly journal?: Journal;
  /** Injectables pour le test : aucune horloge ni aucun aléa implicite. */
  readonly fabriquerSocket?: (url: string) => WebSocketCompatible;
  readonly maintenant?: () => number;
  readonly alea?: () => number;
  readonly identifiant?: () => string;
}

export interface ClientTempsReel {
  connecter(): void;
  /** Envoie une commande. Lève si la liaison n'est pas établie (RG-30). */
  envoyer(type: TypeCommande, charge: Readonly<Record<string, unknown>>): string;
  fermer(): void;
  etat(): EtatLiaison;
}

/** Délai de la n-ième tentative, gigue appliquée. Palier à 8 s au-delà. */
export function delaiAvecGigue(tentative: number, alea: () => number): number {
  const index = Math.min(tentative, DELAIS_RECONNEXION_MS.length - 1);
  const base = DELAIS_RECONNEXION_MS[index] ?? DELAIS_RECONNEXION_MS[0];
  const facteur = 1 + (alea() * 2 - 1) * GIGUE_RELATIVE;
  return Math.round(base * facteur);
}

interface Contexte {
  readonly options: OptionsClient;
  readonly maintenant: () => number;
  readonly alea: () => number;
  readonly identifiant: () => string;
  readonly fabriquer: (url: string) => WebSocketCompatible;
  socket: WebSocketCompatible | null;
  liaison: EtatLiaison;
  tentative: number;
  sequenceAttendue: number;
  minuterieAuthentification: ReturnType<typeof setTimeout> | null;
  minuterieReconnexion: ReturnType<typeof setTimeout> | null;
  arrete: boolean;
}

function annoncer(ctx: Contexte, liaison: EtatLiaison): void {
  ctx.liaison = liaison;
  ctx.options.surLiaison(liaison);
}

function annulerMinuteries(ctx: Contexte): void {
  if (ctx.minuterieAuthentification !== null) clearTimeout(ctx.minuterieAuthentification);
  if (ctx.minuterieReconnexion !== null) clearTimeout(ctx.minuterieReconnexion);
  ctx.minuterieAuthentification = null;
  ctx.minuterieReconnexion = null;
}

function emettre(ctx: Contexte, type: TypeCommande, charge: Readonly<Record<string, unknown>>): string {
  const idCorrelation = ctx.identifiant();
  ctx.socket?.send(JSON.stringify({ id_correlation: idCorrelation, type, charge }));
  return idCorrelation;
}

function verifierSequence(ctx: Contexte, enveloppe: EnveloppeEvenement): void {
  // etat_complet_prive REMET la séquence à 1 : c'est le seul message qui
  // remplace l'état client, et le seul qui réinitialise le compteur.
  if (enveloppe.type === 'etat_complet_prive') {
    ctx.sequenceAttendue = enveloppe.sequence + 1;
    return;
  }
  if (enveloppe.sequence !== ctx.sequenceAttendue) {
    ctx.options.surTrouDeSequence(ctx.sequenceAttendue, enveloppe.sequence);
  }
  ctx.sequenceAttendue = enveloppe.sequence + 1;
}

function constaterAuthentification(ctx: Contexte, type: string): void {
  if (!PREUVES_AUTHENTIFICATION.includes(type)) return;
  if (ctx.minuterieAuthentification !== null) clearTimeout(ctx.minuterieAuthentification);
  ctx.minuterieAuthentification = null;
  if (ctx.liaison !== 'etablie') {
    ctx.tentative = 0;
    annoncer(ctx, 'etablie');
  }
}

function traiterTrame(ctx: Contexte, donnees: unknown): void {
  if (typeof donnees !== 'string') return;
  let enveloppe: EnveloppeEvenement;
  try {
    enveloppe = JSON.parse(donnees) as EnveloppeEvenement;
  } catch {
    ctx.options.journal?.avertir('trame illisible du canal temps réel');
    return;
  }
  if (typeof enveloppe.type !== 'string') return;
  constaterAuthentification(ctx, enveloppe.type);
  verifierSequence(ctx, enveloppe);
  ctx.options.surEvenement(enveloppe, ctx.maintenant());
}

function programmerReconnexion(ctx: Contexte): void {
  if (ctx.arrete) return;
  const delai = delaiAvecGigue(ctx.tentative, ctx.alea);
  ctx.tentative += 1;
  ctx.minuterieReconnexion = setTimeout(() => ouvrir(ctx), delai);
}

function surFermeture(ctx: Contexte, code: number): void {
  annulerMinuteries(ctx);
  ctx.socket = null;
  if (FERMETURES_DEFINITIVES.includes(code)) {
    annoncer(ctx, 'refusee');
    return;
  }
  annoncer(ctx, 'perdue');
  programmerReconnexion(ctx);
}

function surOuverture(ctx: Contexte, socket: WebSocketCompatible): void {
  annoncer(ctx, 'authentification');
  emettre(ctx, 'authentifier', {
    jeton_session: ctx.options.jetonSession,
    version_protocole: ctx.options.versionProtocole,
  });
  // Le serveur ferme lui-même en 4408 au-delà de ce délai ; le client arme la
  // même limite pour ne pas rester bloqué sur un socket muet.
  ctx.minuterieAuthentification = setTimeout(() => {
    ctx.options.journal?.avertir('authentification sans réponse');
    socket.close();
  }, DELAI_MAX_AUTHENTIFICATION_MS);
}

function ouvrir(ctx: Contexte): void {
  if (ctx.arrete) return;
  annoncer(ctx, 'connexion');
  ctx.sequenceAttendue = 1;
  const socket = ctx.fabriquer(ctx.options.url);
  ctx.socket = socket;
  socket.onopen = () => surOuverture(ctx, socket);
  socket.onmessage = (evenement) => traiterTrame(ctx, evenement.data);
  socket.onclose = (evenement) => surFermeture(ctx, evenement.code);
  socket.onerror = () => ctx.options.journal?.avertir('erreur du canal temps réel');
}

export function creerClientTempsReel(options: OptionsClient): ClientTempsReel {
  const ctx: Contexte = {
    options,
    maintenant: options.maintenant ?? (() => Date.now()),
    alea: options.alea ?? Math.random,
    identifiant: options.identifiant ?? (() => globalThis.crypto.randomUUID()),
    fabriquer:
      options.fabriquerSocket ?? ((url: string) => new WebSocket(url) as WebSocketCompatible),
    socket: null,
    liaison: 'inactive',
    tentative: 0,
    sequenceAttendue: 1,
    minuterieAuthentification: null,
    minuterieReconnexion: null,
    arrete: false,
  };

  return {
    connecter(): void {
      ctx.arrete = false;
      if (ctx.socket !== null) return;
      ctx.tentative = 0;
      ouvrir(ctx);
    },
    envoyer(type, charge): string {
      // RG-30 : aucune soumission n'est mise en file. Une commande différée
      // arriverait dans une autre phase et serait refusée de toute façon.
      if (ctx.liaison !== 'etablie') {
        throw new Error('liaison non établie : la commande n’est pas mise en file');
      }
      return emettre(ctx, type, charge);
    },
    fermer(): void {
      ctx.arrete = true;
      annulerMinuteries(ctx);
      ctx.socket?.close();
      ctx.socket = null;
      annoncer(ctx, 'inactive');
    },
    etat: () => ctx.liaison,
  };
}
