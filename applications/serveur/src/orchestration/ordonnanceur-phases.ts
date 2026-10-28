// Ordonnanceur de phases — le serveur est l'UNIQUE horloge (RG-72).
//
// « Les minuteurs client sont décoratifs et dérivés de phase_fin_at ; une phase
//   ne peut être prolongée ni raccourcie par un client. » Il n'existe aucune
//   commande de prolongation, de pause ou de raccourcissement : avancer_phase
//   est la seule accélération possible, réservée à l'hôte et à la seule phase
//   NEGOCIATION.
//
// Les minuteries sont RECONSTRUITES depuis phase_fin_at au démarrage : après un
// redémarrage, une phase dont l'échéance est déjà passée expire immédiatement,
// et une phase encore en cours reprend avec le temps qu'il lui restait.

import type { BoucleSession } from './boucle-session.ts';

const DELAI_MINIMAL_MS = 0;

export class OrdonnanceurPhases {
  private readonly minuteries = new Map<string, NodeJS.Timeout>();
  private arrete = false;

  private readonly boucle: BoucleSession;
  private readonly maintenant: () => number;

  constructor(boucle: BoucleSession, maintenant: () => number) {
    this.boucle = boucle;
    this.maintenant = maintenant;
  }

  /** Programme (ou reprogramme) l'échéance de la phase courante d'une session. */
  programmer(sessionId: string): void {
    this.annuler(sessionId);
    if (this.arrete) return;
    const partie = this.boucle.partie(sessionId);
    if (partie === undefined) return;
    const echeance = partie.etat.phase_fin_at;
    if (echeance === null) return;

    const delai = Math.max(echeance - this.maintenant(), DELAI_MINIMAL_MS);
    const minuterie = setTimeout(() => {
      this.minuteries.delete(sessionId);
      this.boucle.traiterExpiration(partie);
      this.programmer(sessionId);
    }, delai);
    minuterie.unref?.();
    this.minuteries.set(sessionId, minuterie);
  }

  annuler(sessionId: string): void {
    const minuterie = this.minuteries.get(sessionId);
    if (minuterie === undefined) return;
    clearTimeout(minuterie);
    this.minuteries.delete(sessionId);
  }

  /** Reprogramme toutes les sessions vivantes : appelé après un rejeu de démarrage. */
  reprogrammerTout(): void {
    for (const sessionId of this.boucle.sessions()) this.programmer(sessionId);
  }

  arreter(): void {
    this.arrete = true;
    for (const sessionId of [...this.minuteries.keys()]) this.annuler(sessionId);
  }
}
