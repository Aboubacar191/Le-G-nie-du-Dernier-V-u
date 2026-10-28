// Fabrique d'identifiants DÉTERMINISTE, injectée dans le moteur.
//
// Deux exigences du contrat se rencontrent ici :
//   · ADR-TL-10 impose un UUIDv4 en chaîne pour TOUTES les clés primaires ;
//   · ADR-TL-05 impose que le rejeu du journal reconstruise un état IDENTIQUE,
//     y compris les identifiants des lignes créées par le moteur (accusations,
//     enquêtes, prêts, mouvements, révélations).
//
// crypto.randomUUID satisfait la première et ruine la seconde : rejouer le
// journal produirait d'autres identifiants, donc un état différent, et le test
// de rejeu échouerait à juste titre. Les identifiants créés PAR LE MOTEUR sont
// donc dérivés de la graine de session, dans le format UUIDv4.
//
// Générateur SÉPARÉ de celui du jeu, semé avec un sel distinct : l'ordre de
// consommation de l'aléa de jeu (rôles, missions, clause, porteur, variante)
// est normatif et ne doit pas être décalé par un tirage d'identifiant
// (ARCHI conventions.determinisme_et_alea).
//
// Les identifiants créés par le TRANSPORT (session, joueur, groupe) restent
// tirés par crypto.randomUUID : ils sont persistés en propre, pas rejoués.

import { creerAleaSfc32 } from '@gdv/moteur';

const SEL_IDENTIFIANTS = ':identifiants';
const CHIFFRES_HEX = '0123456789abcdef';
const GABARIT_UUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
const MASQUE_VARIANTE = 0x8;
const BORNE_HEX = 15;
const BORNE_VARIANTE = 3;

/**
 * Suite d'UUIDv4 reproductible pour une graine donnée. Le chiffre de version
 * (4) et les deux bits de variante sont posés conformément à la RFC 4122 : le
 * format reste celui qu'exige le contrat, seule la source d'entropie change.
 */
export function creerFabriqueIdentifiants(graine: string): () => string {
  const alea = creerAleaSfc32(`${graine}${SEL_IDENTIFIANTS}`);
  return () => {
    let sortie = '';
    for (const caractere of GABARIT_UUID) {
      if (caractere === 'x') {
        sortie += CHIFFRES_HEX[alea.entier(0, BORNE_HEX)];
        continue;
      }
      if (caractere === 'y') {
        sortie += CHIFFRES_HEX[MASQUE_VARIANTE + alea.entier(0, BORNE_VARIANTE)];
        continue;
      }
      sortie += caractere;
    }
    return sortie;
  };
}
