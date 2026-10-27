// Une fonction PURE par commande client, autorisation incluse (phase, rôle, solde, quota).
//
// AMORCE — renseignée par le nœud S4 (dev-backend). Aucune logique de jeu ici.
// L'autorisation est exclusivement serveur (RG-71) et elle est calculée ICI,
// dans la couche pure : un client modifié n'obtient aucun effet interdit.
//
// Le moteur n'émet PAS d'exception pour une erreur métier
// (conventions.gestion_erreurs) : il retourne { ok: false, erreur } et l'état
// d'entrée INCHANGÉ (CA-43).

import type { TypeCommande } from '@gdv/partage';
import type { EtatSession, Effet, ErreurMetier, ContexteMoteur } from '../etat/index.ts';

export type ResultatCommande =
  | { ok: true; etat: EtatSession; effets: readonly Effet[] }
  | { ok: false; etat: EtatSession; erreur: ErreurMetier };

export type GestionnaireCommande = (
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
) => ResultatCommande;

/** Table des gestionnaires, une entrée par TypeCommande du protocole. */
export type GestionnairesParCommande = Readonly<Record<TypeCommande, GestionnaireCommande>>;
