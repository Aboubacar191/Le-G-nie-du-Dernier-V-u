// État d'une session : types, construction initiale, invariants vérifiables.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
// Les types sont volontairement opaques : la forme de l'état est une décision de
// conception du moteur (S4), pas du squelette. Les nommer ici suffit à ce que les
// signatures publiques existent et que les couches se vérifient.

/** État complet d'une session, détenu par le serveur, jamais émis tel quel. */
export type EtatSession = unknown;

/** Effet décidé par le moteur, à projeter PAR DESTINATAIRE avant émission. */
export type Effet = unknown;

/** Erreur métier typée : le moteur retourne, il ne lève pas (conventions.gestion_erreurs). */
export type ErreurMetier = unknown;

/**
 * Contexte d'appel : tout ce que le moteur ne peut pas produire lui-même.
 * L'aléa et l'horloge y entrent par injection — c'est la condition du
 * déterminisme et du rejeu (ADR-TL-08, RG-72).
 */
export type ContexteMoteur = unknown;

/** Invariants RG-41 / RG-42 vérifiés après chaque transition. */
export type RapportInvariants = unknown;
