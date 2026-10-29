<script setup lang="ts">
// UNIQUE garde-fou des actes irréversibles à FORT enjeu : accuser, abandonner
// la partie.
//
// Réservé aux actes qui ne peuvent pas être annulés ET qui engagent
// publiquement le joueur. Les actes irréversibles à faible enjeu sous
// contrainte de temps — l'enquête — utilisent le maintien du bouton, pas ce
// dialogue : trois contacts dans une fenêtre de 60 s seraient de trop.
//
// Trois règles du contrat de conception :
//  · le titre formule la CONSÉQUENCE, pas l'action ;
//  · le corps énonce le RISQUE CHIFFRÉ, et jamais le gain potentiel, qui
//    dépendrait de l'ampleur du mensonge — donnée secrète à ce stade ;
//  · le focus initial ne porte JAMAIS l'acte destructeur.
//
// Si la phase expire pendant le dialogue, il se ferme de lui-même et l'écran
// explique. Jamais une soumission silencieuse après l'expiration.

import { nextTick, onMounted, ref, useId, watch } from 'vue';

import BoutonAction from './BoutonAction.vue';

interface Props {
  titre: string;
  corps: string;
  libelleConfirmer: string;
  libelleRenoncer: string;
  chargement?: boolean;
  erreur?: string;
  /** Devient vrai quand la phase expire : le dialogue se referme seul. */
  phaseExpiree?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  chargement: false,
  erreur: '',
  phaseExpiree: false,
});

const emettre = defineEmits<{ confirmer: []; renoncer: []; expirer: [] }>();

const identifiant = useId();
const idTitre = `${identifiant}-titre`;
const idCorps = `${identifiant}-corps`;
const renoncer = ref<HTMLElement | null>(null);

onMounted(async () => {
  await nextTick();
  (renoncer.value?.querySelector('button') as HTMLElement | null)?.focus();
});

watch(
  () => props.phaseExpiree,
  (expiree) => {
    if (expiree) emettre('expirer');
  },
);
</script>

<template>
  <div class="arriere">
    <section
      class="dialogue"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="idTitre"
      :aria-describedby="idCorps"
      @keydown.esc="emettre('renoncer')"
    >
      <h2
        :id="idTitre"
        class="dialogue__titre"
      >
        {{ props.titre }}
      </h2>
      <p
        :id="idCorps"
        class="dialogue__corps"
      >
        {{ props.corps }}
      </p>
      <p
        v-if="props.erreur"
        class="dialogue__erreur"
      >
        {{ props.erreur }}
      </p>

      <!-- L'action destructrice est à espacement.24 de l'action de retrait,
           jamais côte à côte au ras : Fitts appliqué à l'envers, on éloigne
           volontairement la cible dangereuse. -->
      <div class="dialogue__actions">
        <div ref="renoncer">
          <BoutonAction
            :libelle="props.libelleRenoncer"
            variante="discret"
            taille="md"
            @agir="emettre('renoncer')"
          />
        </div>
        <BoutonAction
          :libelle="props.libelleConfirmer"
          variante="destructeur"
          taille="md"
          :chargement="props.chargement"
          @agir="emettre('confirmer')"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.arriere {
  position: fixed;
  inset: 0;
  z-index: var(--gdv-zindex-dialogue);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--gdv-gouttiere-ecran);
  background: color-mix(in srgb, var(--gdv-secret-voile) 60%, transparent);
}

.dialogue {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  inline-size: 100%;
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  padding: var(--gdv-espacement-24);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-primaire);
  box-shadow: var(--gdv-elevation-flottante);
  color: var(--gdv-texte-principal);
}

.dialogue__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.dialogue__corps {
  margin: 0;
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

.dialogue__erreur {
  margin: 0;
  color: var(--gdv-statut-echec);
  font-size: var(--gdv-role-etiquette);
}

.dialogue__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-24);
  margin-block-start: var(--gdv-espacement-16);
}
</style>
