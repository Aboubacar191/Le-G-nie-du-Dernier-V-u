// Résolution du Dernier Vœu — RG-53, table_resolution de la SPEC.
//
//   0 signataire   : aucun transfert, genie_libere = false, GARDIEN réussit.
//   1 signataire   : il reçoit recompense_signature_dernier_voeu,
//                    genie_libere = true, le MARCHAND_DEJA_LIE gagne seul.
//   2 ou plus      : contrat contesté — aucun signataire ne reçoit les pièces,
//                    chacun perd plancher(solde / 2), genie_libere = false.
//
// RG-54 : seuls le NOMBRE de signataires et la conséquence sont publics à la
// résolution. Les identités ne sortent qu'à l'écran de scores finaux.
//
// La moitié de RG-53 appartient à l'énoncé de la règle, pas aux 21 paramètres
// d'équilibrage : elle est nommée ici, en rationnel entier (ADR-TL-14), et
// n'est surtout pas confondue avec fraction_consolation, qui vaut la même chose
// pour une autre raison.

import type { ConsequenceDernierVoeu, Rationnel } from '@gdv/partage';

import { appliquerMouvements, type ContexteEcriture } from '../etat/mouvements.ts';
import { exigerJoueur } from '../etat/acces.ts';
import { plancher } from '../monnaie/index.ts';
import type { EtatSession } from '../etat/types.ts';

const DENOMINATEUR_MOITIE = 2;
const FRACTION_SANCTION_CONTRAT_CONTESTE: Rationnel = [1, DENOMINATEUR_MOITIE];

export interface ResolutionDernierVoeu {
  readonly etat: EtatSession;
  readonly nb_signataires: number;
  readonly consequence: ConsequenceDernierVoeu;
  readonly genie_libere: boolean;
  readonly joueurs_touches: readonly string[];
}

function signataires(etat: EtatSession): readonly string[] {
  return etat.signatures
    .filter((signature) => signature.a_signe === true)
    .map((signature) => signature.joueur_id);
}

/** 0 signataire : aucun transfert, le génie reste enfermé, le GARDIEN réussit. */
function aucunSignataire(etat: EtatSession): ResolutionDernierVoeu {
  return {
    etat: { ...etat, genie_libere: false },
    nb_signataires: 0,
    consequence: 'AUCUN_SIGNATAIRE',
    genie_libere: false,
    joueurs_touches: [],
  };
}

/** 1 signataire : il encaisse, le génie est libéré, le MARCHAND_DEJA_LIE gagne seul. */
function signataireUnique(
  etat: EtatSession,
  signataire: string,
  ecriture: ContexteEcriture,
): ResolutionDernierVoeu {
  const montant = etat.config.recompense_signature_dernier_voeu;
  const avecPieces =
    montant === 0
      ? etat
      : appliquerMouvements(
          etat,
          [
            {
              joueur_id: signataire,
              delta: montant,
              motif: 'signature_dernier_voeu',
              manche_numero: null,
            },
          ],
          ecriture,
        );
  return {
    etat: { ...avecPieces, genie_libere: true },
    nb_signataires: 1,
    consequence: 'SIGNATAIRE_UNIQUE_RECOMPENSE',
    genie_libere: true,
    joueurs_touches: [signataire],
  };
}

export function resoudreDernierVoeu(
  etat: EtatSession,
  ecriture: ContexteEcriture,
): ResolutionDernierVoeu {
  const signeurs = signataires(etat);
  // premier === undefined équivaut à « aucun signataire » : une seule garde,
  // donc aucune branche non atteignable à couvrir.
  const premier = signeurs[0];
  if (premier === undefined) return aucunSignataire(etat);
  if (signeurs.length === 1) return signataireUnique(etat, premier, ecriture);

  const sanctions = signeurs.map((joueurId) => ({
    joueur_id: joueurId,
    delta: -plancher(
      exigerJoueur(etat, joueurId).solde_pieces,
      FRACTION_SANCTION_CONTRAT_CONTESTE,
    ),
    motif: 'sanction_contrat_conteste' as const,
    manche_numero: null,
  }));
  const sanctionne = appliquerMouvements(etat, sanctions, ecriture);

  return {
    etat: { ...sanctionne, genie_libere: false },
    nb_signataires: signeurs.length,
    consequence: 'CONTRAT_CONTESTE',
    genie_libere: false,
    joueurs_touches: sanctions.filter((s) => s.delta !== 0).map((s) => s.joueur_id),
  };
}
