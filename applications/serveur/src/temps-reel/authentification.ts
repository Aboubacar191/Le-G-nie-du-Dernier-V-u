// Authentification de la connexion temps réel.
//
// Le jeton reçu est haché en SHA-256 et comparé À TEMPS CONSTANT au condensat
// stocké. Un jeton ne circule JAMAIS dans une URL : une URL se retrouve dans
// les journaux d'accès et l'historique du navigateur.
//
// Échec : événement erreur JETON_INVALIDE puis fermeture (code 4401).
// Silence du client au-delà de 5 s : fermeture (code 4408), aucun message émis.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export type AuthentifierConnexion = (
  jetonPresente: string,
  versionProtocoleClient: string,
) => Promise<{ ok: true; joueurId: string } | { ok: false; code: string }>;
