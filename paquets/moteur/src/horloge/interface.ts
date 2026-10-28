// Horloge INJECTÉE (RG-72 : le serveur est l'unique horloge).
//
// Date, Date.now et new Date sont bannis du paquet moteur par règle ESLint.
// Un moteur qui lit l'horloge système n'est pas rejouable : le journal rejoué
// recalculerait des échéances différentes de celles de la partie d'origine.
// L'horodatage serveur est journalisé et rejoué tel quel.

export interface Horloge {
  /** Millisecondes depuis l'époque Unix, UTC. */
  maintenant(): number;
}

/**
 * Horloge FIGÉE sur un instant donné. C'est la forme qu'exige le rejeu du
 * journal (ADR-TL-05) : l'horodatage journalisé est rejoué TEL QUEL, sans quoi
 * la reconstruction dépendrait du moment où on la lance. C'est aussi la forme
 * qu'utilisent les tests, qui n'attendent jamais réellement.
 */
export function creerHorlogeFigee(instant: number): Horloge {
  return { maintenant: () => instant };
}
