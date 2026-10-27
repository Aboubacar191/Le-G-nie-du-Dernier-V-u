// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// Règles de visibilité : traduction de matrice_visibilite (SPEC) et de
// x-visibilite (API) en décisions par (donnée, destinataire, moment).
// La cohérence des deux sources est vérifiée en porte d'intégration par
// outils/verifier-visibilite.mjs.
//
// AMORCE — renseignée par le nœud S4 (dev-backend).

import type { ClasseDestinataire } from '@gdv/partage';
import type { EtatSession } from '../etat/index.ts';

/** Le destinataire appartient-il à la classe autorisée, dans cet état ? */
export type AppartientALaClasse = (
  etat: EtatSession,
  destinataire: string,
  classe: ClasseDestinataire,
) => boolean;
