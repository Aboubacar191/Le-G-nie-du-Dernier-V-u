// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  La projection est un module PUR du moteur, PAS un filtre du transport ║
// ║  (ADR-TL-09). On AJOUTE ce qui est autorisé ; on ne RETIRE jamais ce   ║
// ║  qui est interdit : un filtre oublie le champ ajouté la semaine        ║
// ║  suivante, une projection ne le connaît pas.                           ║
// ║  Seuils de couverture exigés ici : 100 % des lignes ET des branches.   ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// projeterEvenement : une enveloppe PAR DESTINATAIRE. Un événement dit
// « public » est une BOUCLE de projections individuelles, chacune recalculée
// pour son destinataire — jamais un objet partagé envoyé N fois (ADR-TL-03).
//
// AMORCE — renseignée par le nœud S4 (dev-backend).

import type { EtatSession, Effet } from '../etat/index.ts';

export type ProjeterEvenement = (
  etat: EtatSession,
  effet: Effet,
  destinataire: string,
) => unknown | null;
