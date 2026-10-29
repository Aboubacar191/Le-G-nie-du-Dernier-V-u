<script setup lang="ts">
// ECR-09 — Attribution privée : rôle et mission (US-04, CA-05, CA-06).
//
// Remettre à chaque marchand SON rôle et SA mission, sans que le voisin ne les
// lise. Deux VoileSecret DISTINCTS et deux maintiens SÉPARÉS : le joueur ne
// révèle que ce qu'il relit, et jamais les deux à la fois.
//
// L'hôte est un marchand comme les autres ici : il ne voit aucune information
// supplémentaire (RG-01).
//
// Aucun avancement collectif n'est affiché. Le contrat de conception prévoyait
// « k marchands sur n ont lu » ; aucun événement du protocole ne publie cette
// information, et je n'en invente pas. Écart consigné au rapport.
//
// ÉTATS (DESIGN ECR-09)
// chargement   : deux voiles en état chargement, aux dimensions finales.
// contenu      : deux cartes voilées empilées, zone de maintien en bas de
//                chacune, bouton de confirmation en pied.
// vide         : NON atteignable — chaque joueur reçoit exactement un rôle et
//                une mission. Un voile vide est l'état erreur, jamais le vide.
// erreur       : attribution non reçue, voile en erreur, et le bouton de
//                confirmation reste désactivé avec sa raison.
// acces_refuse : jeton invalide, ECR-32. Jamais d'attribution partielle.

import { computed, ref } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const pret = ref(false);

const role = computed(() => magasin.etat.moi?.role_secret ?? null);
const mission = computed(() => magasin.etat.moi?.mission_secrete ?? null);

/** Tant que le rôle n'est pas arrivé, le voile est en chargement, pas vide. */
const etatVoileRole = computed(() => (role.value === null ? 'chargement' : null));
/**
 * La mission peut être NULLE légitimement : en mode avancé, le marchand déjà
 * lié reçoit un rôle à la place de sa mission (RG-51). Le voile n'est donc en
 * chargement que si le rôle lui-même manque encore.
 */
const etatVoileMission = computed(() => (role.value === null ? 'chargement' : null));

const attributionRecue = computed(() => role.value !== null);
</script>

<template>
  <main class="attribution">
    <h1 class="attribution__titre">
      {{ texte('ecran.attribution.titre') }}
    </h1>

    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.attribution.mon_role')"
      :etat-impose="etatVoileRole"
    >
      <template #secret>
        <span class="attribution__valeur">
          {{ role === null ? texte('commun.valeur_indisponible') : texte(`role.${role}`) }}
        </span>
      </template>
    </VoileSecret>

    <!-- Le pouvoir du rôle est révélé avec lui : il est aussi secret que lui. -->
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.attribution.ma_mission')"
      :etat-impose="etatVoileMission"
    >
      <template #secret>
        <span class="attribution__valeur">
          {{ mission === null ? texte('commun.valeur_indisponible') : texte(`mission.${mission}`) }}
        </span>
      </template>
    </VoileSecret>

    <footer class="attribution__pied">
      <BoutonAction
        :libelle="pret ? texte('ecran.attribution.confirme') : texte('ecran.attribution.pret')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="!attributionRecue || pret"
        :raison="texte('ecran.attribution.pret_desactive')"
        @agir="pret = true"
      />
    </footer>
  </main>
</template>

<style scoped>
.attribution {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.attribution__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

/* La valeur est dans la fenêtre de lecture : taille réduite pour qu'un libellé
   de rôle tienne dans 96 × 64 sans déborder. */
.attribution__valeur {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-etiquette);
  text-align: center;
}

.attribution__pied {
  margin-block-start: auto;
}
</style>
