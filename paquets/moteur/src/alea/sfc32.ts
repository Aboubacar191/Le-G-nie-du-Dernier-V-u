// Générateur sfc32 graine-able, déterministe, sans aucune dépendance.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
// La graine provient de sessions.graine_alea (32 octets tirés par la couche
// transport à la création de session). Le moteur reçoit la GRAINE, jamais le
// générateur système.
//
// Note d'implémentation pour S4 : les constantes de l'algorithme (décalages,
// mot d'or) devront être des `const` nommées — `no-magic-numbers` est actif sur
// ce paquet, seuls 0 et 1 sont des littéraux admis.

import type { Alea } from './interface.ts';

/** Fabrique un Alea déterministe à partir d'une graine hexadécimale de 32 octets. */
export type CreerAleaSfc32 = (graineHex: string) => Alea;
