// Position des deux options du Dernier Vœu — RG-77 (mesure M7-b).
//
// En DV_SIGNATURE, tous les joueurs voient la même carte voilée avec deux
// pastilles identiques et muettes. Si « Signer » était toujours à gauche, le
// voisin déduirait le choix du CÔTÉ de l'écran touché — c'est la fuite la plus
// facile du jeu, et celle qui annulerait tout le dilemme.
//
// Le tirage est LOCAL AU CLIENT, et il doit le rester : demander la position au
// serveur l'inscrirait au journal de commandes, donc dans un état rejouable, et
// la rendrait déductible par quiconque lit le journal. Aucune commande du
// protocole ne porte cette information, et aucune ne doit être ajoutée.
//
// Le tirage est stable PAR JOUEUR ET PAR PARTIE : il ne change pas entre deux
// rendus, sinon les pastilles sauteraient sous le pouce pendant une phase de
// 10 secondes.

export const OPTIONS_SIGNATURE = ['signer', 'refuser'] as const;
export type OptionSignature = (typeof OPTIONS_SIGNATURE)[number];

/** Les deux dispositions possibles, dans l'ordre d'affichage. */
export type DispositionSignature = readonly [OptionSignature, OptionSignature];

const ORDRE_DIRECT: DispositionSignature = Object.freeze(['signer', 'refuser']);
const ORDRE_INVERSE: DispositionSignature = Object.freeze(['refuser', 'signer']);

/**
 * Source d'aléa. Injectée pour que le test puisse forcer les deux issues : un
 * tirage non injecté est un tirage non vérifiable.
 */
export type SourceAlea = () => number;

/** Aléa cryptographique du navigateur, et non Math.random. */
export const aleaNavigateur: SourceAlea = () => {
  const tampon = new Uint32Array(1);
  globalThis.crypto.getRandomValues(tampon);
  return (tampon[0] ?? 0) / 2 ** 32;
};

/** Tire une disposition. Exactement une chance sur deux pour chaque ordre. */
export function tirerDisposition(alea: SourceAlea): DispositionSignature {
  return alea() < 0.5 ? ORDRE_DIRECT : ORDRE_INVERSE;
}

/** Interface minimale de stockage, pour que la mémorisation soit testable. */
export interface StockageSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

export const clePourPartie = (sessionId: string, joueurId: string): string =>
  `gdv.dv.disposition.${sessionId}.${joueurId}`;

function relire(brut: string | null): DispositionSignature | null {
  if (brut === ORDRE_DIRECT.join(',')) return ORDRE_DIRECT;
  if (brut === ORDRE_INVERSE.join(',')) return ORDRE_INVERSE;
  return null;
}

/**
 * Disposition stable pour ce joueur et cette partie : relue si elle existe,
 * tirée et mémorisée sinon.
 *
 * La valeur mémorisée ne contient AUCUN choix du joueur : seulement l'ordre
 * d'affichage. Un appareil prêté ne révèle donc rien par cette clé.
 */
export function dispositionStable(
  stockage: StockageSimple,
  sessionId: string,
  joueurId: string,
  alea: SourceAlea = aleaNavigateur,
): DispositionSignature {
  const cle = clePourPartie(sessionId, joueurId);
  const memorisee = relire(stockage.getItem(cle));
  if (memorisee !== null) return memorisee;

  const tiree = tirerDisposition(alea);
  stockage.setItem(cle, tiree.join(','));
  return tiree;
}
