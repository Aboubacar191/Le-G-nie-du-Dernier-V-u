//
// GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
//
// Source      : .claude/orchestration/contrats/DESIGN-GDV-001.json (section tokens)
// Générateur  : outils/compiler-jetons.mjs
// Régénérer   : npm run jetons
//
// Toute correction se fait dans le contrat de conception, jamais ici : une
// valeur retouchée à la main disparaît à la prochaine compilation, et la
// divergence entre le contrat et l’écran passe inaperçue.
//

/** Points de rupture. En constantes TypeScript et non en variables CSS : une variable CSS ne fonctionne pas dans une règle @media (spécification CSS). */
export const RUPTURES = {
  "mobile": "360px",
  "tablette": "768px",
  "bureau": "1024px",
  "large": "1440px",
} as const;

/** Seuils de bascule du minuteur. Le décompte est dérivé de phase_fin_at corrigé du décalage d’horloge (RG-72, RG-79) ; il n’est jamais la source de vérité. */
export const MINUTEUR = {
  "seuil-tension-s": 10,
  "seuil-critique-s": 4,
  "pas-rafraichissement-ms": 250,
  "pas-rafraichissement-mouvement-reduit-ms": 1000,
} as const;

/** Durées en millisecondes. Les durées de confidentialité (remasquage, révélation, maintien) sont FONCTIONNELLES et ne sont pas réduites sous prefers-reduced-motion. */
export const DUREES_MS = {
  "instantanee": 0,
  "rapide": 120,
  "normale": 200,
  "lente": 320,
  "seuil-chargement": 300,
  "remasquage-apres-contact": 1500,
  "revelation-minutee": 3000,
  "revelation-maintien-max": 4000,
  "maintien-confirmation": 400,
} as const;

/** Paramètres du dispositif anti-regard-du-voisin (regles_antifuite_visuelle). */
export const SECRET = {
  "largeur-fenetre-lecture": "96px",
  "hauteur-fenetre-lecture": "64px",
  "ancrage-vertical": "tiers inferieur",
  "cote-dominant-par-defaut": "droite",
  "surface-lisible-max-ratio": 0.09,
} as const;

/** Thèmes livrés. Aucun n’est une option : le jeu se joue de jour comme de nuit. */
export const THEMES = ['clair', 'sombre'] as const;
export type Theme = (typeof THEMES)[number];

/** Noms des 29 jetons sémantiques de couleur, identiques dans les deux thèmes. */
export const JETONS_COULEUR = [
  'surface-fond',
  'surface-primaire',
  'surface-secondaire',
  'surface-inverse',
  'surface-desactivee',
  'texte-principal',
  'texte-secondaire',
  'texte-desactive',
  'texte-sur-accent',
  'texte-sur-inverse',
  'texte-sur-voile',
  'accent-action',
  'accent-action-survol',
  'accent-action-actif',
  'accent-focus',
  'bordure-structurante',
  'bordure-champ',
  'bordure-secret',
  'secret-voile',
  'urgence-calme',
  'urgence-tension',
  'urgence-critique',
  'statut-succes',
  'statut-echec',
  'statut-avertissement',
  'statut-info',
  'marque-public',
  'marque-prive',
  'ombre-teinte',
] as const;
