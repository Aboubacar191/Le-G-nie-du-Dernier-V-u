// SONDE criteres-d — les deux critères que les sondes A/B/C ne couvraient pas.
//
// CA-32 : invariant monétaire, recalculé par une fonction DISTINCTE du moteur.
// CA-46 : aucune valeur d'équilibrage en littéral dans la logique.
//
// CA-46 est audité DEUX FOIS, parce qu'aucun des deux contrôles ne suffit seul :
//   (1) scan STATIQUE des littéraux dans paquets/moteur/src — teste la source,
//       mais un littéral peut être une règle morte, et un littéral absent ne
//       prouve pas que la configuration est réellement LUE ;
//   (2) sonde par SUBSTITUTION — on force chaque paramètre à une sentinelle et
//       on observe si le comportement bouge. Inchangé = valeur codée en dur,
//       exactement la triche que le scan statique ne peut pas voir.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_DEFAUT, type ConfigJeu } from '@gdv/partage';

import { Banc } from './banc.ts';
import { bilan, mesure, titre, verdict } from './banc.ts';

// fileURLToPath, et non .pathname : le dépôt vit sous « Le Génie du Dernier Vœu »,
// dont les espaces et les accents sont percent-encodés dans une URL.
const RACINE_MOTEUR = fileURLToPath(new URL('../../paquets/moteur/src/', import.meta.url));

function fichiersTs(racine: string): readonly string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersTs(chemin));
    else if (entree.endsWith('.ts')) sortie.push(chemin);
  }
  return sortie;
}

// --- CA-32 -------------------------------------------------------------------

titre('CA-32 — solde = somme des mouvements, aucun solde négatif (vérification indépendante)');

/** Recalcul INDÉPENDANT : ne lit que le journal, jamais le champ solde_pieces. */
function soldesRecalcules(banc: Banc): ReadonlyMap<string, number> {
  const cumul = new Map<string, number>();
  for (const joueur of banc.etat.joueurs) {
    const somme = banc.etat.mouvements
      .filter((mouvement) => mouvement.joueur_id === joueur.id)
      .reduce((total, mouvement) => total + mouvement.delta, 0);
    cumul.set(joueur.id, somme);
  }
  return cumul;
}

function controlerInvariant(libelle: string, banc: Banc): void {
  const recalcul = soldesRecalcules(banc);
  const ecarts: (readonly [string, number, number])[] = [];
  const negatifs: (readonly [string, number])[] = [];
  for (const joueur of banc.etat.joueurs) {
    const attendu = recalcul.get(joueur.id) ?? 0;
    if (attendu !== joueur.solde_pieces) ecarts.push([joueur.id, attendu, joueur.solde_pieces]);
    if (joueur.solde_pieces < 0) negatifs.push([joueur.id, joueur.solde_pieces]);
  }
  mesure(`${libelle} — soldes portés`, banc.etat.joueurs.map((j) => [j.id, j.solde_pieces]));
  mesure(`${libelle} — soldes recalculés depuis le journal`, [...recalcul.entries()]);
  verdict(`CA-32 — ${libelle} : solde = somme des mouvements`, ecarts.length === 0, `écarts ${JSON.stringify(ecarts)}`);
  verdict(`CA-32 — ${libelle} : aucun solde négatif`, negatifs.length === 0, `négatifs ${JSON.stringify(negatifs)}`);
}

// Exécution 1 : partie complète nominale.
const nominal = new Banc().demarrer();
nominal.allerA('DECLARATION_PAIEMENT');
nominal.declarerPuisPayer([
  [4, 4],
  [4, 4],
  [4, 4],
  [4, 2],
  [4, 4],
  [4, 1],
]);
nominal.allerA('EXECUTION');
nominal.expirer();
controlerInvariant('exécution nominale, 2 menteurs', nominal);

// Exécution 2 : amende supérieure au solde + prêt actif + transfert, le pire cas.
const stress = new Banc().demarrer();
stress.imposerRole('J0', 'PRETEUR');
stress.allerA('NEGOCIATION');
stress.exiger('J0', 'transferer_pieces', { cible_joueur_id: 'J2', montant: 10 });
stress.allerA('DECLARATION_PAIEMENT');
stress.declarerPuisPayer([
  [2, 2],
  [9, 1],
  [6, 6],
  [4, 4],
  [4, 4],
  [4, 4],
]);
stress.allerA('ENQUETES_ACCUSATIONS');
stress.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
stress.allerA('EXECUTION');
stress.expirer();
controlerInvariant('amende > solde, transfert, accusation juste', stress);

// Exécution 3 : partie entière de 5 manches, invariant contrôlé à la toute fin.
const longue = new Banc().demarrer();
for (let manche = 1; manche <= 5; manche += 1) {
  longue.allerA('DECLARATION_PAIEMENT');
  // Montants ADAPTATIFS : un montant fixe finirait par dépasser un solde épuisé
  // et le refus RG-08 masquerait l'invariant qu'on cherche à mesurer.
  longue.joueurs.forEach((joueur, index) => {
    const declare = Math.min(3, longue.solde(joueur));
    const paye = index % 3 === 1 ? Math.max(0, declare - 2) : declare;
    longue.exiger(joueur, 'declarer_contribution', { montant: declare });
    longue.exiger(joueur, 'payer_secret', { montant: paye });
  });
  if (longue.etat.phase !== null) longue.allerA('EXECUTION');
  longue.expirer();
  if (longue.etat.phase === null) break;
}
controlerInvariant('partie complète de 5 manches', longue);

// --- CA-46, contrôle (1) : scan statique -------------------------------------

titre('CA-46 (1) — scan statique des littéraux d’équilibrage dans paquets/moteur/src');

const valeursEquilibrage = new Map<string, number>();
for (const [cle, valeur] of Object.entries(CONFIG_DEFAUT)) {
  if (typeof valeur === 'number') valeursEquilibrage.set(cle, valeur);
}
mesure('paramètres numériques de premier niveau', [...valeursEquilibrage.entries()]);

// Les littéraux cités par CA-46, dans leur libellé d'origine.
const LITTERAUX_CA46 = [12, 3, 2, 15, 10] as const;
mesure('littéraux visés par CA-46', LITTERAUX_CA46);

const fichiers = fichiersTs(RACINE_MOTEUR);
mesure('fichiers de moteur/src scannés', fichiers.length);

/** Retire commentaires et chaînes : un littéral en commentaire n'est pas une règle. */
function codeNu(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/[^\n]*/gu, '')
    .replace(/'(?:[^'\\]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\]|\\.)*"/gu, '""')
    .replace(/`(?:[^`\\]|\\.)*`/gu, '``');
}

interface Occurrence {
  readonly fichier: string;
  readonly ligne: number;
  readonly litteral: number;
  readonly texte: string;
  readonly nommee: boolean;
}

const occurrences: Occurrence[] = [];
for (const fichier of fichiers) {
  const lignes = codeNu(readFileSync(fichier, 'utf8')).split('\n');
  lignes.forEach((ligne, index) => {
    for (const litteral of LITTERAUX_CA46) {
      // Un littéral de règle : nombre isolé, hors index [0]/[1], hors .length,
      // hors exposant et hors nom d'identifiant (etape-02, sfc32…).
      const motif = new RegExp(`(?<![\\w.$])${String(litteral)}(?![\\w.$])`, 'gu');
      if (!motif.test(ligne)) continue;
      const nu = ligne.trim();
      // Écarte les cas structurels non contestés : slice/index de tableau et padStart.
      if (/\b(?:slice|at|padStart|padEnd|toFixed|substring|charAt)\s*\(/u.test(nu)) continue;
      occurrences.push({
        fichier: fichier.slice(RACINE_MOTEUR.length),
        ligne: index + 1,
        litteral,
        // Une DÉCLARATION de constante nommée en tête de module n'est pas un
        // littéral noyé dans la logique : la règle est nommée et unique.
        nommee: new RegExp(`^const\\s+[A-Z0-9_]+\\s*(?::\\s*\\w+\\s*)?=\\s*${String(litteral)}\\s*;`, 'u').test(nu),
        texte: nu.slice(0, 110),
      });
    }
  });
}

const nommees = occurrences.filter((o) => o.nommee);
const nues = occurrences.filter((o) => !o.nommee);
mesure('occurrences totales des littéraux visés', occurrences.length);
mesure('dont DÉCLARATIONS de constantes nommées', nommees.length);
mesure('dont littéraux NUS dans la logique', nues.length);
for (const occurrence of nues.slice(0, 40)) {
  console.log(
    `    NU  ${occurrence.fichier}:${String(occurrence.ligne)}  littéral ${String(occurrence.litteral)}  « ${occurrence.texte} »`,
  );
}

// CA-46 ne vise PAS toute constante numérique : il vise les valeurs de
// parametres_configuration. Une constante nommée qui porte une règle structurelle
// du GDD absente des 21 paramètres (EXEMPLAIRES_MAX_PAR_ROLE, SEUIL_FAUSSAIRE…)
// n'est pas une valeur de configuration détournée. Le test décisif : une
// constante nommée du moteur porte-t-elle le NOM d'un paramètre de configuration ?
const nomsConfig = new Set(Object.keys(CONFIG_DEFAUT).map((c) => c.toUpperCase()));
const usurpatrices = nommees.filter((o) => {
  const nom = /^const\s+([A-Z0-9_]+)/u.exec(o.texte)?.[1] ?? '';
  return nomsConfig.has(nom);
});
mesure('constantes nommées, par fichier', nommees.map((o) => `${o.fichier}:${String(o.ligne)}`));
mesure('constantes nommées qui DOUBLENT un paramètre de configuration', usurpatrices.map((o) => o.texte));

// Contrôle croisé : chaque paramètre de configuration est-il LU dans le moteur,
// ou bien seulement déclaré ? Un paramètre jamais lu serait une règle morte.
const sourceMoteur = fichiers.map((f) => readFileSync(f, 'utf8')).join('\n');
const jamaisLus = Object.keys(CONFIG_DEFAUT).filter(
  (nom) => !new RegExp(`config\\s*\\.\\s*${nom}|\\bconfig\\[['"\`]${nom}`, 'u').test(sourceMoteur),
);
mesure('paramètres de configuration jamais lus dans moteur/src', jamaisLus);

verdict(
  'CA-46 (1) — aucun littéral NU d’équilibrage dans la logique du moteur',
  nues.length === 0,
  `${String(nues.length)} littéral(aux) nu(s)`,
);
verdict(
  'CA-46 (1) — aucune constante du moteur ne double un paramètre de configuration',
  usurpatrices.length === 0,
  JSON.stringify(usurpatrices.map((o) => o.texte)),
);

// --- CA-46, contrôle (2) : sonde par substitution -----------------------------

titre('CA-46 (2) — sonde par substitution : chaque paramètre est-il réellement CONSOMMÉ ?');

/**
 * Pour chaque paramètre, une mesure qui doit dépendre de lui. Si le fait de
 * forcer le paramètre ne déplace PAS la mesure, la valeur est codée en dur.
 */
interface CasSubstitution {
  readonly parametre: keyof ConfigJeu;
  readonly sentinelle: number;
  readonly mesurer: (config: Partial<ConfigJeu>) => unknown;
}

// La dotation initiale n'est versée qu'à demarrer_partie : lire le solde avant
// rendrait 0 dans les deux cas et ferait conclure à tort « valeur en dur ».
function soldeInitial(config: Partial<ConfigJeu>): unknown {
  return new Banc({ config }).demarrer().solde('J0');
}

function objectifManche1(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('VOEU');
  return banc.manche(1).objectif;
}

// Les manches sont matérialisées une à une (manches.length == 1 au démarrage) :
// la seule mesure honnête est le nombre de manches RÉELLEMENT jouées.
function nbManches(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  for (let garde = 0; garde < 25 && banc.etat.phase !== null; garde += 1) {
    banc.allerA('DECLARATION_PAIEMENT');
    banc.joueurs.forEach((joueur) => {
      const montant = Math.min(2, banc.solde(joueur));
      banc.exiger(joueur, 'declarer_contribution', { montant });
      banc.exiger(joueur, 'payer_secret', { montant });
    });
    if (banc.etat.phase !== null) banc.allerA('EXECUTION');
    banc.expirer();
  }
  return [banc.etat.manches.length, banc.etat.etat_partie];
}

function recompenseReussie(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [5, 5],
    [5, 5],
    [5, 5],
    [5, 5],
    [5, 5],
    [5, 5],
  ]);
  banc.allerA('EXECUTION');
  banc.expirer();
  return banc.manche(1).recompense;
}

// Ampleur VOLONTAIREMENT faible (1) : avec une grosse ampleur, l'amende est
// plafonnée au solde (RG-41) et le plafond masque le multiplicateur — la mesure
// rendrait « inerte » un paramètre pourtant consommé.
function amendeLiquidee(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 3],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  banc.allerA('ENQUETES_ACCUSATIONS');
  banc.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
  banc.allerA('EXECUTION');
  banc.expirer();
  return banc.etat.mouvements
    .filter((m) => m.joueur_id === 'J1' && m.motif === 'amende_payee')
    .map((m) => m.delta);
}

function coutEnqueteMesure(role: 'INSPECTEUR_TRESOR' | 'PRETEUR') {
  return (config: Partial<ConfigJeu>): unknown => {
    const banc = new Banc({ config }).demarrer();
    banc.imposerRole('J0', role);
    banc.allerA('DECLARATION_PAIEMENT');
    banc.declarerPuisPayer([
      [1, 1],
      [4, 1],
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
    ]);
    banc.allerA('ENQUETES_ACCUSATIONS');
    const avant = banc.solde('J0');
    banc.exiger('J0', 'lancer_enquete', { cible_joueur_id: 'J1' });
    return avant - banc.solde('J0');
  };
}

function coutFausseAccusation(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  banc.allerA('ENQUETES_ACCUSATIONS');
  banc.exiger('J0', 'accuser', { accuse_joueur_id: 'J1' });
  banc.allerA('EXECUTION');
  banc.expirer();
  return banc.etat.mouvements
    .filter((m) => m.joueur_id === 'J0' && m.motif === 'penalite_fausse_accusation_payee')
    .map((m) => m.delta);
}

function accusationsMax(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('DECLARATION_PAIEMENT');
  banc.declarerPuisPayer([
    [4, 4],
    [4, 1],
    [4, 1],
    [4, 4],
    [4, 4],
    [4, 4],
  ]);
  banc.allerA('ENQUETES_ACCUSATIONS');
  banc.cmd('J0', 'accuser', { accuse_joueur_id: 'J1' });
  const seconde = banc.cmd('J0', 'accuser', { accuse_joueur_id: 'J2' });
  return seconde.ok ? 'ACCEPTEE' : (seconde.erreur as { code: string }).code;
}

function bonusMission(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.imposerMission('J0', 'LE_MAGNAT');
  for (let manche = 1; manche <= 5; manche += 1) {
    banc.allerA('DECLARATION_PAIEMENT');
    banc.declarerPuisPayer([
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
    ]);
    if (banc.etat.phase !== null) banc.allerA('EXECUTION');
    banc.expirer();
    if (banc.etat.phase === null) break;
  }
  const scores = banc.pour('J0', 'scores_finaux').at(-1);
  const classement = (scores?.charge as { classement?: readonly Record<string, unknown>[] })
    ?.classement;
  return classement?.map((l) => [l['joueur_id'], l['score_final'], l['pieces_restantes'], l['mission_reussie']]);
}

function mancheMinPasse(config: Partial<ConfigJeu>): unknown {
  return new Banc({ config }).etat.config.manche_min_revelation_passe;
}

function partiesRequises(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config, parties_terminees: 3 });
  const trame = banc.pour('J0', 'groupe_mis_a_jour').at(-1);
  return trame === undefined ? banc.etat.groupe : trame.charge;
}

function dureePhase(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ config }).demarrer();
  banc.allerA('NEGOCIATION');
  const trame = banc.pour('J0', 'phase_changee').at(-1);
  return (trame?.charge as { phase_fin_at?: string } | undefined)?.phase_fin_at;
}

function joueursMaxMesure(config: Partial<ConfigJeu>): unknown {
  return new Banc({ config }).etat.config.joueurs_max;
}

function joueursMinMesure(config: Partial<ConfigJeu>): unknown {
  const banc = new Banc({ joueurs: 5, config });
  const resultat = banc.cmd('J0', 'demarrer_partie');
  return resultat.ok ? 'ACCEPTEE' : (resultat.erreur as { code: string }).code;
}

const CAS: readonly CasSubstitution[] = [
  { parametre: 'pieces_initiales', sentinelle: 37, mesurer: soldeInitial },
  { parametre: 'objectif_par_joueur', sentinelle: 7, mesurer: objectifManche1 },
  { parametre: 'nb_manches', sentinelle: 2, mesurer: nbManches },
  { parametre: 'multiplicateur_recompense', sentinelle: 5, mesurer: recompenseReussie },
  { parametre: 'multiplicateur_amende', sentinelle: 7, mesurer: amendeLiquidee },
  { parametre: 'cout_enquete', sentinelle: 5, mesurer: coutEnqueteMesure('PRETEUR') },
  {
    parametre: 'cout_enquete_inspecteur_tresor',
    sentinelle: 4,
    mesurer: coutEnqueteMesure('INSPECTEUR_TRESOR'),
  },
  { parametre: 'cout_fausse_accusation', sentinelle: 5, mesurer: coutFausseAccusation },
  {
    parametre: 'accusations_max_par_joueur_par_manche',
    sentinelle: 2,
    mesurer: accusationsMax,
  },
  { parametre: 'bonus_mission_reussie', sentinelle: 23, mesurer: bonusMission },
  { parametre: 'manche_min_revelation_passe', sentinelle: 4, mesurer: mancheMinPasse },
  {
    parametre: 'parties_requises_pour_debloquer_dernier_voeu',
    sentinelle: 9,
    mesurer: partiesRequises,
  },
  { parametre: 'joueurs_max', sentinelle: 7, mesurer: joueursMaxMesure },
  { parametre: 'joueurs_min', sentinelle: 6, mesurer: joueursMinMesure },
];

const inertes: string[] = [];
for (const cas of CAS) {
  let temoin: unknown;
  let substitue: unknown;
  try {
    temoin = cas.mesurer({});
    substitue = cas.mesurer({ [cas.parametre]: cas.sentinelle } as Partial<ConfigJeu>);
  } catch (erreur) {
    mesure(`${cas.parametre} — EXCEPTION`, (erreur as Error).message);
    inertes.push(`${cas.parametre} (exception)`);
    continue;
  }
  const bouge = JSON.stringify(temoin) !== JSON.stringify(substitue);
  mesure(
    `${cas.parametre} : défaut ${String(CONFIG_DEFAUT[cas.parametre] as number)} → sentinelle ${String(cas.sentinelle)}`,
    { temoin, substitue, consomme: bouge },
  );
  if (!bouge) inertes.push(String(cas.parametre));
}

// Le multiplicateur TRESOR_DES_HONNETES et les rationnels sont déjà mesurés par
// sonde-criteres-b (CA-28, CA-29) et sonde-matrice-gains : on ne les redouble pas.
mesure('paramètres éprouvés par substitution', CAS.length);
mesure('paramètres INERTES (valeur codée en dur)', inertes);
verdict(
  'CA-46 (2) — tout paramètre substitué déplace le comportement (aucune valeur en dur)',
  inertes.length === 0,
  `inertes ${JSON.stringify(inertes)}`,
);

// --- Durée de phase : contrôle séparé, car la sentinelle agit sur une date ----

titre('CA-46 (2 bis) — témoin sur une durée de phase');
const dureeTemoin = dureePhase({});
const dureeForcee = dureePhase({
  durees_phases_s: { ...CONFIG_DEFAUT.durees_phases_s, NEGOCIATION: 777 },
} as Partial<ConfigJeu>);
mesure('phase_fin_at NEGOCIATION, défaut puis 777 s', [dureeTemoin, dureeForcee]);
verdict(
  'CA-46 (2 bis) — durees_phases_s.NEGOCIATION est consommée',
  JSON.stringify(dureeTemoin) !== JSON.stringify(dureeForcee),
);

bilan('criteres-d');
