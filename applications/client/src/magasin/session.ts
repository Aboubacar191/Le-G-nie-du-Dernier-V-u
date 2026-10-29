// Magasin de session : l'état local EST la dernière projection reçue.
//
// En LECTURE SEULE pour les écrans. Le client ne calcule aucune règle, ne
// détient aucun secret d'autrui et ne filtre rien : s'il filtrait, le secret
// aurait déjà atteint l'appareil (RG-01). Il affiche ce que le serveur lui a
// projeté, et rien de plus.
//
// Aucun état durable : un trou de séquence ou une reconnexion provoque une
// RE-PROJECTION complète (etat_complet_prive), jamais un rejeu.

import { reactive, readonly, type DeepReadonly } from 'vue';

import type { EnveloppeEvenement, TypeCommande } from '@gdv/partage';

import type { IntentionLocale } from '../logique/resolution-ecran.ts';
import {
  creerClientTempsReel,
  type ClientTempsReel,
  type EtatLiaison,
} from '../transport/client-ws.ts';
import {
  ecrireJeton,
  purgerJeton,
  relireJeton,
  type JetonStocke,
  type StockageLocal,
} from '../transport/stockage-jeton.ts';
import { etatInitial, type Alerte, type EtatLocal } from './etat.ts';
import { appliquerEvenement } from './reducteurs.ts';

export interface OptionsMagasin {
  readonly stockage: StockageLocal;
  readonly versionProtocole: string;
  /** Origine du canal temps réel. Dérivée de l'emplacement courant par défaut. */
  readonly origineTempsReel?: string;
}

export interface Magasin {
  readonly etat: DeepReadonly<EtatLocal>;
  intention(): IntentionLocale;
  naviguer(intention: IntentionLocale): void;
  /** Mémorise la session et ouvre le canal temps réel. */
  ouvrirSession(jeton: JetonStocke): void;
  /** Vrai si un jeton de session est mémorisé sur cet appareil (US-16). */
  jetonMemorise(): boolean;
  /** Reprend une session mémorisée. Faux si aucun jeton n'est stocké. */
  reprendre(): boolean;
  envoyer(type: TypeCommande, charge?: Readonly<Record<string, unknown>>): string | null;
  signaler(alerte: Alerte | null): void;
  quitter(): void;
  codeAdhesionPrerempli(): string;
  preremplirCode(code: string): void;
}

interface Contexte {
  readonly options: OptionsMagasin;
  readonly etat: EtatLocal;
  client: ClientTempsReel | null;
  intention: IntentionLocale;
  code: string;
}

function origineParDefaut(): string {
  const protocole = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocole}//${globalThis.location?.host ?? ''}`;
}

function surLiaison(ctx: Contexte, liaison: EtatLiaison): void {
  ctx.etat.liaison = liaison;
  if (liaison === 'refusee') {
    // Jeton refusé : purge immédiate. Un jeton mort qui traîne fait boucler
    // l'écran d'accès refusé à chaque relance (ECR-32).
    purgerJeton(ctx.options.stockage);
    ctx.etat.acces_refuse = true;
  }
  if (liaison === 'perdue') ctx.etat.restitution_en_cours = false;
}

function surEvenement(ctx: Contexte, enveloppe: EnveloppeEvenement, recuAMs: number): void {
  appliquerEvenement(ctx.etat, enveloppe, recuAMs);
  if (enveloppe.type === 'etat_complet_prive') ctx.etat.restitution_en_cours = false;
}

function surTrouDeSequence(ctx: Contexte): void {
  // Le client ne tente JAMAIS de reconstituer l'état : il demande une
  // re-projection. Un message projeté pour un état antérieur du jeu serait
  // périmé — calculé, par exemple, avant qu'une révélation ne change l'ensemble
  // des suspects (politique_de_rejeu).
  ctx.etat.restitution_en_cours = true;
  ctx.client?.fermer();
  ctx.client?.connecter();
}

function ouvrirCanal(ctx: Contexte, jeton: JetonStocke): void {
  ctx.client?.fermer();
  const origine = ctx.options.origineTempsReel ?? origineParDefaut();
  ctx.client = creerClientTempsReel({
    url: `${origine}${jeton.url_temps_reel}`,
    jetonSession: jeton.jeton_session,
    versionProtocole: ctx.options.versionProtocole,
    surEvenement: (enveloppe, recuAMs) => surEvenement(ctx, enveloppe, recuAMs),
    surLiaison: (liaison) => surLiaison(ctx, liaison),
    surTrouDeSequence: () => surTrouDeSequence(ctx),
  });
  ctx.client.connecter();
}

function envoyer(
  ctx: Contexte,
  type: TypeCommande,
  charge: Readonly<Record<string, unknown>>,
): string | null {
  try {
    return ctx.client?.envoyer(type, charge) ?? null;
  } catch {
    ctx.etat.alerte = {
      variante: 'avertissement',
      cle_contenu: 'connexion.actions_desactivees',
      valeurs: {},
    };
    return null;
  }
}

export function creerMagasin(options: OptionsMagasin): Magasin {
  const etat = reactive(etatInitial()) as EtatLocal;
  const ctx: Contexte = { options, etat, client: null, intention: 'accueil', code: '' };

  return {
    etat: readonly(etat) as DeepReadonly<EtatLocal>,
    intention: () => ctx.intention,
    naviguer(cible): void {
      ctx.intention = cible;
      etat.alerte = null;
    },
    ouvrirSession(jeton): void {
      ecrireJeton(options.stockage, jeton);
      etat.acces_refuse = false;
      ouvrirCanal(ctx, jeton);
    },
    jetonMemorise: () => relireJeton(options.stockage) !== null,
    reprendre(): boolean {
      const jeton = relireJeton(options.stockage);
      if (jeton === null) return false;
      etat.restitution_en_cours = true;
      ouvrirCanal(ctx, jeton);
      return true;
    },
    envoyer: (type, charge = {}) => envoyer(ctx, type, charge),
    signaler(alerte): void {
      etat.alerte = alerte;
    },
    quitter(): void {
      ctx.client?.fermer();
      ctx.client = null;
      purgerJeton(options.stockage);
      Object.assign(etat, etatInitial());
      ctx.intention = 'accueil';
    },
    codeAdhesionPrerempli: () => ctx.code,
    preremplirCode(code): void {
      ctx.code = code;
    },
  };
}
