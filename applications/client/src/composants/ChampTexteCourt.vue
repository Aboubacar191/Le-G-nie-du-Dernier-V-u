<script setup lang="ts">
// SEULE saisie clavier de l'application : pseudo et code d'adhésion. Hors de
// toute phase minutée.
//
// Aucun montant ne passe jamais par ici (RG-78) : c'est IncrementeurMontant qui
// porte les nombres. Le champ n'accepte que du texte, et `inputmode` reste
// textuel — un inputmode numérique ouvrirait le pavé que la règle interdit.
//
// Libellé textuel PERSISTANT au-dessus du champ, associé par for et id. Aucun
// placeholder ne sert de libellé : un placeholder disparaît à la saisie, et le
// joueur ne sait plus ce qu'il remplit.
//
// Taille à typographie.taille.16 au minimum : en dessous, iOS zoome à la mise
// au point et casse la mise en page à 360 px.

import { computed, useId } from 'vue';

import MinuteurPhase from './MinuteurPhase.vue';
import { DECOMPTE_INCONNU } from '../logique/decompte.ts';

export type VarianteChamp = 'pseudo' | 'code_adhesion';

interface Props {
  valeur: string;
  variante: VarianteChamp;
  libelle: string;
  aide?: string;
  erreur?: string;
  desactive?: boolean;
  chargement?: boolean;
  longueurMax: number;
}

const props = withDefaults(defineProps<Props>(), {
  aide: '',
  erreur: '',
  desactive: false,
  chargement: false,
});

const emettre = defineEmits<{ 'update:valeur': [valeur: string] }>();

const identifiant = useId();
const idAide = `${identifiant}-aide`;
const idErreur = `${identifiant}-erreur`;

const estCode = computed(() => props.variante === 'code_adhesion');

const decrit = computed((): string => {
  const parties: string[] = [];
  if (props.aide !== '') parties.push(idAide);
  if (props.erreur !== '') parties.push(idErreur);
  return parties.join(' ');
});

/**
 * Le code d'adhésion est normalisé à la saisie : majuscules, et rien d'autre
 * que les caractères du jeu sans ambiguïté visuelle du contrat (ni O ni 0, ni I
 * ni l ni 1). Un code mal relu à voix haute dans une pièce bruyante est le
 * premier échec d'adhésion.
 */
function normaliser(brut: string): string {
  if (!estCode.value) return brut.slice(0, props.longueurMax);
  return brut
    .toUpperCase()
    .replaceAll(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/gu, '')
    .slice(0, props.longueurMax);
}

function saisir(evenement: Event): void {
  const cible = evenement.target as HTMLInputElement;
  const propre = normaliser(cible.value);
  if (cible.value !== propre) cible.value = propre;
  emettre('update:valeur', propre);
}
</script>

<template>
  <div class="champ">
    <label
      class="champ__libelle"
      :for="identifiant"
    >{{ props.libelle }}</label>

    <input
      :id="identifiant"
      class="champ__saisie"
      :class="{ 'champ__saisie--code': estCode, 'champ__saisie--erreur': props.erreur !== '' }"
      type="text"
      inputmode="text"
      :value="props.valeur"
      :maxlength="props.longueurMax"
      :disabled="props.desactive"
      :autocomplete="estCode ? 'off' : 'nickname'"
      :autocapitalize="estCode ? 'characters' : 'none'"
      spellcheck="false"
      :aria-describedby="decrit || undefined"
      :aria-invalid="props.erreur !== ''"
      @input="saisir"
    >

    <MinuteurPhase
      v-if="props.chargement"
      variante="barre"
      taille="md"
      indeterminee
      :decompte="DECOMPTE_INCONNU"
      :libelle="props.libelle"
    />

    <p
      v-if="props.aide"
      :id="idAide"
      class="champ__aide"
    >
      {{ props.aide }}
    </p>

    <!-- Le message dit QUOI FAIRE, et il est préfixé d'un glyphe de forme
         distincte : jamais la couleur seule. -->
    <p
      v-if="props.erreur"
      :id="idErreur"
      class="champ__erreur"
    >
      <span aria-hidden="true">✕</span> {{ props.erreur }}
    </p>
  </div>
</template>

<style scoped>
.champ {
  display: flex;
  flex-direction: column;
  /* Écart libellé → champ : espacement.4. Écart entre deux champs :
     espacement.16, porté par le parent. Rapport 1 pour 4, jamais ambigu. */
  gap: var(--gdv-espacement-4);
  inline-size: 100%;
}

.champ__libelle {
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-etiquette);
}

.champ__saisie {
  min-block-size: var(--gdv-hauteur-champ);
  padding-inline: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  inline-size: 100%;
}

.champ__saisie--code {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-titre-section);
  letter-spacing: var(--gdv-espacement-8);
  text-transform: uppercase;
}

.champ__saisie:focus-visible {
  border-color: var(--gdv-accent-focus);
  border-width: var(--gdv-trait-moyen);
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.champ__saisie:disabled {
  border-color: var(--gdv-bordure-structurante);
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
}

.champ__saisie--erreur {
  border-color: var(--gdv-statut-echec);
  border-width: var(--gdv-trait-moyen);
}

.champ__aide {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.champ__erreur {
  margin: 0;
  color: var(--gdv-statut-echec);
  font-size: var(--gdv-role-etiquette);
  line-height: var(--gdv-interligne-courant);
}
</style>
