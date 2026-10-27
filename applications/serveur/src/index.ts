// Amorçage du serveur : lecture de la configuration, démarrage HTTP, arrêt propre.
//
// Deux responsabilités encore à écrire (nœud S4) et volontairement visibles ici
// plutôt que silencieuses : le rejeu des sessions vivantes au démarrage
// (ADR-TL-05) et la reconstruction des minuteries de phase depuis phase_fin_at
// (RG-72).
//
// Un service n'est démarré que s'il a répondu : la sonde /sante existe dès ce
// squelette, et le script `npm run dev:serveur` doit la voir répondre.

import { pathToFileURL } from 'node:url';

import { creerServeur } from './http/serveur.ts';
import { lireConfiguration } from './configuration/index.ts';

const SOUS_COMMANDES = new Map<string, string>([
  [
    '--migrer',
    'Application des migrations SQL (migrations/001-schema-initial.sql, ' +
      'migrations/002-catalogue-clauses.sql) — nœud S4.',
  ],
  ['--rejouer', 'Rejeu du journal de commandes des sessions vivantes (ADR-TL-05) — nœud S4.'],
]);

export async function demarrer(): Promise<void> {
  const sousCommande = process.argv.slice(2).find((argument) => SOUS_COMMANDES.has(argument));
  if (sousCommande) {
    console.error(
      `${sousCommande} : non implémenté.\n  ${SOUS_COMMANDES.get(sousCommande) ?? ''}\n` +
        '  Le script existe, la mécanique n’existe pas encore : échec explicite plutôt ' +
        'que succès trompeur.',
    );
    process.exitCode = 1;
    return;
  }

  const configuration = lireConfiguration();
  const serveur = await creerServeur({
    versionProtocole: configuration.versionProtocole,
    journalisation: true,
  });

  const arreter = async (signal: string): Promise<void> => {
    console.log(`\n[serveur] ${signal} reçu — arrêt propre.`);
    await serveur.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void arreter('SIGINT'));
  process.once('SIGTERM', () => void arreter('SIGTERM'));

  await serveur.listen({ port: configuration.port, host: configuration.hote });

  console.log(
    `[serveur] mode=${configuration.mode} protocole=${configuration.versionProtocole}\n` +
      `[serveur] sonde de santé : http://${configuration.hote}:${configuration.port}/sante\n` +
      `[serveur] TODO S4 : rejeu des sessions vivantes, reconstruction des minuteries, ` +
      `montée en charge du canal temps réel (/tr).`,
  );
}

// Ne démarre que si ce fichier est le point d'entrée : un test qui importe
// `demarrer` ne doit pas ouvrir un port au chargement du module.
const chemin = process.argv[1];
const estPointDEntree = chemin !== undefined && import.meta.url === pathToFileURL(chemin).href;
if (estPointDEntree) {
  demarrer().catch((erreur: unknown) => {
    console.error('[serveur] démarrage impossible :', erreur instanceof Error ? erreur.message : erreur);
    process.exit(1);
  });
}
