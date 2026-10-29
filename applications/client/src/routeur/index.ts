// Table de routes de la PWA (ARCHI conventions.arborescence_depot).
//
// Routeur en TABLE DE DONNÉES, et non en bibliothèque de routage : l'ARCHI ne
// liste que @gdv/partage et vue dans les dépendances du client, et le besoin
// réel est minuscule. Pendant une manche, aucun écran n'est atteint par une
// navigation libre : la phase décide (RG-30, DESIGN / parcours). Les seules
// routes qui existent vraiment sont celles d'AVANT la session, parce qu'un lien
// QR doit pouvoir pré-remplir un code d'adhésion.

import type { IntentionLocale } from '../logique/resolution-ecran.ts';

export interface Route {
  readonly nom: string;
  readonly chemin: string;
  /** État(s) de partie dans lesquels cette route a un sens. */
  readonly commentaire: string;
}

export const ROUTES = [
  { nom: 'accueil', chemin: '/', commentaire: 'Créer ou rejoindre une partie (US-01).' },
  {
    nom: 'adhesion',
    chemin: '/adhesion/:code',
    commentaire: 'Adhésion par code à 6 caractères ou QR (US-02).',
  },
  { nom: 'salle-attente', chemin: '/salle-attente', commentaire: 'État SALLE_ATTENTE.' },
  { nom: 'placement', chemin: '/placement', commentaire: 'État PLACEMENT, ordre du cercle (RG-06).' },
  {
    nom: 'manche',
    chemin: '/manche',
    commentaire: 'État MANCHE_EN_COURS : les six phases de la manche.',
  },
  { nom: 'dernier-voeu', chemin: '/dernier-voeu', commentaire: 'État DERNIER_VOEU (mode avancé).' },
  { nom: 'scores', chemin: '/scores', commentaire: 'États SCORES et TERMINEE (RG-58).' },
] as const satisfies readonly Route[];

/** Chemin d'adhésion par QR, tel que le serveur l'émet dans url_adhesion. */
const MOTIF_ADHESION = /^\/adhesion\/([A-Z2-9]{1,12})\/?$/u;

export interface Entree {
  readonly intention: IntentionLocale;
  /** Code d'adhésion pré-rempli, extrait du chemin. Vide hors voie QR. */
  readonly code: string;
}

/**
 * Lit le chemin d'entrée. Un chemin inconnu mène à l'accueil : l'application
 * n'a pas d'erreur 404 à montrer à une table de huit personnes qui attend.
 */
export function lireEntree(chemin: string): Entree {
  const correspondance = MOTIF_ADHESION.exec(chemin);
  if (correspondance !== null) {
    return { intention: 'adhesion', code: correspondance[1] ?? '' };
  }
  return { intention: 'accueil', code: '' };
}
