// Jetons de session et de groupe (ADR-TL-15).
//
// 32 octets tirés par crypto.randomBytes, transmis UNE SEULE FOIS en base64url,
// stockés en condensat SHA-256 et comparés à temps constant. Une copie du
// fichier de base ou une sauvegarde jointe à un rapport de défaut ne permet
// donc aucune usurpation, et aucun jeton en clair ne peut apparaître dans un
// vidage de table.
//
// Le jeton ne voyage JAMAIS dans une URL : une URL se retrouve dans les
// journaux d'accès et l'historique du navigateur.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const OCTETS_JETON = 32;
const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR_CODE = 6;
const OCTETS_TIRAGE_CODE = 64;

export function creerJeton(): string {
  return randomBytes(OCTETS_JETON).toString('base64url');
}

export function hacher(jeton: string): string {
  return createHash('sha256').update(jeton, 'utf8').digest('hex');
}

/** Comparaison à temps constant des CONDENSATS : pas de fuite par mesure de durée. */
export function jetonCorrespond(jetonPresente: string, condensatStocke: string): boolean {
  const calcule = Buffer.from(hacher(jetonPresente), 'hex');
  let attendu: Buffer;
  try {
    attendu = Buffer.from(condensatStocke, 'hex');
  } catch {
    return false;
  }
  if (calcule.length !== attendu.length) return false;
  return timingSafeEqual(calcule, attendu);
}

/**
 * Code d'adhésion : 6 caractères de l'alphabet sans ambiguïté, ni I, ni O, ni 0,
 * ni 1 — des joueurs le lisent à voix haute dans une pièce. Tirage par rejet du
 * biais modulo : un tirage biaisé rendrait certains codes plus probables, donc
 * devinables.
 */
export function creerCodeAdhesion(): string {
  const limite = Math.floor(256 / ALPHABET_CODE.length) * ALPHABET_CODE.length;
  let code = '';
  while (code.length < LONGUEUR_CODE) {
    for (const octet of randomBytes(OCTETS_TIRAGE_CODE)) {
      if (octet >= limite) continue;
      code += ALPHABET_CODE[octet % ALPHABET_CODE.length];
      if (code.length === LONGUEUR_CODE) break;
    }
  }
  return code;
}

/** Graine d'aléa de la session : 32 octets hexadécimaux (ARCHI sessions.graine_alea). */
export function creerGraine(): string {
  return randomBytes(OCTETS_JETON).toString('hex');
}

export function creerIdentifiant(): string {
  return randomUUID();
}
