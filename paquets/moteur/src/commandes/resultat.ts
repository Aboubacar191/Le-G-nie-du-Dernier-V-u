// Forme du résultat d'une commande et lecture défensive de la charge.
//
// Le moteur N'ÉMET PAS d'exception pour une erreur métier
// (ARCHI conventions.gestion_erreurs) : il retourne { ok: false, erreur } et
// l'état d'entrée INCHANGÉ (CA-43). Une exception y est un défaut de
// programmation, pas un refus.
//
// La charge arrive déjà validée par le schéma Zod strict du paquet partagé,
// appliqué par le transport. Le moteur ne peut pas importer zod (règle de
// couches) et ne s'en remet pas pour autant à la couche appelante : il relit
// chaque valeur et refuse ce qui n'est pas du type attendu. Deux validations
// indépendantes sur une frontière de sécurité ne sont pas une redondance, c'est
// la défense en profondeur que la prescription de migration réclame
// explicitement.

import type { CodeErreur } from '@gdv/partage';

import type { Effet } from '../etat/effets.ts';
import type { ContexteMoteur, ErreurMetier, EtatSession } from '../etat/types.ts';

export type ResultatCommande =
  | { readonly ok: true; readonly etat: EtatSession; readonly effets: readonly Effet[] }
  | { readonly ok: false; readonly etat: EtatSession; readonly erreur: ErreurMetier };

export function refus(
  etat: EtatSession,
  code: CodeErreur,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ResultatCommande {
  return {
    ok: false,
    etat,
    erreur: details === undefined ? { code, message } : { code, message, details },
  };
}

export function succes(etat: EtatSession, effets: readonly Effet[]): ResultatCommande {
  return { ok: true, etat, effets };
}

/** L'auteur est déduit de la connexion authentifiée : son absence est un défaut serveur. */
export function auteurDe(contexte: ContexteMoteur): string {
  const auteur = contexte.auteur_joueur_id;
  if (auteur === undefined || auteur.length === 0) {
    throw new Error(
      'Commande sans auteur : l’identité de l’émetteur est déduite de la connexion ' +
        'authentifiée et doit être fournie par le transport (CA-44).',
    );
  }
  return auteur;
}

export function entierDe(charge: Readonly<Record<string, unknown>>, cle: string): number | null {
  const valeur = charge[cle];
  return typeof valeur === 'number' && Number.isInteger(valeur) ? valeur : null;
}

export function texteDe(charge: Readonly<Record<string, unknown>>, cle: string): string | null {
  const valeur = charge[cle];
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
}

export function booleenDe(charge: Readonly<Record<string, unknown>>, cle: string): boolean | null {
  const valeur = charge[cle];
  return typeof valeur === 'boolean' ? valeur : null;
}

export function listeTexteDe(
  charge: Readonly<Record<string, unknown>>,
  cle: string,
): readonly string[] | null {
  const valeur = charge[cle];
  if (!Array.isArray(valeur)) return null;
  if (!valeur.every((element): element is string => typeof element === 'string')) return null;
  return valeur;
}
