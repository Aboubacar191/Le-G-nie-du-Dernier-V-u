// Types nominaux d'identifiants (ADR-TL-10 : UUIDv4 en chaîne pour TOUTES les
// clés primaires, aucun entier auto-incrémenté exposé).
//
// Le marquage nominal empêche de passer un SessionId là où un JoueurId est
// attendu : sur un protocole où l'identité du destinataire décide de ce qu'il a
// le droit de voir, une confusion d'identifiants est une fuite potentielle.
//
// Amorce : types seuls, aucune fonction. Les constructeurs validants viendront
// avec les schémas Zod (nœud S4).

declare const marque: unique symbol;

type Nominal<Base, Etiquette extends string> = Base & { readonly [marque]: Etiquette };

export type JoueurId = Nominal<string, 'JoueurId'>;
export type SessionId = Nominal<string, 'SessionId'>;
export type MancheId = Nominal<string, 'MancheId'>;
export type GroupeId = Nominal<string, 'GroupeId'>;
export type CorrelationId = Nominal<string, 'CorrelationId'>;

/** Horodatage sur le fil : ISO 8601, toujours UTC, suffixe Z obligatoire. */
export type HorodatageIso = Nominal<string, 'HorodatageIso'>;

/** Horodatage en base : entier, millisecondes depuis l'époque Unix. */
export type HorodatageMs = Nominal<number, 'HorodatageMs'>;

/** Montant en pièces : entier, jamais un flottant (ADR-TL-14). */
export type Pieces = Nominal<number, 'Pieces'>;

/** Fraction en arithmétique entière : [numerateur, denominateur] (ADR-TL-14). */
export type Rationnel = readonly [numerateur: number, denominateur: number];
