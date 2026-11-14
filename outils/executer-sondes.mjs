// Exécute toutes les sondes de sécurité qa/sondes/sonde-*.ts et agrège leur
// code de sortie. Chaque sonde journalise ses propres MESURE/CONFORME/
// NON_CONFORME et fixe process.exitCode via bilan() (qa/sondes/banc.ts) : ce
// script ne réinterprète rien, il relaie le pire des codes de sortie.
//
// Porte CI (ARCHI-GDV-001, conseil LLM 2026-11-14) : ces sondes mesurent un
// COMPORTEMENT réel du moteur, pas seulement un contrat ou du code statique —
// elles vont donc en fin de chaîne de `npm run verifier`, comme
// verifier:uniformite et verifier:routes (voir _note_ordre_verifier).

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER_SONDES = join(RACINE, 'qa', 'sondes');

const sondes = readdirSync(DOSSIER_SONDES)
  .filter((fichier) => fichier.startsWith('sonde-') && fichier.endsWith('.ts'))
  .sort();

let echecs = 0;
for (const fichier of sondes) {
  console.log(`\n### ${fichier} ###`);
  const resultat = spawnSync(
    process.execPath,
    ['--conditions=gdv-source', '--experimental-strip-types', join(DOSSIER_SONDES, fichier)],
    { stdio: 'inherit', cwd: RACINE },
  );
  if (resultat.status !== 0) echecs += 1;
}

console.log(`\nSONDES : ${String(sondes.length)} exécutées, ${String(echecs)} en échec.`);
if (echecs > 0) process.exitCode = 1;
