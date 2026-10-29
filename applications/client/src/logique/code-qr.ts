// Code QR de l'URL d'adhésion (US-01, ECR-04).
//
// DÉPENDANCE AJOUTÉE, JUSTIFICATION ÉCRITE — à ratifier par le tech-lead.
//
// qrcode-generator@2.0.4, version EXACTE épinglée. Trois faits mesurés sur le
// dépôt, pas supposés :
//  · ZÉRO dépendance transitive (package-lock : aucune entrée fille) ;
//  · licence MIT, types TypeScript fournis par le paquet ;
//  · npm audit --audit-level=high reste en code 0 après installation.
//
// Pourquoi une bibliothèque et pas du code maison : un encodeur QR correct
// demande l'encodage des données, un code de Reed-Solomon sur GF(256), le
// placement des motifs et le choix d'un masque. Écrit à la main, il serait
// INVÉRIFIABLE ici — je n'ai aucun décodeur pour confronter la sortie à une
// référence. Un QR qui se scanne et donne un code FAUX est pire que pas de QR :
// la table scanne, échoue, et ne sait pas pourquoi. Je refuse d'embarquer un
// encodeur dont je ne peux pas prouver la sortie.
//
// Pourquoi pas de repli sans QR : le code d'adhésion reste affiché en grand et
// relisible à voix haute dans tous les cas (ECR-04 le prévoit). Le QR fait
// gagner la saisie, il ne la remplace pas.
//
// Rien de secret ne transite ici : l'URL d'adhésion ne contient AUCUN jeton,
// seulement le code d'adhésion (API-GDV-001 / ReponseSessionCreee.url_adhesion).

import creerQr from 'qrcode-generator';

/** Correction d'erreur M : lecture fiable d'un écran de téléphone tenu à bout de bras. */
const NIVEAU_CORRECTION = 'M' as const;
/** 0 = choix automatique de la version selon la longueur de la charge. */
const VERSION_AUTOMATIQUE = 0 as const;

export interface TraceQr {
  /** Nombre de modules par côté, bordure comprise. */
  readonly taille: number;
  /** Chemin SVG des modules sombres, en unités de module. */
  readonly chemin: string;
}

/** Marge silencieuse exigée par la spécification QR : 4 modules de chaque côté. */
const MARGE_MODULES = 4;

/**
 * Trace l'URL en chemin SVG.
 *
 * Le rendu est un `path` et non du balisage injecté : v-html est interdit dans
 * ce projet, le jeton de session vivant en stockage local et une XSS étant son
 * seul vecteur d'exfiltration.
 */
export function tracerQr(url: string): TraceQr {
  const qr = creerQr(VERSION_AUTOMATIQUE, NIVEAU_CORRECTION);
  qr.addData(url, 'Byte');
  qr.make();

  const modules = qr.getModuleCount();
  const taille = modules + MARGE_MODULES * 2;
  const segments: string[] = [];

  for (let ligne = 0; ligne < modules; ligne += 1) {
    for (let colonne = 0; colonne < modules; colonne += 1) {
      if (!qr.isDark(ligne, colonne)) continue;
      const x = colonne + MARGE_MODULES;
      const y = ligne + MARGE_MODULES;
      segments.push(`M${x} ${y}h1v1h-1z`);
    }
  }

  return Object.freeze({ taille, chemin: segments.join('') });
}

/** URL absolue d'adhésion, construite depuis l'origine courante. */
export function urlAdhesion(origine: string, cheminRelatif: string): string {
  return new URL(cheminRelatif, origine).toString();
}
