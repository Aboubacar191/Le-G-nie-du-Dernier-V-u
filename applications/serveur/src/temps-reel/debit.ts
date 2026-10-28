// Limitation de débit par CONNEXION (API / x-temps-reel.limitation_de_debit).
//
// 20 commandes par fenêtre glissante de 10 s. Au-delà : TROP_DE_REQUETES.
// Trois dépassements CONSÉCUTIFS ferment la connexion (code 4429).
//
// « Un client modifié ne doit pas pouvoir inonder le serveur pendant une phase
//   de 20 s, ni tenter des enquêtes en rafale pour sonder le refus par
//   SOLDE_INSUFFISANT. » Le second motif est le vrai : une rafale de refus est
//   une sonde d'information sur les soldes, qui sont secrets.

import { DEBIT_DEPASSEMENTS_AVANT_FERMETURE, DEBIT_FENETRE_MS, DEBIT_MAX_COMMANDES } from '@gdv/partage';

import type { Connexion } from './registre-connexions.ts';

export interface VerdictDebit {
  readonly autorise: boolean;
  readonly fermer: boolean;
}

export function verifierDebit(connexion: Connexion, maintenant: number): VerdictDebit {
  const depuis = maintenant - DEBIT_FENETRE_MS;
  const recentes = connexion.horodatages_commandes.filter((date) => date > depuis);

  if (recentes.length >= DEBIT_MAX_COMMANDES) {
    connexion.horodatages_commandes = recentes;
    connexion.depassements += 1;
    return {
      autorise: false,
      fermer: connexion.depassements >= DEBIT_DEPASSEMENTS_AVANT_FERMETURE,
    };
  }

  recentes.push(maintenant);
  connexion.horodatages_commandes = recentes;
  connexion.depassements = 0;
  return { autorise: true, fermer: false };
}
