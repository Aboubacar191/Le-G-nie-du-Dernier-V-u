<script setup lang="ts">
// Contenu d'une étape du tutoriel — extrait de ReglesExplicatives.vue (porte
// de lint max-lines). Purement présentationnel, l'étape courante est portée
// par l'appelant.

import { texte } from '../logique/contenu.ts';

interface Props {
  etape: number;
}

const props = defineProps<Props>();
</script>

<template>
  <div
    v-if="props.etape === 0"
    class="contenu"
  >
    <h1 class="contenu__titre">
      {{ texte('ecran.regles.etape_1_titre') }}
    </h1>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_1_texte') }}
    </p>
    <div class="contenu__grille">
      <div class="contenu__case">
        <span class="contenu__case-libelle">{{ texte('ecran.regles.etape_1_annonce_libelle') }}</span>
        <span class="contenu__case-valeur">{{ texte('ecran.regles.etape_1_annonce_valeur') }}</span>
      </div>
      <div class="contenu__case contenu__case--or">
        <span class="contenu__case-libelle">{{ texte('ecran.regles.etape_1_paye_libelle') }}</span>
        <span class="contenu__case-valeur">{{ texte('ecran.regles.etape_1_paye_valeur') }}</span>
      </div>
    </div>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_1_texte_2') }}
    </p>
  </div>

  <div
    v-else-if="props.etape === 1"
    class="contenu"
  >
    <h1 class="contenu__titre">
      {{ texte('ecran.regles.etape_2_titre') }}
    </h1>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_2_texte') }}
    </p>
    <p class="contenu__citation">
      {{ texte('ecran.regles.etape_2_citation') }}
    </p>
    <ul class="contenu__liste">
      <li class="contenu__item">
        {{ texte('ecran.regles.etape_2_enqueter') }}
      </li>
      <li class="contenu__item contenu__item--succes">
        {{ texte('ecran.regles.etape_2_accusation_juste') }}
      </li>
      <li class="contenu__item contenu__item--echec">
        {{ texte('ecran.regles.etape_2_fausse_accusation') }}
      </li>
    </ul>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_2_texte_2') }}
    </p>
  </div>

  <div
    v-else
    class="contenu"
  >
    <h1 class="contenu__titre">
      {{ texte('ecran.regles.etape_3_titre') }}
    </h1>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_3_texte') }}
    </p>
    <div class="contenu__grille">
      <div class="contenu__case">
        <span class="contenu__case-libelle">{{ texte('ecran.regles.etape_3_exemple_role_libelle') }}</span>
        <span class="contenu__case-nom">{{ texte('ecran.regles.etape_3_exemple_role_valeur') }}</span>
      </div>
      <div class="contenu__case">
        <span class="contenu__case-libelle">{{ texte('ecran.regles.etape_3_exemple_mission_libelle') }}</span>
        <span class="contenu__case-nom">{{ texte('ecran.regles.etape_3_exemple_mission_valeur') }}</span>
      </div>
    </div>
    <div class="contenu__score">
      <span>{{ texte('ecran.regles.etape_3_score_libelle') }}</span>
      <span class="contenu__score-valeur">{{ texte('ecran.regles.etape_3_score_valeur') }}</span>
    </div>
    <p class="contenu__texte">
      {{ texte('ecran.regles.etape_3_texte_2') }}
    </p>
  </div>
</template>

<style scoped>
.contenu {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
}

.contenu__titre {
  margin: 0;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-section);
  font-weight: var(--gdv-graisse-tres-gras);
  line-height: var(--gdv-interligne-titre);
}

.contenu__texte {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

.contenu__grille {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--gdv-espacement-8);
}

.contenu__case {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  padding: var(--gdv-espacement-12);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
}

.contenu__case--or {
  border-color: var(--gdv-bordure-secret);
}

.contenu__case-libelle {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

/* Chiffre d'exemple, pas une donnée de jeu : famille.chiffres + largeur
   tabulaire, exigées par la porte dès que role-nombre-secondaire est posé. */
.contenu__case-valeur {
  font-family: var(--gdv-famille-chiffres);
  font-variant-numeric: var(--gdv-chiffres-variant);
  font-size: var(--gdv-role-nombre-secondaire);
  font-weight: var(--gdv-graisse-tres-gras);
}

/* Nom de rôle ou de mission, pas un chiffre : famille.interface, jamais
   famille.chiffres — contrairement à .contenu__case-valeur ci-dessus. */
.contenu__case-nom {
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-tres-gras);
}

.contenu__citation {
  margin: 0;
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
  font-family: var(--gdv-famille-voix-genie);
  font-size: var(--gdv-role-voix-genie);
  line-height: var(--gdv-interligne-titre);
}

.contenu__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding: 0;
  list-style: none;
}

.contenu__item {
  padding: var(--gdv-espacement-12);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  font-size: var(--gdv-role-etiquette);
  line-height: var(--gdv-interligne-courant);
}

.contenu__item--succes {
  color: var(--gdv-statut-succes);
}

.contenu__item--echec {
  color: var(--gdv-statut-echec);
}

.contenu__score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-secret);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.contenu__score-valeur {
  font-size: var(--gdv-role-titre-section);
  font-weight: var(--gdv-graisse-tres-gras);
}
</style>
