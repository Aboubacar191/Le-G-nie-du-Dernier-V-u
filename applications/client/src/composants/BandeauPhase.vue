<script setup lang="ts">
// Zone PUBLIQUE persistante : manche, phase, compte à rebours, état de liaison.
// Unique ancre temporelle de l'application.
//
// Publique PAR CONSTRUCTION (mesure M6) : le contrat d'entrée n'accepte aucune
// donnée secrète. Un bandeau persistant est lisible par le voisin, apparaît
// dans un aperçu d'onglet et peut finir dans une notification système ; il ne
// reçoit donc que des données ouvertes à tous.
//
// Le décompte est dérivé de phase_fin_at CORRIGÉ du décalage d'horloge
// (RG-72, RG-79). Il ne dépend d'aucun aller-retour réseau et reste exact
// quelques secondes hors ligne — mais il ne pilote rien : l'expiration est
// décidée par le serveur.
//
// Échéance inconnue : deux tirets cadratins, jamais un zéro. Un zéro mentirait
// sur le temps restant.

import { computed } from 'vue';

import type { Phase } from '@gdv/partage';

import { calculerDecompte, type Decompte } from '../logique/decompte.ts';
import { texte } from '../logique/contenu.ts';
import type { EtatDecalage } from '../logique/decalage-horloge.ts';
import type { EtatLiaison } from '../transport/client-ws.ts';
import IndicateurConnexion from './IndicateurConnexion.vue';
import MinuteurPhase from './MinuteurPhase.vue';

export type VarianteBandeau = 'partie' | 'dernier_voeu' | 'hors_manche';

interface Props {
  numeroManche: number | null;
  nbManches: number | null;
  phase: Phase | null;
  phaseFinAt: string | null;
  dureePhaseS: number | null;
  decalage: EtatDecalage;
  maintenantMs: number;
  liaison: EtatLiaison;
  variante?: VarianteBandeau;
}

const props = withDefaults(defineProps<Props>(), { variante: 'partie' });

const decompte = computed((): Decompte =>
  calculerDecompte(props.decalage, props.phaseFinAt, props.maintenantMs, props.dureePhaseS),
);

const titreManche = computed((): string => {
  if (props.numeroManche === null || props.nbManches === null) {
    return texte('commun.hors_manche');
  }
  return texte('commun.manche_sur', { numero: props.numeroManche, total: props.nbManches });
});

const nomPhase = computed((): string =>
  props.phase === null ? texte('bandeau_phase.temps_attente') : texte(`phase.${props.phase}`),
);

const libelleMinuteur = computed((): string =>
  decompte.value.secondes === null
    ? texte('bandeau_phase.temps_attente')
    : texte('bandeau_phase.secondes_restantes', { secondes: decompte.value.secondes }),
);

const liaisonRompue = computed(() => props.liaison === 'perdue' || props.liaison === 'refusee');
</script>

<template>
  <header
    class="bandeau"
    :class="[`bandeau--${props.variante}`, { 'bandeau--deconnecte': liaisonRompue }]"
    role="region"
    :aria-label="texte('bandeau_phase.libelle_region')"
  >
    <div class="bandeau__temps">
      <p class="bandeau__manche">
        {{ titreManche }}
      </p>
      <!-- aria-live sur le changement de PHASE seulement : annoncer chaque
           seconde rendrait un lecteur d'écran inutilisable. -->
      <p
        class="bandeau__phase"
        aria-live="polite"
      >
        {{ nomPhase }}
      </p>
    </div>

    <div class="bandeau__minuteur">
      <MinuteurPhase
        :decompte="decompte"
        variante="anneau"
        taille="md"
        :duree-phase-s="props.dureePhaseS"
        :libelle="libelleMinuteur"
      />
      <!-- Renfort NON COLORÉ de l'urgence : un mot, en plus du nombre et de
           la longueur d'arc. -->
      <p
        v-if="decompte.niveau === 'tension' || decompte.niveau === 'critique'"
        class="bandeau__renfort"
      >
        {{ texte('bandeau_phase.depeche_toi') }}
      </p>
      <p
        v-else-if="liaisonRompue"
        class="bandeau__renfort"
      >
        {{ texte('bandeau_phase.non_confirme') }}
      </p>
    </div>

    <IndicateurConnexion :liaison="props.liaison" />
  </header>
</template>

<style scoped>
.bandeau {
  position: sticky;
  top: 0;
  z-index: var(--gdv-zindex-bandeau);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
  min-block-size: var(--gdv-hauteur-bandeau-phase);
  padding-inline: var(--gdv-gouttiere-ecran);
  border-bottom: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  background: var(--gdv-surface-primaire);
  box-shadow: var(--gdv-elevation-surelevee);
  color: var(--gdv-texte-principal);
}

.bandeau--deconnecte {
  background: var(--gdv-surface-secondaire);
}

.bandeau__temps {
  display: flex;
  flex-direction: column;
}

.bandeau__manche {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.bandeau__phase {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
  font-weight: var(--gdv-graisse-moyen);
  line-height: var(--gdv-interligne-titre);
}

.bandeau__minuteur {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bandeau__renfort {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}
</style>
