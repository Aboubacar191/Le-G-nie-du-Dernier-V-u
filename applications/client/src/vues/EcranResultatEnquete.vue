<script setup lang="ts">
// ECR-20 — Résultat privé d'enquête (US-09, CA-19).
//
// Livrer à l'enquêteur SEUL le montant réellement payé par la cible, puis le
// laisser accuser, se taire ou faire chanter.
//
// Rien n'est public ici. Absolument rien : ni le montant, ni l'existence de
// l'enquête, ni l'identité de la cible, ni le coût payé.
//
// L'application ne calcule PAS l'ampleur du mensonge. Le montant déclaré, déjà
// public, est rappelé à côté pour que la comparaison soit immédiate sans calcul
// mental, mais la DIFFÉRENCE n'est pas affichée : afficher « il a menti de 3 »
// ferait de l'application un analyste, et ce n'est pas son rôle.
//
// Conteneur : VoileSecret dans une FeuilleModale. Jamais un bandeau (M6).
//
// ÉTATS (DESIGN ECR-20)
// chargement   : voile en chargement, « Le génie consulte ses comptes ». Le
//                coût est déjà prélevé côté serveur : le libellé est explicite
//                pour que l'attente ne laisse pas croire à un échec.
// contenu      : sous maintien, le montant versé et le montant promis à côté.
// vide         : NON atteignable — une enquête aboutie renvoie toujours un
//                montant, 0 compris. Un 0 est un contenu, pas un vide.
// erreur       : résultat non reçu alors que le coût a été prélevé. Le message
//                dit l'idempotence (RG-70) pour que le joueur ne renonce pas.
// acces_refuse : non atteignable — aucun identifiant d'enquête n'est exposé en
//                dehors de son propriétaire.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import FeuilleModale from '../composants/FeuilleModale.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ fermer: []; accuser: [cible: string] }>();

const magasin = utiliserMagasin();

/** Le dernier résultat reçu : celui que le joueur vient d'acheter. */
const resultat = computed(
  () => magasin.etat.resultats_enquete[magasin.etat.resultats_enquete.length - 1] ?? null,
);

const etatVoile = computed(() => (resultat.value === null ? 'chargement' : null));
</script>

<template>
  <FeuilleModale
    :titre="texte('ecran.resultat_enquete.titre')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.resultat_enquete.titre')"
      :etat-impose="etatVoile"
    >
      <template #secret>
        <span
          v-if="resultat !== null"
          class="resultat__contenu"
        >
          {{ texte('ecran.resultat_enquete.resultat', {
            cible: pseudoDe(magasin.etat, resultat.cible_joueur_id),
            montant_paye: resultat.montant_paye,
          }) }}
          {{ texte('ecran.resultat_enquete.rappel_declare', {
            montant_declare: resultat.montant_declare,
          }) }}
        </span>
      </template>
    </VoileSecret>

    <p class="resultat__suite">
      {{ texte('ecran.resultat_enquete.suite') }}
    </p>

    <BoutonAction
      v-if="resultat !== null"
      :libelle="texte('ecran.resultat_enquete.accuser_cible', {
        cible: pseudoDe(magasin.etat, resultat.cible_joueur_id),
      })"
      variante="destructeur"
      taille="lg"
      pleine-largeur
      @agir="emettre('accuser', resultat.cible_joueur_id)"
    />
    <BoutonAction
      :libelle="texte('commun.fermer')"
      variante="secondaire"
      taille="md"
      pleine-largeur
      @agir="emettre('fermer')"
    />
  </FeuilleModale>
</template>

<style scoped>
.resultat__contenu {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-meta);
  text-align: center;
}

.resultat__suite {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}
</style>
