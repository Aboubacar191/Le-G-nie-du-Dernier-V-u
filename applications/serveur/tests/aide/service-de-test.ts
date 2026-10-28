// Outillage de test du serveur : un service complet sur base en mémoire.
//
// node:sqlite accepte ':memory:' : les tests n'écrivent aucun fichier, ne
// laissent aucun résidu et restent indépendants les uns des autres. L'horloge
// est injectée et ne bouge que quand un test le décide.

import { randomBytes } from 'node:crypto';

import { DepotSqlite } from '../../src/persistance/sqlite/index.ts';
import { creerService, type Service } from '../../src/service.ts';
import type { Depot } from '../../src/persistance/depot.ts';

export interface HarnaisServeur {
  readonly service: Service;
  readonly depot: Depot;
  avancerHorloge(ms: number): void;
  fermer(): void;
}

const INSTANT_INITIAL = 1_700_000_000_000;

export interface OptionsHarnais {
  /** Graine FIXE, pour un scénario reproductible et citable au rapport. */
  readonly graine?: string;
}

export function creerHarnais(options: OptionsHarnais = {}): HarnaisServeur {
  const depot = new DepotSqlite(':memory:');
  depot.migrer();
  let instant = INSTANT_INITIAL;
  let compteurGraine = 0;
  const tirerGraine = (): string => {
    if (options.graine === undefined) return randomBytes(32).toString('hex');
    compteurGraine += 1;
    return compteurGraine === 1 ? options.graine : `${options.graine}-${compteurGraine}`;
  };
  const service = creerService(depot, () => instant, tirerGraine);
  return {
    service,
    depot,
    avancerHorloge: (ms: number) => {
      instant += ms;
    },
    fermer: () => {
      service.ordonnanceur.arreter();
      depot.fermer();
    },
  };
}
