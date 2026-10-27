// Battement de cœur : ping/pong toutes les 15 s, fermeture après 2 pongs manqués.
//
// Sans lui, une connexion morte reste « ouverte » côté serveur et le joueur
// paraît présent alors que son téléphone est verrouillé.
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune règle de jeu ici.

export const INTERVALLE_BATTEMENT_MS = 15_000;
export const PONGS_MANQUES_AVANT_FERMETURE = 2;

export type DemarrerBattement = (socket: unknown) => { arreter: () => void };
