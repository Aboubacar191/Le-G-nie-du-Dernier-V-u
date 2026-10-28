// Révélations : les trois lois du génie.
//
// Loi 1 (RG-20) : toujours vrai — verification.ts, écrite indépendamment.
// Loi 2 (RG-21) : jamais complet — suspects.ts, appliquée dans eligibilite.ts.
// Loi 3 (RG-22) : provocateur — score-activite.ts, appliquée dans selection.ts.

export * from './suspects.ts';
export * from './score-activite.ts';
export * from './eligibilite.ts';
export * from './selection.ts';
export { verifierEnonce } from './verification.ts';
