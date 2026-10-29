<script setup lang="ts">
// Valeur monétaire PUBLIQUE : déclaration, part, amende liquidée, objectif.
//
// INTERDIT pour toute valeur secrète. Un montant secret passe obligatoirement
// par VoileSecret. Le contrat d'entrée de ce composant refuse donc par
// construction montant_paye et solde_pieces : il n'accepte qu'un nombre dont
// l'appelant a déjà établi qu'il est public (matrice_visibilite).
//
// Jamais un zéro à la place d'une valeur inconnue : deux tirets cadratins. Un
// zéro affirmerait une déclaration qui n'existe pas encore.

import { texte } from '../logique/contenu.ts';

interface Props {
  /** Null = valeur indisponible. Rendue en tirets, jamais en zéro. */
  valeur: number | null;
  /** Le signe est TEXTUEL, jamais seulement coloré. */
  signe?: 'aucun' | 'positif' | 'negatif';
  desactive?: boolean;
  /** Complément du nom accessible : l'unité y est toujours présente. */
  etiquette?: string;
}

const props = withDefaults(defineProps<Props>(), {
  signe: 'aucun',
  desactive: false,
  etiquette: '',
});

const prefixe = (): string => {
  if (props.valeur === null) return '';
  if (props.signe === 'positif') return '+';
  if (props.signe === 'negatif') return '−';
  return '';
};

const affichage = (): string =>
  props.valeur === null ? texte('commun.valeur_indisponible') : `${prefixe()}${props.valeur}`;

const nomAccessible = (): string => {
  const unite = props.valeur === 1 ? texte('commun.piece_une') : texte('commun.pieces');
  const base = props.valeur === null ? texte('commun.valeur_indisponible') : `${prefixe()}${props.valeur} ${unite}`;
  return props.etiquette === '' ? base : `${props.etiquette} : ${base}`;
};
</script>

<template>
  <span
    class="jeton"
    :class="{
      'jeton--positif': props.signe === 'positif',
      'jeton--negatif': props.signe === 'negatif',
      'jeton--desactive': props.desactive,
      'jeton--indisponible': props.valeur === null,
    }"
    :aria-label="nomAccessible()"
  >
    {{ affichage() }}
  </span>
</template>

<style scoped>
.jeton {
  display: inline-flex;
  align-items: center;
  height: var(--gdv-espacement-32);
  padding-inline: var(--gdv-espacement-12);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-corps);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

.jeton--positif {
  color: var(--gdv-statut-succes);
}

.jeton--negatif {
  color: var(--gdv-statut-echec);
}

.jeton--desactive {
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
}

.jeton--indisponible {
  background: transparent;
  color: var(--gdv-texte-secondaire);
}
</style>
