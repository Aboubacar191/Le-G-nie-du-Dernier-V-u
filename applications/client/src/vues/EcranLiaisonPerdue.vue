<script setup lang="ts">
// ECR-29 — Liaison perdue (US-16). Rassurer SANS MENTIR.
//
// Ce n'est pas un écran plein : c'est une COUCHE NON BLOQUANTE posée sous le
// bandeau de phase. L'écran de jeu reste visible, marqué « peut-être périmé » :
// masquer entièrement l'état priverait le joueur de ce qu'il peut encore suivre
// à voix haute dans la pièce.
//
// Le message nomme la CONSÉQUENCE RÉELLE de la phase en cours :
//  · en DECLARATION_PAIEMENT, le génie inscrira 0 (RG-32) ;
//  · en DV_SIGNATURE, le génie comptera un refus ;
//  · ailleurs, la partie continue sans toi, tu ne perds rien.
//
// Aucun secret n'est réaffiché à la reconnexion sans un nouveau geste de
// maintien (M1). Aucune soumission n'est mise en file (RG-30).
//
// ÉTATS (DESIGN ECR-29)
// chargement   : tentative de reconnexion, barre indéterminée.
// contenu      : couche d'avertissement, conséquence de la phase, recours.
// vide         : non atteignable.
// erreur       : échecs répétés. Aucune promesse de délai, qui serait fausse.
// acces_refuse : non atteignable.

import { computed } from 'vue';

import BoutonAction from '../composants/BoutonAction.vue';
import IndicateurConnexion from '../composants/IndicateurConnexion.vue';
import MinuteurPhase from '../composants/MinuteurPhase.vue';
import { texte } from '../logique/contenu.ts';
import { DECOMPTE_INCONNU } from '../logique/decompte.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

/** Conséquence réelle, par phase. Nommer la conséquence est indispensable. */
const CONSEQUENCES: Readonly<Record<string, string>> = {
  DECLARATION_PAIEMENT: 'connexion.consequence_declaration',
  DV_SIGNATURE: 'connexion.consequence_signature',
};

const cleConsequence = computed(() => {
  const phase = magasin.etat.phase;
  if (phase === null) return 'connexion.consequence_neutre';
  return CONSEQUENCES[phase] ?? 'connexion.consequence_neutre';
});

const reconnexionEnCours = computed(
  () => magasin.etat.liaison === 'connexion' || magasin.etat.liaison === 'authentification',
);
const hote = computed(() => magasin.etat.moi?.est_hote === true);
</script>

<template>
  <aside
    class="liaison"
    role="status"
    aria-live="polite"
  >
    <div class="liaison__rangee">
      <IndicateurConnexion :liaison="magasin.etat.liaison" />
      <p class="liaison__perime">
        {{ texte('connexion.peut_etre_perime') }}
      </p>
    </div>

    <p class="liaison__consequence">
      {{ texte(cleConsequence) }}
    </p>
    <p
      v-if="hote"
      class="liaison__hote"
    >
      {{ texte('connexion.consequence_hote') }}
    </p>

    <MinuteurPhase
      v-if="reconnexionEnCours"
      variante="barre"
      taille="md"
      indeterminee
      :decompte="DECOMPTE_INCONNU"
      :libelle="texte('connexion.reconnexion')"
    />
    <p
      v-else
      class="liaison__echecs"
    >
      {{ texte('connexion.echecs_repetes') }}
    </p>

    <div class="liaison__actions">
      <BoutonAction
        :libelle="texte('connexion.reessayer_maintenant')"
        variante="secondaire"
        taille="md"
        @agir="magasin.reprendre()"
      />
    </div>
  </aside>
</template>

<style scoped>
/* Couche NON BLOQUANTE : elle se place dans le flux, sous le bandeau de phase,
   et ne recouvre jamais le minuteur. */
.liaison {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  margin-inline: var(--gdv-gouttiere-ecran);
  padding: var(--gdv-espacement-16);
  border-inline-start: var(--gdv-trait-epais) solid var(--gdv-statut-avertissement);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
}

.liaison__rangee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-8);
}

.liaison__perime {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.liaison__consequence {
  margin: 0;
  font-size: var(--gdv-role-corps);
  line-height: var(--gdv-interligne-courant);
}

.liaison__hote,
.liaison__echecs {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.liaison__actions {
  display: flex;
  gap: var(--gdv-espacement-12);
}
</style>
