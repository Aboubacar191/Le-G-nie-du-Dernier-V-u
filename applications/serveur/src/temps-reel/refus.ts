// ACHEMINEMENT D'UN REFUS — RUP-02, RG-80.
//
// « Sa présence n'était émise qu'à l'auteur du refus, et révélait qu'un joueur a
//   TENTÉ un acte, y compris secret, et a été refusé — SOLDE_INSUFFISANT sur une
//   enquête, QUOTA_DEPASSE sur une seconde enquête. »
//
// Un refus part donc à TOUS les joueurs de la session, charge neutre pour ceux
// qui n'en sont pas l'auteur. La liste des EXEMPTÉS est fermée à cinq codes, et
// ce module ne la connaît pas : il interroge estCodeErreurDeProtocole, qui lit
// la liste du contrat. Tous les autres refus y sont SOUMIS sans exception,
// « parce que chacun peut sanctionner un acte SECRET ».
//
// Ce fichier existe séparément pour une raison de taille, au sens littéral :
// serveur-ws.ts dépassait le plafond de 300 lignes de l'ARCHI. Le découpage suit
// la responsabilité — serveur-ws.ts décide QUAND refuser, ce module décide PAR
// QUEL CANAL le refus sort.

import type { WebSocket } from 'ws';

import { estCodeErreurDeProtocole, type CodeErreur } from '@gdv/partage';

import type { BoucleSession } from '../orchestration/boucle-session.ts';
import type { Diffuseur } from './diffuseur.ts';
import type { Connexion } from './registre-connexions.ts';
import { cibleAuPalier, completer, octets } from './remplissage.ts';

/** Aucun destinataire n'existe encore : la séquence ne peut que valoir 1. */
const SEQUENCE_AVANT_AUTHENTIFICATION = 1;

export interface CanalDeRefus {
  readonly diffuseur: Diffuseur;
  readonly boucle: BoucleSession;
  readonly maintenant: () => number;
}

export interface Refus {
  readonly code: CodeErreur;
  readonly message: string;
  readonly id_correlation: string | null;
}

/**
 * Refus sur un socket ANONYME : écriture directe.
 *
 * Il n'appartient encore à aucune session, donc il n'existe pas de liste de
 * destinataires ni de compteur de séquence. Les codes atteignables ici sont
 * JETON_ABSENT, JETON_INVALIDE et MESSAGE_MALFORME, tous trois dans la liste
 * fermée des cinq exemptés : le chemin n'est donc pas une exception de plus.
 *
 * emis_a reste un horodatage réel et non un nul : un client qui calcule son
 * décalage d'horloge sur emis_a (RG-79) ne doit pas avoir à traiter un cas
 * particulier dès sa première trame.
 */
function refuserSocketAnonyme(
  canal: CanalDeRefus,
  socket: WebSocket,
  charge: Readonly<Record<string, unknown>>,
  idCorrelation: string | null,
): void {
  const trame = {
    type: 'erreur',
    sequence: SEQUENCE_AVANT_AUTHENTIFICATION,
    emis_a: new Date(canal.maintenant()).toISOString(),
    id_correlation: idCorrelation,
    charge,
  };
  // RUP-03 : même sur un socket anonyme, la trame est complétée au palier. Une
  // trame nue de 120 octets face à une trame complétée à 1024 distinguerait le
  // refus pré-authentification de tout le reste du trafic.
  socket.send(completer(trame, cibleAuPalier(octets(JSON.stringify(trame)))));
}

/**
 * Achemine un refus. Trois chemins, et les trois sont justifiés au contrat :
 *   · socket NON authentifié — écriture directe, voir ci-dessus ;
 *   · code de PROTOCOLE sur socket authentifié — trame unitaire par envoyerA,
 *     sans consommer de numéro de séquence : la consommer creuserait un trou de
 *     séquence chez les N−1 autres joueurs, qui se reconnecteraient en boucle ;
 *   · refus de JEU — lot émis par l'orchestration, seule couche autorisée à
 *     appeler le moteur (règle de couches, vérifiée par verifier:couches).
 *
 * Un refus de jeu sur un socket authentifié dont la PARTIE est introuvable
 * retombe sur la trame unitaire : sans partie, il n'existe pas de liste de
 * joueurs à projeter. C'est une incohérence interne du serveur, pas un acte de
 * jeu, et le repli est écrit plutôt que silencieusement omis.
 */
export function acheminerRefus(
  canal: CanalDeRefus,
  socket: WebSocket,
  connexion: Connexion | null,
  refus: Refus,
): void {
  const charge = {
    code: refus.code,
    message: refus.message,
    details: null,
    id_correlation: refus.id_correlation,
  };
  if (connexion === null) {
    refuserSocketAnonyme(canal, socket, charge, refus.id_correlation);
    return;
  }
  const partie = estCodeErreurDeProtocole(refus.code)
    ? undefined
    : canal.boucle.partie(connexion.session_id);
  if (partie === undefined) {
    canal.diffuseur.envoyerA(connexion.joueur_id, 'erreur', charge, refus.id_correlation);
    return;
  }
  canal.boucle.emettreRefus(
    partie,
    connexion.joueur_id,
    refus.code,
    refus.message,
    refus.id_correlation,
  );
}
