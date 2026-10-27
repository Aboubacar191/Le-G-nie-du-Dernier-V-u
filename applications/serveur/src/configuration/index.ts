// Lecture de l'environnement et garde-fous de démarrage.
//
// AUCUN secret n'est écrit ici : les valeurs entrent par l'environnement au
// moment de l'exécution (.env.exemple documente les clés sans valeur).
//
// Garde-fou NON négociable (ARCHI standards.transport_chiffre) : en mode
// production, le serveur REFUSE de démarrer sans TLS. Le jeton de session vaut
// accès total aux secrets de son propriétaire ; en clair sur le Wi-Fi partagé
// par huit joueurs assis dans la même pièce, son écoute passive contourne RG-01
// sans qu'une seule ligne du moteur soit en cause.
//
// La fusion de la configuration de JEU (défauts + surcharges de l'hôte) relève
// du nœud S4 : elle n'est pas écrite ici.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type ModeExecution = 'developpement' | 'production';

export interface ConfigurationServeur {
  readonly port: number;
  readonly hote: string;
  readonly cheminBdd: string;
  readonly origineAutorisee: string | null;
  readonly mode: ModeExecution;
  readonly cheminCert: string | null;
  readonly cheminCle: string | null;
  readonly versionProtocole: string;
}

const PORT_DEFAUT = 8443;
const HOTE_DEFAUT = '127.0.0.1';
const CHEMIN_BDD_DEFAUT = './donnees/gdv.sqlite';

function texte(valeur: string | undefined): string | null {
  const nettoye = valeur?.trim();
  return nettoye ? nettoye : null;
}

/**
 * Version du protocole, lue dans le contrat lui-même : info.version de
 * API-GDV-001.json fait foi (ARCHI standards.versionnement_protocole).
 * Le contrat est lu, jamais recopié dans une constante : une constante dérive.
 */
export function lireVersionProtocole(): string {
  const url = import.meta.resolve('@gdv/partage/contrat');
  const contrat: unknown = JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
  const version =
    typeof contrat === 'object' && contrat !== null
      ? (contrat as { info?: { version?: unknown } }).info?.version
      : undefined;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('API-GDV-001.json : info.version absent. Le protocole n’a pas de version.');
  }
  return version;
}

function lireMode(valeur: string | undefined): ModeExecution {
  const mode = texte(valeur) ?? 'developpement';
  if (mode !== 'developpement' && mode !== 'production') {
    throw new Error(`MODE invalide : « ${mode} ». Valeurs admises : developpement, production.`);
  }
  return mode;
}

function lirePort(valeur: string | undefined): number {
  const brut = texte(valeur);
  const port = brut === null ? PORT_DEFAUT : Number.parseInt(brut, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT invalide : « ${brut} ».`);
  }
  return port;
}

function exigerTls(mode: ModeExecution, cert: string | null, cle: string | null): void {
  if (mode !== 'production' || (cert !== null && cle !== null)) return;
  throw new Error(
    'MODE=production sans CHEMIN_CERT ni CHEMIN_CLE : démarrage REFUSÉ.\n' +
      'https:// et wss:// sont obligatoires en toute circonstance, y compris en ' +
      'playtest sur réseau local (ARCHI standards.transport_chiffre). Un jeton de ' +
      'session écouté en clair donne accès aux secrets de son propriétaire.',
  );
}

export function lireConfiguration(
  environnement: Readonly<Record<string, string | undefined>> = process.env,
): ConfigurationServeur {
  const mode = lireMode(environnement.MODE);
  const port = lirePort(environnement.PORT);
  const cheminCert = texte(environnement.CHEMIN_CERT);
  const cheminCle = texte(environnement.CHEMIN_CLE);

  exigerTls(mode, cheminCert, cheminCle);

  return {
    port,
    hote: texte(environnement.HOTE) ?? HOTE_DEFAUT,
    cheminBdd: texte(environnement.CHEMIN_BDD) ?? CHEMIN_BDD_DEFAUT,
    origineAutorisee: texte(environnement.ORIGINE_AUTORISEE),
    mode,
    cheminCert,
    cheminCle,
    versionProtocole: lireVersionProtocole(),
  };
}
