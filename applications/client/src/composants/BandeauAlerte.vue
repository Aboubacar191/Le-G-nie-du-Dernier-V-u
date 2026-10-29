<script setup lang="ts">
// Porte TOUTE erreur et TOUT refus serveur.
//
// Zone PUBLIQUE par construction (mesure M6) : ce composant n'accepte qu'une
// clé de contenu et des valeurs de substitution déjà jugées publiques par
// l'appelant. Aucun chiffre secret ne peut y entrer, et c'est voulu — un
// bandeau persistant est lisible par le voisin et peut apparaître dans un
// aperçu système.
//
// Règle de rédaction opposable : chaque message dit QUOI FAIRE, pas seulement
// ce qui a échoué. Un message qui s'arrête au diagnostic est refusé en revue ;
// les libellés sont dans contenu/fr.json, où la règle est vérifiable d'un coup
// d'œil.
//
// Les variantes information et succès disparaissent d'elles-mêmes. Les
// variantes avertissement et erreur ne disparaissent JAMAIS seules : elles
// exigent un acte du joueur.

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { texte, type Valeurs } from '../logique/contenu.ts';
import { DUREES_MS } from '../styles/jetons.ts';
import BoutonAction from './BoutonAction.vue';

export type VarianteAlerte = 'information' | 'avertissement' | 'erreur' | 'succes';

interface Props {
  variante: VarianteAlerte;
  cleContenu: string;
  valeurs?: Valeurs;
  /** Libellé de reprise. L'état par défaut de toute erreur est « avec reprise ». */
  actionLibelle?: string;
  chargement?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  valeurs: () => ({}),
  actionLibelle: '',
  chargement: false,
});
const emettre = defineEmits<{ reprendre: []; expirer: [] }>();

/** Glyphe de forme distincte par variante : jamais la couleur seule. */
const GLYPHES: Readonly<Record<VarianteAlerte, string>> = {
  information: 'i',
  avertissement: '!',
  erreur: '✕',
  succes: '✓',
};

const EPHEMERES: readonly VarianteAlerte[] = ['information', 'succes'];
const FACTEUR_DISPARITION = 10;

const visible = ref(true);
let minuterie: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  if (!EPHEMERES.includes(props.variante)) return;
  minuterie = setTimeout(() => {
    visible.value = false;
    emettre('expirer');
  }, DUREES_MS.lente * FACTEUR_DISPARITION);
});

onBeforeUnmount(() => {
  if (minuterie !== null) clearTimeout(minuterie);
});
</script>

<template>
  <div
    v-if="visible"
    class="alerte"
    :class="`alerte--${props.variante}`"
    role="alert"
    :aria-live="props.variante === 'erreur' ? 'assertive' : 'polite'"
  >
    <span
      class="alerte__glyphe"
      aria-hidden="true"
    >{{ GLYPHES[props.variante] }}</span>
    <p class="alerte__texte">
      {{ texte(props.cleContenu, props.valeurs) }}
    </p>
    <BoutonAction
      v-if="props.actionLibelle"
      :libelle="props.actionLibelle"
      variante="secondaire"
      taille="md"
      :chargement="props.chargement"
      @agir="emettre('reprendre')"
    />
  </div>
</template>

<style scoped>
/* Le bandeau ne recouvre JAMAIS le bandeau de phase : le joueur doit toujours
   voir le temps restant pendant qu'il lit une erreur. Il se place donc dans le
   flux, sous l'en-tête, et jamais en position fixe. */
.alerte {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-16);
  border-left: var(--gdv-trait-epais) solid var(--gdv-statut-info);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
}

.alerte--information {
  border-left-color: var(--gdv-statut-info);
}

.alerte--avertissement {
  border-left-color: var(--gdv-statut-avertissement);
}

.alerte--erreur {
  border-left-color: var(--gdv-statut-echec);
}

.alerte--succes {
  border-left-color: var(--gdv-statut-succes);
}

.alerte__glyphe {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--gdv-espacement-24);
  block-size: var(--gdv-espacement-24);
  border: var(--gdv-trait-moyen) solid currentcolor;
  border-radius: var(--gdv-rayon-pilule);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-gras);
}

.alerte--avertissement .alerte__glyphe {
  border-radius: var(--gdv-rayon-aucun);
}

.alerte--erreur .alerte__glyphe {
  border-radius: var(--gdv-rayon-discret);
}

.alerte__texte {
  flex: 1 1 auto;
  margin: 0;
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}
</style>
