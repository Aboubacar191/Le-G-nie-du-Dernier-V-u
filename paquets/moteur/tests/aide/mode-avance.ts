// Outillage : mener une partie jusqu'au Dernier Vœu.
//
// Les cinq manches sont traversées sans aucune action : les contributions non
// soumises valent 0 (RG-32), les vœux échouent, et les soldes restent à
// pieces_initiales. C'est exactement ce qu'il faut pour que les montants du
// Dernier Vœu soient lisibles sans arithmétique parasite.

import { Table, type OptionsTable } from './table.ts';

export interface TableDernierVoeu {
  readonly table: Table;
  readonly marchandDejaLie: string;
  readonly gardienDeLaLampe: string;
}

export function allerAuDernierVoeu(options: OptionsTable = {}): TableDernierVoeu {
  const table = new Table({ joueurs: 6, graine: 'dv', ...options, mode_avance: true }).demarrer();

  const marchandDejaLie = table.etat.joueurs.find(
    (joueur) => joueur.role_secret === 'MARCHAND_DEJA_LIE',
  )?.id;
  const gardienDeLaLampe = table.etat.joueurs.find(
    (joueur) => joueur.mission_secrete === 'GARDIEN_DE_LA_LAMPE',
  )?.id;
  if (marchandDejaLie === undefined || gardienDeLaLampe === undefined) {
    throw new Error('les deux rôles du mode avancé doivent être tirés à la distribution (RG-51)');
  }
  if (marchandDejaLie === gardienDeLaLampe) {
    throw new Error('RG-52 exige deux joueurs DISTINCTS');
  }

  for (let manche = 1; manche <= table.etat.config.nb_manches; manche += 1) {
    table.allerA('EXECUTION');
    table.expirer();
  }

  return { table, marchandDejaLie, gardienDeLaLampe };
}
