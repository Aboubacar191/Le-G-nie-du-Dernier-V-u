// Couleurs d'avatar — DONNÉE DE JOUEUR, PAS UN TOKEN DE THÈME.
//
// Le contrat de conception (DESIGN-GDV-001.json, contraste_verifie.
// _note_couleurs_de_joueur) est explicite : les six couleurs du prototype ne
// décrivent pas le thème, elles décrivent un choix de joueur, et deux règles
// en découlent, non négociables ici :
//  1. une couleur de joueur ne sert JAMAIS de fond à du texte, seulement de
//     pastille bordée — six couleurs libres ne peuvent pas garantir un ratio
//     de contraste pour un texte qui, lui, change de thème ;
//  2. l'identité d'un joueur est TOUJOURS portée par son pseudonyme, jamais
//     par sa seule couleur — quatre de ces six teintes sont confondues par un
//     deuteranope.
//
// Mesuré avec l'outil d'équipe (contraste.mjs) avant publication, au seul
// usage qu'elles ont ici (pastille bordée sur surface-fond, seuil « ui » 3:1,
// les deux thèmes) : les six passent, mais ce n'est pas ce qui les qualifie —
// la règle 1 ci-dessus s'applique même quand le ratio passerait.
export interface CouleurJoueur {
  readonly id: string;
  readonly libelle: string;
  readonly hex: string;
}

export const COULEURS_JOUEUR: readonly CouleurJoueur[] = [
  { id: 'or', libelle: 'Or', hex: '#E6B95A' },
  { id: 'turquoise', libelle: 'Turquoise', hex: '#7FD6C4' },
  { id: 'cuivre', libelle: 'Cuivre', hex: '#E89A6B' },
  { id: 'lavande', libelle: 'Lavande', hex: '#B8A6F2' },
  { id: 'corail', libelle: 'Corail', hex: '#F0A090' },
  { id: 'menthe', libelle: 'Menthe', hex: '#A8D67F' },
];
