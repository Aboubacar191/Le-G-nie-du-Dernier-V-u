// Assemblage du service : ce qui est partagé par le REST, le temps réel et les
// tests. Aucune règle de jeu ici — uniquement du câblage.
//
// L'horloge est injectée jusqu'au bout. Un test qui attendrait réellement 120
// secondes de négociation ne serait pas un test : il serait une attente.

import { CONFIG_DEFAUT, VERSION_PROTOCOLE, fusionnerConfig, type ConfigJeu } from '@gdv/partage';
import { creerSession, rejoindreSession } from '@gdv/moteur';

import type { Depot } from './persistance/depot.ts';
import { rejouerSessionsVivantes } from './persistance/journal.ts';
import { BoucleSession } from './orchestration/boucle-session.ts';
import { OrdonnanceurPhases } from './orchestration/ordonnanceur-phases.ts';
import { Partie } from './orchestration/partie.ts';
import { Diffuseur } from './temps-reel/diffuseur.ts';
import { RegistreConnexions } from './temps-reel/registre-connexions.ts';
import { MemoireCorrelation } from './temps-reel/correlation.ts';
import {
  creerCodeAdhesion,
  creerGraine,
  creerIdentifiant,
  creerJeton,
  hacher,
} from './securite/jetons.ts';
import {
  FenetreGlissante,
  QUOTA_ADHESION,
  QUOTA_CREATION_SESSION,
} from './securite/limitation-debit.ts';

export interface Service {
  readonly depot: Depot;
  readonly registre: RegistreConnexions;
  readonly diffuseur: Diffuseur;
  readonly boucle: BoucleSession;
  readonly ordonnanceur: OrdonnanceurPhases;
  readonly correlation: MemoireCorrelation;
  readonly maintenant: () => number;
  /**
   * Tirage de la graine d'aléa de session. Injecté comme l'horloge, et pour la
   * même raison : un scénario de test doit être REPRODUCTIBLE. En exploitation,
   * c'est crypto.randomBytes qui tire — la graine n'entre JAMAIS par une requête
   * cliente, car la connaître permettrait de recalculer rôles, missions,
   * clauses et porteurs (ARCHI sessions.graine_alea).
   */
  readonly tirerGraine: () => string;
  readonly version_protocole: string;
  readonly quotaCreation: FenetreGlissante;
  readonly quotaAdhesion: FenetreGlissante;
}

export function creerService(
  depot: Depot,
  maintenant: () => number = () => Date.now(),
  tirerGraine: () => string = creerGraine,
): Service {
  const registre = new RegistreConnexions();
  const diffuseur = new Diffuseur(registre, maintenant);
  const boucle = new BoucleSession(depot, diffuseur, maintenant);
  const ordonnanceur = new OrdonnanceurPhases(boucle, maintenant);
  return {
    depot,
    registre,
    diffuseur,
    boucle,
    ordonnanceur,
    correlation: new MemoireCorrelation(),
    maintenant,
    tirerGraine,
    version_protocole: VERSION_PROTOCOLE,
    quotaCreation: new FenetreGlissante(QUOTA_CREATION_SESSION, maintenant),
    quotaAdhesion: new FenetreGlissante(QUOTA_ADHESION, maintenant),
  };
}

/** Rejeu des sessions vivantes au démarrage, puis reprise des minuteries. */
export function reprendre(service: Service): void {
  for (const partie of rejouerSessionsVivantes(service.depot)) {
    service.boucle.inscrire(partie);
  }
  service.ordonnanceur.reprogrammerTout();
}

export interface DemandeCreation {
  readonly pseudo: string;
  readonly jeton_groupe?: string | null;
  readonly config_surchargee?: unknown;
  readonly activer_mode_avance?: boolean | null;
}

export type ResultatCreation =
  | {
      readonly ok: true;
      readonly session_id: string;
      readonly code_adhesion: string;
      readonly joueur_id: string;
      readonly jeton_session: string;
      readonly jeton_groupe: string;
      readonly mode_avance_actif: boolean;
      readonly config: ConfigJeu;
    }
  | { readonly ok: false; readonly code: 'JETON_INVALIDE'; readonly erreurs: null }
  | {
      readonly ok: false;
      readonly code: 'CONFIG_INVALIDE';
      readonly erreurs: Readonly<Record<string, readonly string[]>>;
    };

interface GroupeResolu {
  readonly id: string;
  readonly jeton: string;
  readonly parties_terminees: number;
}

/**
 * Groupe rattaché, ou groupe neuf. Le jeton de groupe n'est émis qu'à la
 * CRÉATION d'un groupe : un jeton fourni est reconnu ou refusé, jamais réémis.
 */
function resoudreGroupe(
  service: Service,
  jetonFourni: string | null | undefined,
  instant: number,
): GroupeResolu | null {
  if (jetonFourni !== undefined && jetonFourni !== null) {
    const groupe = service.depot.groupeParJeton(hacher(jetonFourni));
    if (groupe === undefined) return null;
    return {
      id: groupe.id,
      jeton: jetonFourni,
      parties_terminees: groupe.parties_terminees,
    };
  }
  const id = creerIdentifiant();
  const jeton = creerJeton();
  service.depot.creerGroupe({ id, jeton_hache: hacher(jeton), maintenant: instant });
  return { id, jeton, parties_terminees: 0 };
}

interface InscriptionSession {
  readonly sessionId: string;
  readonly code: string;
  readonly groupeId: string;
  readonly graine: string;
  readonly config: string;
  readonly modeAvance: boolean;
  readonly instant: number;
  readonly joueurId: string;
  readonly pseudo: string;
  readonly jetonSession: string;
}

/** Écrit la session et son hôte. Les jetons n'y entrent que HACHÉS (ADR-TL-15). */
function inscrireSession(service: Service, inscription: InscriptionSession): void {
  service.depot.creerSession({
    id: inscription.sessionId,
    code_adhesion: inscription.code,
    groupe_id: inscription.groupeId,
    graine_alea: inscription.graine,
    config_json: inscription.config,
    mode_avance_actif: inscription.modeAvance,
    version_protocole: service.version_protocole,
    cree_le: inscription.instant,
  });
  service.depot.ajouterJoueur(inscription.sessionId, {
    id: inscription.joueurId,
    pseudo: inscription.pseudo,
    jeton_hache: hacher(inscription.jetonSession),
    est_hote: true,
    ordre_arrivee: 0,
  });
}

/**
 * Création d'une session. mode_avance_actif est calculé depuis
 * parties_terminees du groupe (RG-50, CA-47), ou forcé par l'interrupteur de
 * test de l'hôte. La configuration effective est FIGÉE ici : une partie ne
 * change pas de règles en cours de route, et le rejeu reste exact.
 */
export function creerPartie(service: Service, demande: DemandeCreation): ResultatCreation {
  const fusion = fusionnerConfig(demande.config_surchargee ?? undefined);
  if (!fusion.ok) return { ok: false, code: 'CONFIG_INVALIDE', erreurs: fusion.erreurs };

  const instant = service.maintenant();
  const groupe = resoudreGroupe(service, demande.jeton_groupe, instant);
  if (groupe === null) return { ok: false, code: 'JETON_INVALIDE', erreurs: null };
  const { id: groupeId, jeton: jetonGroupe, parties_terminees: partiesTerminees } = groupe;

  const requises = fusion.config.parties_requises_pour_debloquer_dernier_voeu;
  const modeAvance = demande.activer_mode_avance === true || partiesTerminees >= requises;

  const sessionId = creerIdentifiant();
  const joueurId = creerIdentifiant();
  const jetonSession = creerJeton();
  const graine = service.tirerGraine();
  const code = creerCodeAdhesion();

  inscrireSession(service, {
    sessionId,
    code,
    groupeId,
    graine,
    config: JSON.stringify(fusion.config),
    modeAvance,
    instant,
    joueurId,
    pseudo: demande.pseudo,
    jetonSession,
  });

  const etat = creerSession({
    session_id: sessionId,
    code_adhesion: code,
    config: fusion.config,
    mode_avance_actif: modeAvance,
    groupe: { id: groupeId, parties_terminees: partiesTerminees, parties_requises: requises },
    hote: { joueur_id: joueurId, pseudo: demande.pseudo },
    maintenant: instant,
  });
  service.boucle.inscrire(new Partie(etat, graine, instant));
  service.depot.synchroniser(etat);

  return {
    ok: true,
    session_id: sessionId,
    code_adhesion: code,
    joueur_id: joueurId,
    jeton_session: jetonSession,
    jeton_groupe: jetonGroupe,
    mode_avance_actif: modeAvance,
    config: fusion.config,
  };
}

export type ResultatAdhesionService =
  | {
      readonly ok: true;
      readonly session_id: string;
      readonly joueur_id: string;
      readonly jeton_session: string;
      readonly config: ConfigJeu;
    }
  | {
      readonly ok: false;
      readonly code: 'SESSION_INTROUVABLE' | 'SESSION_PLEINE' | 'PSEUDO_INDISPONIBLE' | 'ETAT_PARTIE_INCOMPATIBLE';
    };

/** Adhésion par code. Le jeton est émis UNE SEULE FOIS (ADR-TL-15). */
export function rejoindrePartie(
  service: Service,
  code: string,
  pseudo: string,
): ResultatAdhesionService {
  const session = service.depot.sessionParCode(code);
  if (session === undefined) return { ok: false, code: 'SESSION_INTROUVABLE' };
  const partie = service.boucle.partie(session.id);
  if (partie === undefined) return { ok: false, code: 'SESSION_INTROUVABLE' };

  const joueurId = creerIdentifiant();
  const etatPartieAvant = partie.etat.etat_partie;
  const adhesion = rejoindreSession(partie.etat, { joueur_id: joueurId, pseudo });
  if (!adhesion.ok) return { ok: false, code: adhesion.code };

  const jeton = creerJeton();
  service.depot.ajouterJoueur(session.id, {
    id: joueurId,
    pseudo,
    jeton_hache: hacher(jeton),
    est_hote: false,
    ordre_arrivee: partie.etat.joueurs.length,
  });
  partie.definirEtat(adhesion.etat);
  service.depot.synchroniser(adhesion.etat);
  service.boucle.annoncerArrivee(partie, joueurId, etatPartieAvant);

  return {
    ok: true,
    session_id: session.id,
    joueur_id: joueurId,
    jeton_session: jeton,
    config: JSON.parse(session.config_json) as ConfigJeu,
  };
}

export { CONFIG_DEFAUT };
