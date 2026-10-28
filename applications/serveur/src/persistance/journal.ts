// Rejeu du journal de commandes — ADR-TL-05.
//
// « Le moteur est pur et déterministe. Il faut reconstruire, après un arrêt, un
//   état de session qui comprend non seulement les données normalisées mais
//   aussi l'état TRANSITOIRE : échéance de phase, ensemble des suspects
//   publics, accusations non liquidées, prêts en cours, position dans la
//   séquence de tirages aléatoires. »
//
// C'est pourquoi la reconstruction se fait par REJEU et non par lecture des
// tables : aucune table ne porte la position du générateur d'aléa, et c'est
// elle qui décide des clauses des manches suivantes.
//
// Les expirations de minuteur sont journalisées comme transitions SYSTÈME. Sans
// elles, le rejeu ne pourrait pas reconstruire une partie : le temps fait
// avancer le jeu autant que les commandes. Elles portent un préfixe réservé et
// aucun joueur_id — aucune ne peut donc être confondue avec une commande client
// (CA-50).

import type { TypeCommande } from '@gdv/partage';
import { creerSession, rejoindreSession, type EtatSession } from '@gdv/moteur';
import { estTypeCommande, type ConfigJeu } from '@gdv/partage';

import { Partie } from '../orchestration/partie.ts';
import { TRANSITION_SYSTEME } from '../orchestration/boucle-session.ts';
import type { Depot, EnregistrementSession, LigneJournal } from './depot.ts';

/** Reconstruit l'état d'avant toute commande : joueurs inscrits, rien de distribué. */
export function etatInitial(
  depot: Depot,
  session: EnregistrementSession,
  partiesTermineesALaCreation: number,
): EtatSession {
  const joueurs = depot.joueursDe(session.id);
  const hote = joueurs[0];
  if (hote === undefined) {
    throw new Error(`Session ${session.id} sans joueur : rejeu impossible.`);
  }
  const config = JSON.parse(session.config_json) as ConfigJeu;
  const groupe = depot.groupeParId(session.groupe_id);
  if (groupe === undefined) {
    throw new Error(`Groupe ${session.groupe_id} introuvable : rejeu impossible.`);
  }

  let etat = creerSession({
    session_id: session.id,
    code_adhesion: session.code_adhesion,
    config,
    mode_avance_actif: session.mode_avance_actif,
    groupe: {
      id: groupe.id,
      parties_terminees: partiesTermineesALaCreation,
      parties_requises: config.parties_requises_pour_debloquer_dernier_voeu,
    },
    hote: { joueur_id: hote.id, pseudo: hote.pseudo },
    maintenant: session.cree_le,
  });

  for (const joueur of joueurs.slice(1)) {
    const adhesion = rejoindreSession(etat, { joueur_id: joueur.id, pseudo: joueur.pseudo });
    if (!adhesion.ok) {
      throw new Error(`Rejeu impossible : adhésion refusée (${adhesion.code}) pour ${joueur.id}.`);
    }
    etat = adhesion.etat;
  }
  return etat;
}

function appliquerLigne(partie: Partie, ligne: LigneJournal): void {
  partie.figerInstant(ligne.horodatage_serveur);
  if (ligne.type_commande === TRANSITION_SYSTEME.expirationPhase) {
    partie.expirerPhaseCourante();
    return;
  }
  if (ligne.type_commande === TRANSITION_SYSTEME.cloturePartie) {
    partie.cloturerSiNecessaire();
    return;
  }
  if (ligne.type_commande === TRANSITION_SYSTEME.abandonInactivite) return;
  if (ligne.joueur_id === null || !estTypeCommande(ligne.type_commande)) return;
  const charge = JSON.parse(ligne.charge_json) as Readonly<Record<string, unknown>>;
  partie.appliquerCommande(ligne.type_commande as TypeCommande, charge, ligne.joueur_id);
}

/**
 * Rejoue une session entière. Le résultat doit être IDENTIQUE à l'état qui était
 * en mémoire avant l'arrêt : c'est l'assertion du test de rejeu, et elle vaut
 * aussi comme test de déterminisme du moteur.
 */
export function rejouerSession(depot: Depot, session: EnregistrementSession): Partie {
  const journal = depot.journalDe(session.id);
  const clotures = journal.filter(
    (ligne) => ligne.type_commande === TRANSITION_SYSTEME.cloturePartie,
  ).length;
  const groupe = depot.groupeParId(session.groupe_id);
  const partiesInitiales = (groupe?.parties_terminees ?? 0) - clotures;

  const partie = new Partie(
    etatInitial(depot, session, partiesInitiales),
    session.graine_alea,
    session.cree_le,
  );
  for (const ligne of journal) appliquerLigne(partie, ligne);
  return partie;
}

/** Rejoue toutes les sessions encore vivantes. Appelé au démarrage du serveur. */
export function rejouerSessionsVivantes(depot: Depot): readonly Partie[] {
  return depot.sessionsVivantes().map((session) => rejouerSession(depot, session));
}
