// @gdv/partage — CONTRATS.
// Seul paquet importable par tous les autres. Ne contient AUCUNE logique de jeu.
//
// Ce qui est défini ici l'est UNE fois et consommé par le moteur, le serveur et
// le client : c'est ce qui rend la non-fuite vérifiable mécaniquement plutôt
// qu'entretenue par relecture (ADR-TL-01).

export * from './contrat/lecture.ts';
export * from './protocole/enveloppe.ts';
export * from './protocole/commandes.ts';
export * from './protocole/evenements.ts';
export * from './protocole/codes-erreur.ts';
export * from './protocole/visibilite.ts';
export * from './config/schema-config.ts';
export * from './domaine/enums.ts';
export * from './domaine/identifiants.ts';
