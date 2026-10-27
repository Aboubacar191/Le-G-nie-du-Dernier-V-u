// Table de routes de la PWA (ARCHI conventions.arborescence_depot).
//
// AMORCE — nœud S5 (dev-frontend) : montage du routeur et écrans associés.
// Ici, seules les routes NORMATIVES sont déclarées, comme des données : aucune
// vue, aucun composant, aucune dépendance de routage n'est imposée au squelette
// (l'ARCHI ne liste que @gdv/partage et vue dans les dépendances du client).

export interface Route {
  readonly nom: string;
  readonly chemin: string;
  /** État(s) de partie dans lesquels cette route a un sens. Renseigné en S5. */
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
