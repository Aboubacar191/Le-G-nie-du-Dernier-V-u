// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Point d'entrée UNIQUE de la frontière de sécurité. C'est le seul module du
// moteur que la couche temps réel du serveur a le droit d'importer : la règle
// « transport-passe-par-la-projection » de .dependency-cruiser.cjs le vérifie.

export type { AppartientALaClasse } from './regles-visibilite.ts';
export type { ProjeterVuePrivee } from './vue-privee.ts';
export type { ProjeterEvenement } from './evenement.ts';
