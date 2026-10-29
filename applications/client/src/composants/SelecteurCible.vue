<script setup lang="ts">
// Choix d'un marchand pour une enquête ou une accusation, dans une fenêtre de
// 60 s qui doit contenir : choisir, payer, lire un résultat, décider d'accuser.
//
// Réutilise CercleDesPlaces en variante selection_cible : le joueur choisit sur
// la même représentation que celle qu'il a sous les yeux dans la pièce, sans
// traduction mentale.
//
// Enquête  : 2 contacts — choisir, puis MAINTENIR le bouton. La confirmation
//            est portée par le geste, pour tenir dans les 60 s.
// Accusation : 3 contacts — choisir, Accuser, puis confirmer au dialogue. Un
//            contact de plus est justifié : l'accusation est publique,
//            irréversible et limitée à une par manche.
//
// Le COÛT de l'enquête ne figure PAS sur le bouton public : il vaut
// cout_enquete ou cout_enquete_inspecteur_tresor selon le rôle, et un voisin
// qui lirait 1 au lieu de 2 en déduirait l'INSPECTEUR_TRESOR. Le bouton porte
// un libellé invariant, et le coût se lit sous le voile.

import { computed, ref } from 'vue';

import type { JoueurPublic } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import BandeauAlerte from './BandeauAlerte.vue';
import BoutonAction from './BoutonAction.vue';
import CercleDesPlaces from './CercleDesPlaces.vue';

export type VarianteSelecteur = 'enquete' | 'accusation';

interface Props {
  joueurs: readonly JoueurPublic[];
  ordre: readonly string[];
  moi: string;
  variante: VarianteSelecteur;
  declarations?: Readonly<Record<string, number>>;
  raisonsIndisponibles?: Readonly<Record<string, string>>;
  /** Raison globale : quota atteint, hors phase, or insuffisant. */
  raisonBlocage?: string;
  chargement?: boolean;
  /** Message de refus serveur. Il rappelle TOUJOURS le temps restant. */
  erreurCleContenu?: string;
  erreurValeurs?: Readonly<Record<string, string | number>>;
}

const props = withDefaults(defineProps<Props>(), {
  declarations: () => ({}),
  raisonsIndisponibles: () => ({}),
  raisonBlocage: '',
  chargement: false,
  erreurCleContenu: '',
  erreurValeurs: () => ({}),
});

const emettre = defineEmits<{ agir: [cible: string]; reessayer: [] }>();

const cible = ref<string | null>(null);

const bloque = computed(() => props.raisonBlocage !== '');
const sansCible = computed(() => cible.value === null);

const raisonBouton = computed((): string => {
  if (bloque.value) return props.raisonBlocage;
  if (sansCible.value) return texte('ecran.enquetes.choisis_cible');
  return '';
});

function agir(): void {
  if (cible.value === null) return;
  emettre('agir', cible.value);
}
</script>

<template>
  <div class="selecteur">
    <BandeauAlerte
      v-if="props.erreurCleContenu"
      variante="erreur"
      :cle-contenu="props.erreurCleContenu"
      :valeurs="props.erreurValeurs"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="emettre('reessayer')"
    />

    <CercleDesPlaces
      :joueurs="props.joueurs"
      :ordre="props.ordre"
      :moi="props.moi"
      variante="selection_cible"
      :declarations="props.declarations"
      :raisons-indisponibles="props.raisonsIndisponibles"
      :cible-choisie="cible"
      :chargement="props.chargement || bloque"
      @choisir="(joueurId) => (cible = joueurId)"
    >
      <template #centre>
        <slot name="centre" />
      </template>
    </CercleDesPlaces>

    <!-- Le coût exact est dans le voile, fourni par l'écran appelant. -->
    <slot name="cout" />

    <BoutonAction
      v-if="props.variante === 'enquete'"
      :libelle="texte('ecran.enquetes.enqueter')"
      variante="principal"
      taille="lg"
      maintien
      pleine-largeur
      :desactive="bloque || sansCible || props.chargement"
      :raison="raisonBouton"
      :chargement="props.chargement"
      @agir="agir"
    />
    <BoutonAction
      v-else
      :libelle="texte('ecran.enquetes.accuser')"
      variante="destructeur"
      taille="lg"
      pleine-largeur
      :desactive="bloque || sansCible || props.chargement"
      :raison="raisonBouton"
      :chargement="props.chargement"
      @agir="agir"
    />
  </div>
</template>

<style scoped>
.selecteur {
  display: flex;
  flex-direction: column;
  /* L'action destructrice est séparée de l'action courante par espacement.24 :
     on ne peut pas accuser par erreur en visant mal. */
  gap: var(--gdv-espacement-24);
  inline-size: 100%;
}
</style>
