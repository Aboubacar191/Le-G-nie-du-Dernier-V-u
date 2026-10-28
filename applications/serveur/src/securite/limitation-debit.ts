// Limitation de débit (ARCHI standards.limitation_debit).
//
//   · 20 commandes par fenêtre glissante de 10 s et par connexion temps réel ;
//     3 dépassements consécutifs ferment la connexion (code 4429) ;
//   · 10 tentatives par minute et par adresse IP sur l'adhésion et l'aperçu ;
//   · 5 créations de session par minute et par adresse IP.
//
// Justification, pas principe : « un client modifié ne doit pas pouvoir inonder
// le serveur pendant une phase de 20 s, ni tenter des enquêtes en rafale pour
// sonder le refus par SOLDE_INSUFFISANT ». Le balayage de codes d'adhésion est
// l'autre raison : six caractères se devinent si on peut essayer sans limite.

const MS_PAR_MINUTE = 60_000;

export interface Quota {
  readonly maximum: number;
  readonly fenetre_ms: number;
}

export const QUOTA_CREATION_SESSION: Quota = { maximum: 5, fenetre_ms: MS_PAR_MINUTE };
export const QUOTA_ADHESION: Quota = { maximum: 10, fenetre_ms: MS_PAR_MINUTE };

export class FenetreGlissante {
  private readonly empreintes = new Map<string, number[]>();

  private readonly quota: Quota;
  private readonly maintenant: () => number;

  constructor(quota: Quota, maintenant: () => number) {
    this.quota = quota;
    this.maintenant = maintenant;
  }

  /** Vrai si l'appel est autorisé ; il est alors compté. */
  autoriser(cle: string): boolean {
    const instant = this.maintenant();
    const depuis = instant - this.quota.fenetre_ms;
    const recents = (this.empreintes.get(cle) ?? []).filter((date) => date > depuis);
    if (recents.length >= this.quota.maximum) {
      this.empreintes.set(cle, recents);
      return false;
    }
    recents.push(instant);
    this.empreintes.set(cle, recents);
    return true;
  }

  oublier(cle: string): void {
    this.empreintes.delete(cle);
  }
}
