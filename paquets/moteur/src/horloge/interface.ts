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
