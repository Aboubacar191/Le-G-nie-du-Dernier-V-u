// Copie figée, pour CI uniquement, de l'outil d'équipe partagé
// (~/.claude/equipe/outils/scanner-secrets.mjs) : ce fichier vit hors du dépôt,
// sur le poste de développement, donc inaccessible à un runner GitHub Actions
// qui ne récupère que le contenu versionné. outils/verifier-secrets.mjs lit
// GDV_SCANNER_SECRETS en priorité (mécanisme déjà prévu pour ce cas) ; le
// workflow .github/workflows/deploy.yml pointe cette variable ici.
//
// Ce n'est PAS la source de vérité de l'outil : en cas de correctif sur
// l'original, le reporter ici. Comportement identique par ailleurs.
//
// Usage : node scanner-secrets-ci.mjs [racine]
// Sortie : liste fichier:ligne + type detecte, VALEURS TOUJOURS MASQUEES.
// Code retour : 0 si rien, 1 si au moins une exposition.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const racine = process.argv[2] ?? '.';

const IGNORES = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', '.angular',
  'coverage', '.next', '__pycache__', 'storage',
]);
const EXT = /\.(js|mjs|cjs|ts|tsx|jsx|vue|php|py|rb|go|java|json|ya?ml|env|sh|ps1|ini|conf|xml|properties)$/i;

const MOTIFS = [
  ['Cle privee',        /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Cle AWS',           /\bAKIA[0-9A-Z]{16}\b/],
  ['Jeton GitHub',      /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Cle Google API',    /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Jeton Slack',       /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['Cle Stripe live',   /\bsk_live_[0-9a-zA-Z]{16,}\b/],
  ['JWT',               /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./],
  ['Cle applicative',   /\bbase64:[A-Za-z0-9+/]{40,}={0,2}/],
  ['URL avec identifiants', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/i],
  ['Affectation sensible',
   /\b(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|private[_-]?key|access[_-]?key)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];

// Une affectation vide, factice ou pointant vers une variable n'est pas un secret
const FACTICE = /(["']\s*["']|\$\{|process\.env|env\(|getenv|os\.environ|<[^>]+>|xxx+|\.\.\.|changeme|your[_-]?|exemple|example|placeholder|null|true|false)/i;

const masquer = (s) => {
  const t = s.trim();
  return t.length <= 8 ? '*'.repeat(t.length) : `${t.slice(0, 4)}${'*'.repeat(8)}${t.slice(-2)}`;
};

const trouvailles = [];

function parcourir(dir) {
  let entrees;
  try { entrees = readdirSync(dir); } catch { return; }
  for (const e of entrees) {
    if (IGNORES.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { parcourir(p); continue; }
    if (!EXT.test(e) && !/^\.env/.test(e)) continue;
    if (st.size > 2_000_000) continue;

    let lignes;
    try { lignes = readFileSync(p, 'utf8').split('\n'); } catch { continue; }
    lignes.forEach((ligne, i) => {
      if (ligne.length > 500) return;
      for (const [type, motif] of MOTIFS) {
        const m = ligne.match(motif);
        if (!m) continue;
        if (type === 'Affectation sensible' && FACTICE.test(ligne)) continue;
        trouvailles.push({
          fichier: relative(racine, p) || p,
          ligne: i + 1,
          type,
          extrait: masquer(m[0]),
        });
        break;
      }
    });
  }
}

parcourir(racine);

// Classement selon le statut git reel : un .env local correctement ignore
// n'est pas une fuite. Sans cette distinction l'outil devient bruyant, donc ignore.
let suivis = null, ignores = null;
try {
  suivis = new Set(
    execSync('git ls-files', { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((f) => f.trim()).filter(Boolean));
  ignores = new Set(
    execSync('git ls-files --others --ignored --exclude-standard',
      { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((f) => f.trim()).filter(Boolean));
} catch { /* pas un depot git : tout reste indetermine */ }

const norm = (p) => p.split(sep).join('/');
const classer = (fichier) => {
  if (suivis === null) return 'INDETERMINE';
  const f = norm(fichier);
  if (suivis.has(f)) return 'EXPOSITION';   // present dans l'historique git
  if (ignores.has(f)) return 'LOCAL';       // ignore par git : attendu
  return 'A_RISQUE';                        // non suivi mais non ignore : partirait au prochain `git add .`
};

for (const t of trouvailles) t.niveau = classer(t.fichier);

const GRAVITE = { EXPOSITION: 0, A_RISQUE: 1, INDETERMINE: 2, LOCAL: 3 };
trouvailles.sort((a, b) => GRAVITE[a.niveau] - GRAVITE[b.niveau]);

const bloquants = trouvailles.filter((t) => t.niveau === 'EXPOSITION' || t.niveau === 'A_RISQUE');

if (!trouvailles.length) {
  console.log('AUCUN SECRET DETECTE');
  process.exit(0);
}

for (const t of trouvailles)
  console.log(`${t.niveau.padEnd(12)} ${t.fichier}:${t.ligne} — ${t.type} — ${t.extrait}`);

const local = trouvailles.length - bloquants.length;
console.log(`\n${bloquants.length} a traiter, ${local} local/indetermine. Valeurs masquees volontairement.`);
console.log('EXPOSITION = suivi par git · A_RISQUE = non ignore · LOCAL = ignore par git, attendu');
process.exit(bloquants.length ? 1 : 0);
