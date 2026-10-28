// Idempotence de corrélation — RG-70, x-temps-reel.correlation.
//
// « Le serveur mémorise les 32 derniers (joueur_id, id_correlation) et leur
//   réponse. Une commande rejouée avec le même id_correlation renvoie la
//   réponse d'origine SANS réexécuter l'effet. Ce mécanisme couvre le cas où un
//   accusé se perd pendant une coupure. »
//
// Distinct de l'idempotence MÉTIER, qui est portée par le moteur : une seconde
// declarer_contribution avec un id_correlation DIFFÉRENT remplace la première
// tant que payer_secret n'a pas été soumis, puis est refusée avec DEJA_SOUMIS.
// Les deux ne se remplacent pas : l'un protège du réseau, l'autre des règles.
//
// NOTE DE DETTE TRAITÉE : ce fichier s'appelait « corrélation.ts », avec un
// accent — erreur connue du contrat SCAFFOLD v1.0.0, inscrite en dette. Le
// nœud S4 réécrivant ce fichier de bout en bout, le renommage a été fait au
// passage plutôt que de laisser un nom de fichier non ASCII dans un chemin
// Windows déjà accentué. Signalé au rapport.

import type { CodeErreur } from '@gdv/partage';
import { MEMOIRE_CORRELATION } from '@gdv/partage';

export interface ReponseMemorisee {
  readonly accepte: boolean;
  readonly type_commande: string;
  readonly code_erreur: CodeErreur | null;
  readonly message: string | null;
}

export class MemoireCorrelation {
  private readonly parJoueur = new Map<string, Map<string, ReponseMemorisee>>();

  /** Réponse déjà donnée à ce couple (joueur, corrélation), si elle est connue. */
  retrouver(joueurId: string, idCorrelation: string): ReponseMemorisee | undefined {
    return this.parJoueur.get(joueurId)?.get(idCorrelation);
  }

  /**
   * Mémorise la réponse. Au-delà de MEMOIRE_CORRELATION entrées, la plus
   * ancienne est oubliée : la mémoire est bornée, sinon un client modifié la
   * ferait croître indéfiniment avec des identifiants de corrélation jetables.
   */
  memoriser(joueurId: string, idCorrelation: string, reponse: ReponseMemorisee): void {
    const siennes = this.parJoueur.get(joueurId) ?? new Map<string, ReponseMemorisee>();
    siennes.delete(idCorrelation);
    siennes.set(idCorrelation, reponse);
    while (siennes.size > MEMOIRE_CORRELATION) {
      const plusAncienne = siennes.keys().next();
      if (plusAncienne.done === true) break;
      siennes.delete(plusAncienne.value);
    }
    this.parJoueur.set(joueurId, siennes);
  }

  oublier(joueurId: string): void {
    this.parJoueur.delete(joueurId);
  }
}
