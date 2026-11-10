<script setup lang="ts">
// Liste « Autour de la table », vue invité — écran 1b du prototype. Un
// marchand par ligne, numéro d'ordre d'ARRIVÉE (jamais position_cercle, NUL
// avant PLACEMENT — RG-06), statut « Prêt »/« Pas encore » déjà public
// (JoueurPublic.pret).
//
// Extrait de vues/EcranSalleAttente.vue (porte de lint max-lines) : purement
// présentationnel.

import { texte } from '../logique/contenu.ts';

interface JoueurAffiche {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly connecte: boolean;
  readonly est_hote: boolean;
  readonly pret: boolean;
}

interface Props {
  joueurs: readonly JoueurAffiche[];
  moiId: string;
}

const props = defineProps<Props>();
</script>

<template>
  <ol class="liste">
    <li
      v-for="(joueur, index) in props.joueurs"
      :key="joueur.joueur_id"
    >
      <div
        class="liste__ligne"
        :class="{ 'liste__ligne--moi': joueur.joueur_id === props.moiId }"
      >
        <span
          class="liste__numero"
          aria-hidden="true"
        >{{ index + 1 }}</span>
        <span class="liste__pseudo">
          {{ joueur.joueur_id === props.moiId ? texte('ecran.salle_attente.moi') : joueur.pseudo }}
          <span
            v-if="joueur.est_hote"
            class="liste__hote"
          >· {{ texte('ecran.salle_attente.suffixe_hote') }}</span>
        </span>
        <span
          class="liste__statut"
          :class="{ 'liste__statut--pret': joueur.pret }"
        >
          {{ joueur.pret ? texte('ecran.salle_attente.statut_pret') : texte('ecran.salle_attente.statut_pas_encore') }}
        </span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.liste__ligne {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-8);
  min-block-size: var(--gdv-cible-minimale);
  padding-inline: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
}

.liste__ligne--moi {
  border-color: var(--gdv-accent-action);
  background: var(--gdv-surface-primaire);
}

.liste__numero {
  flex-shrink: 0;
  inline-size: var(--gdv-taille-24);
  color: var(--gdv-texte-secondaire);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-etiquette);
}

.liste__pseudo {
  flex: 1 1 auto;
  overflow: hidden;
  font-size: var(--gdv-role-etiquette);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.liste__hote {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.liste__statut {
  flex-shrink: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.liste__statut--pret {
  color: var(--gdv-statut-succes);
}
</style>
