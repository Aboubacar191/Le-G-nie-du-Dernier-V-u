// Outillage de test : une table de jeu scriptée, déterministe.
//
// Aucun test ne lit l'horloge système ni Math.random (ARCHI strategie_tests) :
// l'aléa et l'horloge sont injectés ici, et l'instant n'avance que quand un
// test le décide. Une phase de négociation de 120 secondes se traverse donc
// instantanément — un test qui attendrait réellement ne serait pas un test.

import {
  CONFIG_DEFAUT,
  type Clause,
  type ConfigJeu,
  type Phase,
  type TypeCommande,
} from '@gdv/partage';
import {
  abandonnerParInactivite,
  appliquer,
  cloturer,
  creerAleaSfc32,
  creerSession,
  expirerPhase,
  rejoindreSession,
  projeterEvenement,
  projeterVuePrivee,
  type Alea,
  type ContexteMoteur,
  type Effet,
  type EtatSession,
  type Resultat,
} from '@gdv/moteur';

const GRAINE_PAR_DEFAUT = 'graine-de-test-deterministe';
const PAS_HORLOGE_MS = 1000;

/**
 * Aléa SCRIPTÉ : une file de valeurs prédéterminées, puis un générateur semé
 * quand la file est vide. C'est ce qui permet de forcer un cas limite —
 * égalité sur le plus gros paiement, aucun gabarit éligible — sans tâtonner sur
 * des graines.
 */
export function aleaScripte(valeurs: readonly number[], graine = GRAINE_PAR_DEFAUT): Alea {
  const file = [...valeurs];
  const secours = creerAleaSfc32(graine);
  const entier = (min: number, max: number): number => {
    if (file.length === 0) return secours.entier(min, max);
    const valeur = file.shift() ?? min;
    return Math.min(Math.max(valeur, min), max);
  };
  return {
    entier,
    choisir: <T,>(liste: readonly T[]): T => {
      const element = liste[entier(0, liste.length - 1)];
      if (element === undefined) throw new Error('choisir sur une liste vide');
      return element;
    },
    melanger: <T,>(liste: readonly T[]): readonly T[] => {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = entier(0, i);
        const ici = copie[i] as T;
        copie[i] = copie[j] as T;
        copie[j] = ici;
      }
      return copie;
    },
    booleen: () => entier(0, 1) === 1,
  };
}

export interface OptionsTable {
  readonly joueurs?: number;
  readonly config?: Partial<ConfigJeu>;
  readonly mode_avance?: boolean;
  readonly graine?: string;
  readonly alea?: Alea;
  readonly parties_terminees?: number;
}

let compteurIdentifiant = 0;

function identifiantTest(prefixe: string): string {
  compteurIdentifiant += 1;
  return `${prefixe}-${String(compteurIdentifiant).padStart(8, '0')}`;
}

export interface TrameEmise {
  readonly type: string;
  readonly destinataire: string;
  readonly charge: Readonly<Record<string, unknown>>;
}

/**
 * Couple (état, effet) à l'instant exact de la projection. Les tests de
 * propriété en ont besoin : la question « ce destinataire avait-il le droit de
 * voir cette valeur ? » ne se décide que contre l'état d'alors.
 */
export interface EmissionEnregistree {
  readonly etat: EtatSession;
  readonly effet: Effet;
}

export class Table {
  etat: EtatSession;
  instant = 1_700_000_000_000;
  /**
   * TOUTES les trames réellement projetées depuis le début du scénario, par
   * destinataire. C'est le matériau des critères de non-fuite (CA-05, CA-10,
   * CA-36, CA-39) : on n'y cherche pas ce que le code « devrait » envoyer, mais
   * ce qu'il a envoyé.
   */
  readonly trames: TrameEmise[] = [];
  /** Tous les couples (état, effet) projetés depuis le début du scénario. */
  readonly emissions: EmissionEnregistree[] = [];
  private readonly alea: Alea;
  private compteur = 0;

  constructor(options: OptionsTable = {}) {
    const nb = options.joueurs ?? 6;
    const config: ConfigJeu = { ...CONFIG_DEFAUT, ...(options.config ?? {}) };
    this.alea = options.alea ?? creerAleaSfc32(options.graine ?? GRAINE_PAR_DEFAUT);

    let etat = creerSession({
      session_id: identifiantTest('session'),
      code_adhesion: 'ABCDEF',
      config,
      mode_avance_actif: options.mode_avance ?? false,
      groupe: {
        id: identifiantTest('groupe'),
        parties_terminees: options.parties_terminees ?? 0,
        parties_requises: config.parties_requises_pour_debloquer_dernier_voeu,
      },
      hote: { joueur_id: 'J0', pseudo: 'Hote' },
      maintenant: this.instant,
    });
    for (let index = 1; index < nb; index += 1) {
      const adhesion = rejoindreSession(etat, {
        joueur_id: `J${index}`,
        pseudo: `Joueur${index}`,
      });
      if (!adhesion.ok) throw new Error(`adhésion refusée : ${adhesion.code}`);
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
        return `id-${String(this.compteur).padStart(6, '0')}`;
      },
      ...(auteur === undefined ? {} : { auteur_joueur_id: auteur }),
    };
  }

  /** Avance l'horloge d'un pas : les horodatages restent strictement croissants. */
  private tic(): void {
    this.instant += PAS_HORLOGE_MS;
  }

  /**
   * Projette les effets vers CHAQUE joueur, exactement comme le fait la boucle
   * de session du serveur, et conserve ce qui est sorti. Le transport ne filtre
   * rien : si une trame apparaît ici, elle est réellement partie.
   */
  private enregistrerTrames(etat: EtatSession, effets: readonly Effet[]): void {
    for (const effet of effets) {
      this.emissions.push({ etat, effet });
      for (const joueur of etat.joueurs) {
        const charge = projeterEvenement(etat, effet, joueur.id);
        if (charge === null) continue;
        this.trames.push({ type: effet.type, destinataire: joueur.id, charge });
      }
    }
  }

  /** Trames reçues par un joueur, éventuellement filtrées par type. */
  tramesDe(joueurId: string, type?: string): readonly TrameEmise[] {
    return this.trames.filter(
      (trame) => trame.destinataire === joueurId && (type === undefined || trame.type === type),
    );
  }

  cmd(auteur: string, type: TypeCommande, charge: Record<string, unknown> = {}): Resultat {
    this.tic();
    const resultat = appliquer(this.etat, { type, charge }, this.contexte(auteur));
    if (resultat.ok) {
      this.etat = resultat.etat;
      this.enregistrerTrames(resultat.etat, resultat.effets);
    }
    return resultat;
  }

  /** Exige le succès : un test qui part d'une mise en place ratée ne prouve rien. */
  exiger(auteur: string, type: TypeCommande, charge: Record<string, unknown> = {}): Resultat {
    const resultat = this.cmd(auteur, type, charge);
    if (!resultat.ok) {
      const erreur = resultat.erreur as { code: string; message: string };
      throw new Error(`${type} refusée : ${erreur.code} — ${erreur.message}`);
    }
    return resultat;
  }

  expirer(): Resultat {
    this.tic();
    const resultat = expirerPhase(this.etat, this.contexte());
    if (resultat.ok) {
      this.etat = resultat.etat;
      this.enregistrerTrames(resultat.etat, resultat.effets);
    }
    const suite = cloturer(this.etat, this.contexte());
    if (suite.ok) {
      this.etat = suite.etat;
      this.enregistrerTrames(suite.etat, suite.effets);
    }
    return resultat;
  }

  abandonnerParInactivite(): Resultat {
    this.tic();
    const resultat = abandonnerParInactivite(this.etat, this.contexte());
    if (resultat.ok) {
      this.etat = resultat.etat;
      this.enregistrerTrames(resultat.etat, resultat.effets);
    }
    return resultat;
  }

  /** Vue privée projetée pour un joueur : ce qu'il reçoit à la reconnexion. */
  vuePrivee(joueurId: string): Readonly<Record<string, unknown>> | null {
    const charge = projeterVuePrivee(this.etat, joueurId);
    return charge === null ? null : (charge as unknown as Readonly<Record<string, unknown>>);
  }

  /** Démarre la partie jusqu'à l'ouverture de la manche 1, phase VOEU. */
  demarrer(): this {
    this.exiger('J0', 'demarrer_partie');
    this.exiger('J0', 'definir_ordre_places', { ordre: this.joueurs });
    return this;
  }

  /** Avance par expirations successives jusqu'à la phase demandée. */
  allerA(phase: Phase, limite = 40): this {
    let pas = 0;
    while (this.etat.phase !== phase && pas < limite) {
      this.expirer();
      pas += 1;
    }
    if (this.etat.phase !== phase) {
      throw new Error(`phase ${phase} non atteinte (phase courante : ${String(this.etat.phase)})`);
    }
    return this;
  }

  /**
   * FIXTURE : impose la clause de la manche courante. Le tirage sans remise est
   * testé ailleurs (CA-13) ; ici on isole l'effet de la clause sur le pipeline,
   * sans dépendre d'une graine qui l'aurait tirée.
   */
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

  /** FIXTURE : impose le rôle d'un joueur, pour isoler l'effet d'un pouvoir. */
  imposerRole(joueurId: string, role: EtatSession['joueurs'][number]['role_secret']): this {
    this.etat = {
      ...this.etat,
      joueurs: this.etat.joueurs.map((joueur) =>
        joueur.id === joueurId ? { ...joueur, role_secret: role } : joueur,
      ),
    };
    return this;
  }

  /** FIXTURE : impose la mission d'un joueur. */
  imposerMission(
    joueurId: string,
    mission: EtatSession['joueurs'][number]['mission_secrete'],
  ): this {
    this.etat = {
      ...this.etat,
      joueurs: this.etat.joueurs.map((joueur) =>
        joueur.id === joueurId ? { ...joueur, mission_secrete: mission } : joueur,
      ),
    };
    return this;
  }

  /** Déclare puis paie pour chaque joueur, dans l'ordre d'arrivée. */
  declarerEtPayer(couples: readonly (readonly [number, number])[]): this {
    this.joueurs.forEach((joueur, index) => {
      const couple = couples[index];
      if (couple === undefined) return;
      this.exiger(joueur, 'declarer_contribution', { montant: couple[0] });
    });
    this.joueurs.forEach((joueur, index) => {
      const couple = couples[index];
      if (couple === undefined) return;
      this.exiger(joueur, 'payer_secret', { montant: couple[1] });
    });
    return this;
  }

  solde(joueurId: string): number {
    const joueur = this.etat.joueurs.find((candidat) => candidat.id === joueurId);
    if (joueur === undefined) throw new Error(`joueur inconnu : ${joueurId}`);
    return joueur.solde_pieces;
  }

  manche(numero = this.etat.manche_courante): EtatSession['manches'][number] {
    const manche = this.etat.manches.find((candidate) => candidate.numero === numero);
    if (manche === undefined) throw new Error(`manche ${numero} absente`);
    return manche;
  }
}

/** Table déjà distribuée, en phase DECLARATION_PAIEMENT de la manche 1. */
export function tableEnDeclaration(options: OptionsTable = {}): Table {
  return new Table(options).demarrer().allerA('DECLARATION_PAIEMENT');
}
