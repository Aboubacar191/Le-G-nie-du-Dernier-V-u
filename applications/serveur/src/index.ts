// Amorçage du serveur : migrations, rejeu des sessions vivantes, démarrage
// HTTP et temps réel, arrêt propre.
//
// Deux responsabilités qui n'en ont pas l'air mais qui comptent au rang 2 :
//   · le REJEU au démarrage (ADR-TL-05) : un serveur qui redémarre en pleine
//     partie ne doit pas ruiner trente minutes de jeu ;
//   · la RECONSTRUCTION DES MINUTERIES depuis phase_fin_at (RG-72) : une phase
//     dont l'échéance est passée pendant l'arrêt expire immédiatement, une
//     phase encore en cours reprend avec le temps qu'il lui restait.

import { pathToFileURL } from 'node:url';

import { lireConfiguration } from './configuration/index.ts';
import { creerServeur } from './http/serveur.ts';
import { ouvrirDepot } from './persistance/sqlite/index.ts';
import { creerService, reprendre, type Service } from './service.ts';
import { ServeurTempsReel } from './temps-reel/serveur-ws.ts';
import { rediger } from './journalisation/redacteur.ts';

export interface ServiceDemarre {
  readonly service: Service;
  readonly adresse: string;
  arreter(): Promise<void>;
}

export async function demarrerService(): Promise<ServiceDemarre> {
  const configuration = lireConfiguration();
  const depot = ouvrirDepot(configuration.cheminBdd);
  const service = creerService(depot);
  reprendre(service);

  const serveur = await creerServeur({
    versionProtocole: configuration.versionProtocole,
    journalisation: false,
    service,
  });
  await serveur.listen({ port: configuration.port, host: configuration.hote });

  const tempsReel = new ServeurTempsReel(service, configuration.origineAutorisee);
  tempsReel.brancher(serveur.server);

  return {
    service,
    adresse: `${configuration.hote}:${configuration.port}`,
    arreter: async () => {
      service.ordonnanceur.arreter();
      tempsReel.arreter();
      await serveur.close();
      depot.fermer();
    },
  };
}

function appliquerMigrations(): void {
  const configuration = lireConfiguration();
  const depot = ouvrirDepot(configuration.cheminBdd);
  depot.fermer();
  console.log(`[serveur] migrations appliquées sur ${configuration.cheminBdd}`);
}

function rejouer(): void {
  const configuration = lireConfiguration();
  const depot = ouvrirDepot(configuration.cheminBdd);
  const service = creerService(depot);
  reprendre(service);
  console.log(
    `[serveur] rejeu terminé — ${service.boucle.sessions().length} session(s) vivante(s) ` +
      `reconstruite(s) depuis le journal de commandes.`,
  );
  depot.fermer();
}

export async function demarrer(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes('--migrer')) {
    appliquerMigrations();
    return;
  }
  if (arguments_.includes('--rejouer')) {
    rejouer();
    return;
  }

  const demarre = await demarrerService();
  const arreter = async (signal: string): Promise<void> => {
    console.log(`\n[serveur] ${signal} reçu — arrêt propre.`);
    await demarre.arreter();
    process.exit(0);
  };
  process.once('SIGINT', () => void arreter('SIGINT'));
  process.once('SIGTERM', () => void arreter('SIGTERM'));

  const configuration = lireConfiguration();
  console.log(
    `[serveur] mode=${configuration.mode} protocole=${configuration.versionProtocole}\n` +
      `[serveur] sonde de santé : http://${demarre.adresse}/sante\n` +
      `[serveur] canal temps réel : ws://${demarre.adresse}/tr`,
  );
}

// Ne démarre que si ce fichier est le point d'entrée : un test qui importe
// `demarrer` ne doit pas ouvrir un port au chargement du module.
const chemin = process.argv[1];
const estPointDEntree = chemin !== undefined && import.meta.url === pathToFileURL(chemin).href;
if (estPointDEntree) {
  demarrer().catch((erreur: unknown) => {
    console.error('[serveur] démarrage impossible :', rediger({ erreur: String(erreur) }));
    process.exit(1);
  });
}
