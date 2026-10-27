// Journal de commandes : écriture et rejeu (ADR-TL-05).
//
// Sans lui, un redémarrage du serveur détruit trente minutes de jeu en
// présentiel — ce que la priorité 2 (fiabilité) interdit.
//
// Deux règles de rejeu : les commandes refusées (accepte = 0) ne sont PAS
// rejouées, et l'horodatage serveur est rejoué TEL QUEL pour que le rejeu reste
// déterministe malgré l'horloge.
//
// Le journal est strictement serveur : il n'est exposé par aucune route, aucun
// événement, aucun log applicatif (charge_json contient les montants payés et
// les cibles d'enquête).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export interface Journal {
  ecrire(entree: Readonly<Record<string, unknown>>): void;
  rejouer(sessionId: string): Promise<void>;
}
