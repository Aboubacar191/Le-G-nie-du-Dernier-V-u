<script setup lang="ts">
// Représentation de la TABLE PHYSIQUE.
//
// Ce n'est pas une décoration : le gabarit de révélation VOISINAGE n'a de sens
// que si le cercle affiché correspond à la disposition réelle des chaises. Un
// cercle faux rend une révélation vraie incompréhensible et casse la confiance
// dans le génie, qui est la seule autorité de la table.
//
// La rotation est calculée par logique/positions-cercle.ts : ma carte est en
// bas, à 6 heures, et le sens horaire est conservé. Conséquence vérifiable, et
// vérifiée par test : le marchand assis à ma gauche apparaît à gauche.
//
// Structure : une LISTE ORDONNÉE stylée en cercle. L'ordre du DOM suit l'ordre
// du cercle depuis soi, donc l'ordre de tabulation est l'ordre physique de la
// table. Sans mise en forme, le repli reste une liste lisible du voisin de
// gauche au voisin de droite.

import { computed } from 'vue';

import type { JoueurPublic } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import { disposerCercle, ordreEstValide, type PlaceAffichee } from '../logique/positions-cercle.ts';
import BandeauAlerte from './BandeauAlerte.vue';
import CarteJoueurCercle from './CarteJoueurCercle.vue';
import EtatVide from './EtatVide.vue';
import SqueletteChargement from './SqueletteChargement.vue';

export type VarianteCercle = 'lecture' | 'placement_hote' | 'selection_cible';

interface Props {
  joueurs: readonly JoueurPublic[];
  ordre: readonly string[];
  moi: string;
  variante?: VarianteCercle;
  declarations?: Readonly<Record<string, number>>;
  verdicts?: Readonly<Record<string, 'MENTEUR' | 'HONNETE'>>;
  exclus?: readonly string[];
  nommes?: readonly string[];
  cibleChoisie?: string | null;
  raisonsIndisponibles?: Readonly<Record<string, string>>;
  chargement?: boolean;
  /** Variante placement_hote demandée par un non-hôte. */
  accesRefuse?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'lecture',
  declarations: () => ({}),
  verdicts: () => ({}),
  exclus: () => [],
  nommes: () => [],
  cibleChoisie: null,
  raisonsIndisponibles: () => ({}),
  chargement: false,
  accesRefuse: false,
});

const emettre = defineEmits<{ choisir: [joueurId: string]; reessayer: []; sortir: [] }>();

const identifiants = computed(() => props.joueurs.map((joueur) => joueur.joueur_id));
const ordreCoherent = computed(() => ordreEstValide(props.ordre, identifiants.value));
const places = computed((): readonly PlaceAffichee[] =>
  ordreCoherent.value ? disposerCercle(props.ordre, props.moi) : [],
);

const joueurDe = (joueurId: string): JoueurPublic | undefined =>
  props.joueurs.find((joueur) => joueur.joueur_id === joueurId);

/** Position en pourcentage : le cercle est inscrit dans un carré fluide. */
function styleDe(place: PlaceAffichee): Record<string, string> {
  const centre = 50;
  const amplitude = 38;
  return {
    left: `${centre + place.x * amplitude}%`,
    top: `${centre + place.y * amplitude}%`,
  };
}
</script>

<template>
  <div class="cercle">
    <EtatVide
      v-if="props.accesRefuse"
      :titre="texte('cercle.acces_refuse')"
      :action-libelle="texte('cercle.revenir_attente')"
      @agir="emettre('sortir')"
    />

    <SqueletteChargement
      v-else-if="props.chargement"
      :lignes="props.joueurs.length || 5"
      hauteur="var(--gdv-hauteur-carte-joueur)"
      :libelle="texte('commun.chargement')"
    />

    <BandeauAlerte
      v-else-if="props.ordre.length > 0 && !ordreCoherent"
      variante="erreur"
      cle-contenu="cercle.incoherent"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="emettre('reessayer')"
    />

    <EtatVide
      v-else-if="props.ordre.length === 0"
      :titre="texte('cercle.places_non_fixees')"
      :action-libelle="texte('cercle.attendre_hote')"
      @agir="emettre('sortir')"
    />

    <ol
      v-else
      class="cercle__liste"
      :class="`cercle__liste--${props.variante}`"
    >
      <li
        v-for="place in places"
        :key="place.joueur_id"
        class="cercle__place"
        :style="styleDe(place)"
      >
        <CarteJoueurCercle
          :pseudo="joueurDe(place.joueur_id)?.pseudo ?? place.joueur_id"
          :position-cercle="joueurDe(place.joueur_id)?.position_cercle ?? null"
          :connecte="joueurDe(place.joueur_id)?.connecte ?? false"
          :relation="place.relation"
          :montant-declare="props.declarations[place.joueur_id] ?? null"
          :verdict="props.verdicts[place.joueur_id] ?? null"
          :exclu-du-partage="props.exclus.includes(place.joueur_id)"
          :nomme-par-le-genie="props.nommes.includes(place.joueur_id)"
          :selectionnee="props.cibleChoisie === place.joueur_id"
          :raison-indisponible="props.raisonsIndisponibles[place.joueur_id] ?? ''"
          :variante="props.variante === 'selection_cible' ? 'selectionnable' : 'compacte'"
          @choisir="emettre('choisir', place.joueur_id)"
        />
      </li>
      <li class="cercle__centre">
        <slot name="centre" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.cercle {
  inline-size: 100%;
}

.cercle__liste {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  inline-size: 100%;
  /* Carré fluide : le cercle ne porte aucune largeur fixe en pixels, pour
     rester lisible à 200 % de zoom sans défilement horizontal. */
  aspect-ratio: 1;
}

.cercle__place {
  position: absolute;
  transform: translate(-50%, -50%);
}

.cercle__centre {
  position: absolute;
  inset: 25%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--gdv-espacement-12);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-primaire);
  overflow: hidden;
}

/* Repli sans mise en forme : la liste ordonnée reste lisible du voisin de
   gauche au voisin de droite. Sous la rupture mobile, on l'assume comme
   disposition principale (repli_par_defaut du contrat de conception). */
@media (max-width: 359px) {
  .cercle__liste {
    display: flex;
    flex-direction: column;
    gap: var(--gdv-espacement-8);
    aspect-ratio: auto;
  }

  .cercle__place {
    position: static;
    transform: none;
  }

  .cercle__centre {
    position: static;
    inset: auto;
  }
}
</style>
