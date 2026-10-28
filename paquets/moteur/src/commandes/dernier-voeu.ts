// Commande signer_dernier_voeu — US-14.
//
// RG-54 / CA-39 : la signature est SECRÈTE. Aucun autre joueur n'apprend qui a
// signé avant l'écran de scores. La commande ne produit donc AUCUN effet
// projetable : seul l'accusé de réception, construit par le transport, revient
// à son auteur. C'est volontaire — tout effet émis ici, même vide, trahirait
// qu'un joueur vient d'agir pendant une phase de dix secondes.

import type { ContexteMoteur, EtatSession } from '../etat/types.ts';
import { auteurDe, booleenDe, refus, succes, type ResultatCommande } from './resultat.ts';

export function signerDernierVoeu(
  etat: EtatSession,
  charge: Readonly<Record<string, unknown>>,
  contexte: ContexteMoteur,
): ResultatCommande {
  const auteur = auteurDe(contexte);
  if (!etat.mode_avance_actif) {
    return refus(etat, 'MODE_AVANCE_INACTIF', 'Le mode avancé n’est pas actif sur cette session.');
  }
  const aSigne = booleenDe(charge, 'a_signe');
  if (aSigne === null) {
    return refus(etat, 'MESSAGE_MALFORME', 'Signature absente.');
  }
  const ligne = etat.signatures.find((signature) => signature.joueur_id === auteur);
  if (ligne === undefined) {
    return refus(etat, 'ETAT_PARTIE_INCOMPATIBLE', 'Le Dernier Vœu n’est pas ouvert.');
  }
  if (ligne.a_signe !== null) {
    return refus(etat, 'DEJA_SOUMIS', 'La signature est déjà soumise.');
  }

  return succes(
    {
      ...etat,
      signatures: etat.signatures.map((signature) =>
        signature.joueur_id === auteur
          ? { ...signature, a_signe: aSigne, cree_at: contexte.horloge.maintenant() }
          : signature,
      ),
    },
    [],
  );
}
