<script setup lang="ts">
// ECR-26 — Dernier Vœu, résolution (RG-53, RG-54, CA-37, CA-38).
//
// Publier le NOMBRE de signataires et la conséquence appliquée, SANS nommer
// personne. Les identités ne sortent qu'à l'écran des scores.
//
// Écran délicat : à un signataire, annoncer que le génie est libéré ET que le
// Marchand déjà lié gagne revient à dire qu'un tel joueur existe — ce qui est
// une règle PUBLIQUE du mode avancé, pas un secret. Son IDENTITÉ, elle, n'est
// publiée qu'à l'écran suivant. L'interface ne nomme donc personne ici.
//
// ÉTATS (DESIGN ECR-26)
// chargement   : bulle en chargement, « Le génie compte les signatures ».
// contenu      : nombre de signataires en grand, conséquence en une phrase,
//                bouton vers les scores.
// vide         : le cas « zéro signataire » n'est PAS un état vide mais un
//                contenu à part entière : « Personne n'a signé. »
// erreur       : résolution non reçue. Aucune résolution n'est devinée
//                localement.
// acces_refuse : mode avancé inactif — non atteignable.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import JetonMontant from '../composants/JetonMontant.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ voirScores: [] }>();

const magasin = utiliserMagasin();

const resolution = computed(() => magasin.etat.dernier_voeu_resolu);
const etatBulle = computed(() => (resolution.value === null ? 'chargement' : 'repos'));

/** Une phrase par cas, sans nommer personne. */
const phrase = computed((): string => {
  const recue = resolution.value;
  if (recue === null) return '';
  if (recue.nb_signataires === 0) return texte('ecran.dernier_voeu.resolution_0');
  if (recue.nb_signataires === 1) {
    return `${texte('ecran.dernier_voeu.resolution_1')} ${texte('ecran.dernier_voeu.resolution_1_suite')}`;
  }
  return texte('ecran.dernier_voeu.resolution_n', { n: recue.nb_signataires });
});
</script>

<template>
  <section class="dv-resolution">
    <BulleGenie
      variante="verdict"
      :etat="etatBulle"
      :phrase="phrase"
    />

    <p
      v-if="resolution !== null"
      class="dv-resolution__compte"
    >
      <span class="dv-resolution__etiquette">
        {{ texte('ecran.dernier_voeu.nb_signataires') }}
      </span>
      <JetonMontant
        :valeur="resolution.nb_signataires"
        :etiquette="texte('ecran.dernier_voeu.nb_signataires')"
      />
    </p>

    <BoutonAction
      :libelle="texte('ecran.dernier_voeu.voir_scores')"
      variante="principal"
      taille="lg"
      pleine-largeur
      :desactive="resolution === null"
      :raison="texte('genie.compte_signatures')"
      @agir="emettre('voirScores')"
    />
  </section>
</template>

<style scoped>
.dv-resolution {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.dv-resolution__compte {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-4);
  margin: 0;
}

.dv-resolution__etiquette {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}
</style>
