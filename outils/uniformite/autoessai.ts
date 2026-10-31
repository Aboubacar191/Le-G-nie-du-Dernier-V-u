// =============================================================================
// AUTO-ESSAI DE LA PORTE D'UNIFORMITÉ — l'instrument se mesure lui-même
// =============================================================================
// Une porte qui échoue TOUJOURS est aussi inutile qu'une porte qui passe
// toujours : dans les deux cas son verdict n'apporte aucune information. La
// porte verifier:uniformite est ROUGE aujourd'hui, en attente des ruptures
// RUP-01 à RUP-05, et on ne peut donc PAS la voir verte sur le dépôt réel.
//
// Cet auto-essai fournit les deux preuves qui manqueraient sinon :
//   · CONTRÔLE POSITIF — sur un trafic synthétique parfaitement uniforme, tous
//     les contrôles rendent « conforme » et ne signalent RIEN. La porte est
//     donc capable de dire oui.
//   · VIOLATIONS VOLONTAIRES — une perturbation minimale par contrôle, et
//     chacun doit parler. Dont deux tests de SEUIL EXACT sur P-c : un ensemble
//     de clés égal à une variante déclarée passe ; le même avec UNE clé en
//     moins, ou UNE clé en plus, échoue. L'égalité est exigée, pas l'inclusion.
//
// Usage  : node --conditions=gdv-source --experimental-strip-types \
//            outils/uniformite/autoessai.ts
// Sortie : 0 = l'instrument se comporte comme annoncé, 1 = il ne le fait pas.
// =============================================================================

import type { Trame } from '../../qa/sondes/banc.ts';
import type { SchemaEvt } from './contrat.ts';
import {
  controlerAlignement,
  controlerClesEmises,
  controlerDifferentiel,
  controlerNombre,
  controlerSequence,
  mesurerEcartsDeTaille,
  profils,
} from './profil.ts';

const JOUEURS = ['J0', 'J1', 'J2'] as const;
const TYPES = ['phase_changee', 'declaration_publiee', 'solde_mis_a_jour'] as const;

const SCHEMA: SchemaEvt = {
  nom: 'EvtEssai',
  type: 'phase_changee',
  visibilite: 'tous',
  emission: 'uniforme',
  proprietes: ['numero_manche', 'solde_pieces'],
  chargeNeutre: ['numero_manche'],
  variantes: null,
};

/** Trafic parfaitement uniforme : un lot par type, N trames consécutives. */
function traficUniforme(): Trame[] {
  const trames: Trame[] = [];
  let ordre = 0;
  for (const type of TYPES) {
    for (const joueur of JOUEURS) {
      ordre += 1;
      trames.push({
        ordre,
        type,
        pour: joueur,
        charge: { numero_manche: 1, solde_pieces: 12 },
        phase: null,
        manche: 1,
        octets: 128,
      });
    }
  }
  return trames;
}

let echecs = 0;
const resultat = (libelle: string, conforme: boolean): void => {
  if (!conforme) echecs += 1;
  console.log(`  ${conforme ? 'OK      ' : 'MANQUÉ  '} ${libelle}`);
};

/** Exécute un contrôle et rend le nombre d'anomalies qu'il a signalées. */
function compter(execution: (signaler: (c: string, d: string) => void) => void): number {
  let nombre = 0;
  execution(() => {
    nombre += 1;
  });
  return nombre;
}

// --- Contrôle positif --------------------------------------------------------

console.log('AUTO-ESSAI — contrôle positif : trafic synthétique parfaitement uniforme');
const sain = profils(traficUniforme(), JOUEURS);
resultat(
  'U1a ne signale rien',
  compter((s) => void controlerNombre(sain, 'positif', s)) === 0,
);
resultat(
  'U1b ne signale rien',
  compter((s) => void controlerSequence(sain, 'positif', s)) === 0,
);
resultat(
  'U1d ne signale rien',
  compter((s) => void controlerAlignement(sain, 'positif', s)) === 0,
);
resultat('U1c mesure 0 rang de taille inégale', mesurerEcartsDeTaille(sain).rangs === 0);
resultat(
  'U2 ne signale rien entre deux parties identiques',
  compter((s) => void controlerDifferentiel(sain, sain, 'positif', s)) === 0,
);
// Les trois types du trafic synthétique partagent la même forme de charge.
const TOUS_TYPES = new Map(TYPES.map((type) => [type, { ...SCHEMA, type }]));
resultat(
  'P-c accepte la variante COMPLÈTE',
  compter((s) => void controlerClesEmises(traficUniforme(), TOUS_TYPES, s)) === 0,
);
resultat(
  'P-c ferme la porte sur un type émis sans schéma au contrat',
  compter((s) => void controlerClesEmises(traficUniforme(), new Map(), s)) === TYPES.length,
);

// --- Violations volontaires, une par contrôle --------------------------------

console.log('');
console.log('AUTO-ESSAI — violations volontaires : chaque contrôle doit parler');

const sansUneTrame = traficUniforme().filter(
  (trame, index) => !(index === 4 && trame.pour === 'J1'),
);
resultat(
  'U1a voit une trame de moins pour J1',
  compter((s) => void controlerNombre(profils(sansUneTrame, JOUEURS), 'violation', s)) === 1,
);

const typeChange = traficUniforme().map((trame, index) =>
  index === 4 ? { ...trame, type: 'resultat_enquete' } : trame,
);
resultat(
  'U1b voit un type différent au même rang',
  compter((s) => void controlerSequence(profils(typeChange, JOUEURS), 'violation', s)) >= 1,
);

// Les trames d'un même rang ne sont plus consécutives : l'émission n'est plus
// groupée en lot, alors que le dénombrement et les types restent parfaits.
const desaligne = traficUniforme().map((trame) => ({
  ordre: trame.pour === 'J0' ? trame.ordre : trame.ordre + 100,
  type: trame.type,
  pour: trame.pour,
  charge: trame.charge,
  phase: trame.phase,
  manche: trame.manche,
  octets: trame.octets,
}));
const profilsDesalignes = profils(desaligne, JOUEURS);
resultat(
  'U1a reste muet sur un désalignement de lot (il ne mesure que le nombre)',
  compter((s) => void controlerNombre(profilsDesalignes, 'violation', s)) === 0,
);
resultat(
  'U1d voit le désalignement de lot que U1a ne voit pas',
  compter((s) => void controlerAlignement(profilsDesalignes, 'violation', s)) === 1,
);

const tailleChangee = traficUniforme().map((trame, index) =>
  index === 4 ? { ...trame, octets: 129 } : trame,
);
resultat(
  'U1c voit UN octet d’écart sur une seule trame',
  mesurerEcartsDeTaille(profils(tailleChangee, JOUEURS)).rangs === 1,
);

const varianteB = [
  ...traficUniforme(),
  {
    ordre: 99,
    type: 'resultat_enquete',
    pour: 'J1',
    charge: {},
    phase: null,
    manche: 1,
    octets: 128,
  },
];
resultat(
  'U2 voit une trame de plus chez l’acteur, à profil par ailleurs identique',
  compter(
    (s) => void controlerDifferentiel(sain, profils(varianteB, JOUEURS), 'violation', s),
  ) === 1,
);

// --- P-c : seuil EXACT, dans les deux sens -----------------------------------

const avecCharge = (charge: Readonly<Record<string, unknown>>): Trame[] => [
  {
    ordre: 1,
    type: SCHEMA.type,
    pour: 'J0',
    charge,
    phase: null,
    manche: 1,
    octets: 32,
  },
];
const parType = new Map([[SCHEMA.type, SCHEMA]]);
resultat(
  'P-c accepte la variante NEUTRE exactement ({numero_manche})',
  compter((s) => void controlerClesEmises(avecCharge({ numero_manche: 1 }), parType, s)) === 0,
);
resultat(
  'P-c REFUSE un sous-ensemble strict de la variante complète ({solde_pieces})',
  compter((s) => void controlerClesEmises(avecCharge({ solde_pieces: 12 }), parType, s)) === 1,
);
resultat(
  'P-c REFUSE la variante neutre AVEC une clé de plus (charge à moitié vidée)',
  compter(
    (s) => void controlerClesEmises(avecCharge({ numero_manche: 1, autre: 1 }), parType, s),
  ) === 1,
);
resultat(
  'P-c REFUSE l’objet vide quand x-charge-neutre n’est pas vide',
  compter((s) => void controlerClesEmises(avecCharge({}), parType, s)) === 1,
);

console.log('');
console.log(
  echecs === 0
    ? 'AUTO-ESSAI CONFORME — l’instrument dit oui quand il doit, non quand il doit.'
    : `AUTO-ESSAI EN ÉCHEC — ${String(echecs)} comportement(s) non conforme(s) de l’instrument.`,
);
process.exit(echecs === 0 ? 0 : 1);
