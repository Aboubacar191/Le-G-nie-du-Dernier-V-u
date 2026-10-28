// ╔════════════════════════════════════════════════════════════════════════╗
// ║  FRONTIÈRE DE SÉCURITÉ — RG-01, priorité 1 du registre.                ║
// ║  SEUL message de classe « tous » qui contienne des données auparavant  ║
// ║  secrètes. Il n'est donc projeté QUE si le classement a été calculé,   ║
// ║  c'est-à-dire dans l'état SCORES — et jamais sur un abandon (RG-76).   ║
// ║  Couverture exigée : 100 % des lignes ET des branches.                 ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// RG-58 publie une liste EXHAUSTIVE ET FERMÉE de quatre secrets, et rien
// d'autre : les rôles, les missions et leur réussite, les paiements réels de
// chaque manche, et l'identité des signataires du Dernier Vœu.
//
// DEUX SECRETS NE SORTENT JAMAIS, pas même ici :
//   · l'identité du porteur de chaque clause (jamais en v1) ;
//   · l'existence des enquêtes — qui a enquêté sur qui.
// Les deux champs n'existent pas dans l'objet construit : il n'y a rien à
// retirer, et un relecteur peut le constater en lisant cette seule fonction.
//
// ET L'AMPLEUR DU MENSONGE N'EST PAS UN CHAMP (RG-75) : elle n'est émise dans
// AUCUN message, à aucun moment, pas même ici. Elle reste dérivable par le
// lecteur, par différence entre le déclaré public et le payé publié — ce qui
// est précisément l'intention de la règle, et la raison pour laquelle y ajouter
// un champ fermerait la porte de visibilité, à juste titre.

import type { LigneClassement, PaiementHistorique } from '@gdv/partage';

import { declareDe, payeDe, trouverJoueur } from '../etat/acces.ts';
import type { EtatSession } from '../etat/types.ts';
import type { ProjectionBrute } from './evenements-prives.ts';

function paiementsHistoriques(etat: EtatSession): readonly PaiementHistorique[] {
  const lignes: PaiementHistorique[] = [];
  for (const manche of etat.manches) {
    if (!manche.cloture) continue;
    for (const joueur of etat.joueurs) {
      lignes.push({
        numero_manche: manche.numero,
        joueur_id: joueur.id,
        montant_declare: declareDe(manche, joueur.id),
        montant_paye: payeDe(manche, joueur.id),
      });
    }
  }
  return lignes;
}

function ligneDe(etat: EtatSession, joueurId: string, rang: number): LigneClassement | null {
  const joueur = trouverJoueur(etat, joueurId);
  if (joueur === undefined || joueur.role_secret === null) return null;
  const signature = etat.signatures.find((ligne) => ligne.joueur_id === joueurId);
  return {
    joueur_id: joueur.id,
    pseudo: joueur.pseudo,
    pieces_restantes: joueur.solde_pieces,
    score_final: joueur.score_final ?? joueur.solde_pieces,
    role_secret: joueur.role_secret,
    mission_secrete: joueur.mission_secrete,
    mission_reussie: joueur.mission_reussie === true,
    a_signe_dernier_voeu: signature === undefined ? null : signature.a_signe,
    rang,
  };
}

export function projeterScoresFinaux(etat: EtatSession): ProjectionBrute | null {
  if (etat.classement === null) return null;
  const lignes: LigneClassement[] = [];
  for (const entree of etat.classement) {
    const ligne = ligneDe(etat, entree.joueur_id, entree.rang);
    if (ligne === null) return null;
    lignes.push(ligne);
  }
  return {
    proprietaires: [],
    charge: {
      classement: lignes,
      vainqueurs: etat.vainqueurs,
      victoire_par_liberation: etat.genie_libere === true && etat.vainqueurs.length === 1,
      genie_libere: etat.genie_libere === true,
      paiements_historiques: paiementsHistoriques(etat),
    },
  };
}
