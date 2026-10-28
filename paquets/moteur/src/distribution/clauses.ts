// Tirage de la clause de la manche — RG-18 / CA-13.
//
// Tirage SANS REMISE au sein d'une partie : les 5 clés de clause d'une partie
// de 5 manches sont donc toutes distinctes. La liste qui décroît est
// etat.clauses_disponibles ; le tirage ne consulte jamais le catalogue complet,
// ce qui rend la propriété vraie par construction et pas par vérification.

import type { Clause } from '@gdv/partage';

import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/types.ts';

export interface TirageClause {
  readonly etat: EtatSession;
  readonly clause: Clause;
}

export function tirerClause(etat: EtatSession, alea: Alea): TirageClause {
  if (etat.clauses_disponibles.length === 0) {
    throw new Error(
      'Plus aucune clause tirable : nb_manches dépasse la taille du catalogue de clauses. ' +
        'Le tirage sans remise (RG-18) ne peut pas être honoré.',
    );
  }
  const clause = alea.choisir(etat.clauses_disponibles);
  return {
    clause,
    etat: {
      ...etat,
      clauses_disponibles: etat.clauses_disponibles.filter((cle) => cle !== clause),
    },
  };
}
