// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// projeterVuePrivee : état complet projeté POUR UN SEUL joueur (RG-73).
// Émis à l'authentification et à chaque reconnexion : le client ne conserve
// aucune donnée de jeu, tout provient de cette projection.
//
// AMORCE — renseignée par le nœud S4 (dev-backend).

import type { EtatSession } from '../etat/index.ts';

export type ProjeterVuePrivee = (etat: EtatSession, destinataire: string) => unknown;
