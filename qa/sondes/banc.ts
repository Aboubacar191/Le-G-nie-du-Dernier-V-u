// BANC D'AUDIT — écrit par l'ingénieur QA, indépendant de tests/aide/table.ts.
//
// Pilote le moteur par ses SEULES portes publiques (appliquer, expirerPhase,
// cloturer) et enregistre toutes les trames réellement projetées, destinataire
// par destinataire, exactement comme la boucle de session du serveur.
//
// Ce fichier ne contient AUCUNE assertion : les sondes mesurent, lui transporte.

import { CONFIG_DEFAUT, type Clause, type ConfigJeu, type Phase, type TypeCommande } from '@gdv/partage';
import {
  appliquer,
  cloturer,
  creerAleaSfc32,
  creerSession,
  expirerPhase,
  projeterEvenement,
  projeterVuePrivee,
  rejoindreSession,
  type Alea,
  type ContexteMoteur,
  type Effet,
  type EtatSession,
  type Resultat,
} from '@gdv/moteur';

const INSTANT_ZERO = 1_750_000_000_000;
const PAS_MS = 1000;

export interface Trame {
  readonly ordre: number;
  readonly type: string;
  readonly pour: string;
  readonly charge: Readonly<Record<string, unknown>>;
  readonly phase: Phase | null;
  readonly manche: number;
  readonly octets: number;
}

export interface OptionsBanc {
  readonly joueurs?: number;
  readonly graine?: string;
  readonly config?: Partial<ConfigJeu>;
  readonly mode_avance?: boolean;
  readonly parties_terminees?: number;
}

export class Banc {
  etat: EtatSession;
  instant = INSTANT_ZERO;
  readonly trames: Trame[] = [];
  private readonly alea: Alea;
  private compteur = 0;
  private ordre = 0;

  constructor(options: OptionsBanc = {}) {
    const nb = options.joueurs ?? 6;
    const config: ConfigJeu = { ...CONFIG_DEFAUT, ...(options.config ?? {}) };
    this.alea = creerAleaSfc32(options.graine ?? 'graine-audit-qa-s6');
    let etat = creerSession({
      session_id: 'session-audit',
      code_adhesion: 'QAQAQA',
      config,
      mode_avance_actif: options.mode_avance ?? false,
      groupe: {
        id: 'groupe-audit',
        parties_terminees: options.parties_terminees ?? 0,
        parties_requises: config.parties_requises_pour_debloquer_dernier_voeu,
      },
      hote: { joueur_id: 'J0', pseudo: 'Hote' },
      maintenant: this.instant,
    });
    for (let i = 1; i < nb; i += 1) {
      const adhesion = rejoindreSession(etat, { joueur_id: `J${i}`, pseudo: `P${i}` });
      if (!adhesion.ok) throw new Error(`adhesion refusee : ${adhesion.code}`);
      etat = adhesion.etat;
    }
    this.etat = etat;
  }

  get joueurs(): readonly string[] {
    return this.etat.joueurs.map((joueur) => joueur.id);
  }

  contexte(auteur?: string): ContexteMoteur {
    return {
      alea: this.alea,
      horloge: { maintenant: () => this.instant },
      identifiant: () => {
        this.compteur += 1;
        return `qa-${String(this.compteur).padStart(6, '0')}`;
      },
      ...(auteur === undefined ? {} : { auteur_joueur_id: auteur }),
    };
  }

  private noter(etat: EtatSession, effets: readonly Effet[]): void {
    for (const effet of effets) {
      for (const joueur of etat.joueurs) {
        const charge = projeterEvenement(etat, effet, joueur.id);
        if (charge === null) continue;
        this.ordre += 1;
        this.trames.push({
          ordre: this.ordre,
          type: effet.type,
          pour: joueur.id,
          charge,
          phase: etat.phase,
          manche: etat.manche_courante,
          octets: JSON.stringify(charge).length,
        });
      }
    }
  }

  cmd(auteur: string, type: TypeCommande, charge: Record<string, unknown> = {}): Resultat {
    this.instant += PAS_MS;
    const resultat = appliquer(this.etat, { type, charge }, this.contexte(auteur));
    if (resultat.ok) {
      this.etat = resultat.etat;
      this.noter(resultat.etat, resultat.effets);
    }
    return resultat;
  }

  exiger(auteur: string, type: TypeCommande, charge: Record<string, unknown> = {}): Resultat {
    const resultat = this.cmd(auteur, type, charge);
    if (!resultat.ok) {
      const erreur = resultat.erreur as { code: string; message: string };
      throw new Error(`${type} refusee : ${erreur.code} — ${erreur.message}`);
    }
    return resultat;
  }

  expirer(): Resultat {
    this.instant += PAS_MS;
    const resultat = expirerPhase(this.etat, this.contexte());
    if (resultat.ok) {
      this.etat = resultat.etat;
      this.noter(resultat.etat, resultat.effets);
    }
    const suite = cloturer(this.etat, this.contexte());
    if (suite.ok) {
      this.etat = suite.etat;
      this.noter(suite.etat, suite.effets);
    }
    return resultat;
  }

  demarrer(ordre?: readonly string[]): this {
    this.exiger('J0', 'demarrer_partie');
    this.exiger('J0', 'definir_ordre_places', { ordre: ordre ?? this.joueurs });
    return this;
  }

  allerA(phase: Phase, limite = 60): this {
    let pas = 0;
    while (this.etat.phase !== phase && pas < limite) {
      this.expirer();
      pas += 1;
    }
    if (this.etat.phase !== phase) throw new Error(`phase ${phase} non atteinte`);
    return this;
  }

  /** FIXTURE d'audit : impose la clause de la manche courante (le tirage est aléatoire). */
  imposerClause(clause: Clause): this {
    this.etat = {
      ...this.etat,
      manches: this.etat.manches.map((manche) =>
        manche.numero === this.etat.manche_courante ? { ...manche, clause_cle: clause } : manche,
      ),
      clauses_disponibles: this.etat.clauses_disponibles.filter((cle) => cle !== clause),
    };
    return this;
  }

  /** FIXTURE d'audit : impose un rôle, pour neutraliser ou isoler un pouvoir. */
  imposerRole(joueurId: string, role: EtatSession['joueurs'][number]['role_secret']): this {
    this.etat = {
      ...this.etat,
      joueurs: this.etat.joueurs.map((joueur) =>
        joueur.id === joueurId ? { ...joueur, role_secret: role } : joueur,
      ),
    };
    return this;
  }

  /** FIXTURE d'audit : impose une mission, pour éprouver un doublon de mission. */
  imposerMission(joueurId: string, mission: EtatSession['joueurs'][number]['mission_secrete']): this {
    this.etat = {
      ...this.etat,
      joueurs: this.etat.joueurs.map((joueur) =>
        joueur.id === joueurId ? { ...joueur, mission_secrete: mission } : joueur,
      ),
    };
    return this;
  }

  declarerPuisPayer(couples: readonly (readonly [number, number])[]): this {
    this.joueurs.forEach((joueur, index) => {
      const couple = couples[index];
      if (couple !== undefined) this.exiger(joueur, 'declarer_contribution', { montant: couple[0] });
    });
    this.joueurs.forEach((joueur, index) => {
      const couple = couples[index];
      if (couple !== undefined) this.exiger(joueur, 'payer_secret', { montant: couple[1] });
    });
    return this;
  }

  solde(joueurId: string): number {
    const joueur = this.etat.joueurs.find((candidat) => candidat.id === joueurId);
    if (joueur === undefined) throw new Error(`joueur inconnu ${joueurId}`);
    return joueur.solde_pieces;
  }

  manche(numero = this.etat.manche_courante): EtatSession['manches'][number] {
    const manche = this.etat.manches.find((candidate) => candidate.numero === numero);
    if (manche === undefined) throw new Error(`manche ${numero} absente`);
    return manche;
  }

  pour(joueurId: string, type?: string): readonly Trame[] {
    return this.trames.filter(
      (trame) => trame.pour === joueurId && (type === undefined || trame.type === type),
    );
  }

  vuePrivee(joueurId: string): Readonly<Record<string, unknown>> | null {
    const charge = projeterVuePrivee(this.etat, joueurId);
    return charge === null ? null : (charge as unknown as Readonly<Record<string, unknown>>);
  }
}

// --- Journal de sonde --------------------------------------------------------

let echecs = 0;

export function mesure(libelle: string, valeur: unknown): void {
  console.log(`  MESURE  ${libelle} = ${JSON.stringify(valeur)}`);
}

export function verdict(libelle: string, conforme: boolean, detail = ''): void {
  if (!conforme) echecs += 1;
  console.log(`  ${conforme ? 'CONFORME    ' : 'NON_CONFORME'} ${libelle}${detail === '' ? '' : ` — ${detail}`}`);
}

export function titre(texte: string): void {
  console.log(`\n=== ${texte}`);
}

export function bilan(nom: string): void {
  console.log(`\nBILAN ${nom} : ${echecs === 0 ? 'aucun écart' : `${String(echecs)} écart(s)`}`);
  if (echecs > 0) process.exitCode = 1;
}
