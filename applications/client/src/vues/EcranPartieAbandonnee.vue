<script setup lang="ts">
// ECR-31 — Partie abandonnée (RG-59, RG-76, CA-48). Terminal.
//
// POINT IMPORTANT : la tentation serait de tout révéler puisque la partie est
// finie. RG-58 réserve la révélation à l'écran des SCORES, atteint depuis
// l'état SCORES et non ABANDONNEE. Révéler sur abandon donnerait à l'hôte un
// moyen unilatéral de FORCER la divulgation des secrets de toute la table, au
// moment qui l'arrange. L'interface ne révèle donc rien : ni rôles, ni
// missions, ni paiements, ni signatures.
//
// Le message mentionne explicitement que la partie NE COMPTE PAS dans le total
// du groupe (RG-59) : c'est ce qui empêche de débloquer le mode avancé en
// abandonnant des parties en série.
//
// ÉTATS (DESIGN ECR-31)
// chargement   : non applicable — l'état est terminal et poussé par le serveur.
// contenu      : message de cause, mention du compteur non incrémenté, sorties.
// vide         : non atteignable.
// erreur       : cause inconnue — « Le génie n'a pas dit pourquoi ». Une cause
//                inventée serait pire qu'une cause absente.
// acces_refuse : non atteignable — cet écran EST la fin du droit d'accès.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const CAUSES: Readonly<Record<string, string>> = {
  ABANDON_HOTE: 'ecran.abandon.cause_hote',
  INACTIVITE_DEPASSEE: 'ecran.abandon.cause_inactivite',
};

const hote = computed(() => magasin.etat.moi?.est_hote === true);

const cause = computed((): string => {
  const motif = magasin.etat.abandon?.motif;
  if (motif === undefined) return texte('ecran.abandon.cause_inconnue');
  return texte(CAUSES[motif] ?? 'ecran.abandon.cause_inconnue');
});
</script>

<template>
  <main class="abandon">
    <h1 class="abandon__titre">
      {{ texte('ecran.abandon.titre') }}
    </h1>

    <BulleGenie
      variante="verdict"
      :phrase="texte('ecran.abandon.message', { cause })"
    />

    <footer class="abandon__pied">
      <BoutonAction
        :libelle="texte('commun.retour_accueil')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="magasin.quitter()"
      />
      <BoutonAction
        v-if="hote"
        :libelle="texte('ecran.abandon.creer_nouvelle')"
        variante="secondaire"
        taille="md"
        @agir="magasin.naviguer('creation')"
      />
    </footer>
  </main>
</template>

<style scoped>
.abandon {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  min-block-size: 100vh;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.abandon__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.abandon__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}
</style>
