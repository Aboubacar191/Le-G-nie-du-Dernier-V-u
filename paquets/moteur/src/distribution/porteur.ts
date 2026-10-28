// Tirage du porteur de clause.
//
// Son identité ne sort JAMAIS en v1 (matrice_visibilite : « identite du porteur
// de la clause, visible_par: serveur, devient_public: jamais en v1 »). Elle
// n'est donc projetée dans aucun événement, pas même vers le FAISEUR_CONTRATS,
// à qui EvtClauseRecue ne dit pas QUI porte la clause.

import type { Alea } from '../alea/interface.ts';
import type { EtatSession } from '../etat/types.ts';

export function tirerPorteur(etat: EtatSession, alea: Alea): string {
  if (etat.joueurs.length === 0) {
    throw new Error('Aucun joueur : le porteur de clause ne peut pas être tiré.');
  }
  return alea.choisir(etat.joueurs.map((joueur) => joueur.id));
}
