<script setup lang="ts">
// ECR-23 — Dernier Vœu, proposition privée. Phase DV_PROPOSITION, 20 s,
// lecture seule (US-14, RG-52).
//
// La proposition est INDIVIDUELLE et IDENTIQUE pour tous : c'est ce qui fait
// que personne ne peut déduire qui est déjà lié. Application de RG-77 — la
// carte de proposition est rigoureusement la même chez les 5 à 8 joueurs, y
// compris chez le MARCHAND_DEJA_LIE. Son rôle, lui, lui a été remis à la
// distribution et reste relisible dans le panneau privé, sous voile.
//
// La table de résolution est affichée EN CLAIR, parce qu'elle est publique et
// que c'est elle qui fait le dilemme. La cacher transformerait un dilemme en
// loterie.
//
// ÉTATS (DESIGN ECR-23)
// chargement   : voile en chargement, « Le génie te parle à l'oreille ».
// contenu      : parole publique du génie, table de résolution en clair, carte
//                de proposition voilée contenant le montant.
// vide         : NON atteignable — la proposition est faite à chaque marchand.
// erreur       : proposition non reçue. Le bouton de signature de ECR-25 reste
//                actif quand même : le défaut de non-soumission est le REFUS,
//                le joueur n'est donc pas lésé.
// acces_refuse : mode avancé inactif — non atteignable, la partie passe de la
//                manche 5 directement aux scores.

import { computed } from 'vue';

import BulleGenie from '../composants/BulleGenie.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const proposition = computed(() => magasin.etat.proposition_dernier_voeu);
const etatVoile = computed(() => (proposition.value === null ? 'chargement' : null));

const recompense = computed((): number => {
  const config = magasin.etat.session?.config as {
    recompense_signature_dernier_voeu?: number;
  };
  return proposition.value?.montant_propose ?? config?.recompense_signature_dernier_voeu ?? 0;
});
</script>

<template>
  <section class="dv-proposition">
    <BulleGenie
      variante="annonce"
      :phrase="texte('ecran.dernier_voeu.titre')"
    />

    <!-- Table de résolution : publique, en clair, et c'est voulu. -->
    <section class="dv-proposition__regle">
      <h3 class="dv-proposition__titre">
        {{ texte('ecran.dernier_voeu.table_resolution') }}
      </h3>
      <ul class="dv-proposition__liste">
        <li>{{ texte('ecran.dernier_voeu.regle_1', { recompense }) }}</li>
        <li>{{ texte('ecran.dernier_voeu.regle_2') }}</li>
        <li>{{ texte('ecran.dernier_voeu.regle_3') }}</li>
      </ul>
    </section>

    <!-- Carte rigoureusement IDENTIQUE chez tous : aucun v-if sur le rôle. -->
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.dernier_voeu.titre')"
      :etat-impose="etatVoile"
    >
      <template #secret>
        <span class="dv-proposition__montant">
          {{ texte('ecran.dernier_voeu.proposition', { montant: recompense }) }}
        </span>
      </template>
    </VoileSecret>
  </section>
</template>

<style scoped>
.dv-proposition {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.dv-proposition__regle {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  padding: var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
}

.dv-proposition__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.dv-proposition__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin: 0;
  padding-inline-start: var(--gdv-espacement-16);
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.dv-proposition__montant {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}
</style>
