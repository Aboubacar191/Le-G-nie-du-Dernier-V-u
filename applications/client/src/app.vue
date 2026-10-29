<script setup lang="ts">
// Coquille de l'application.
//
// Trois responsabilités, et pas une de plus :
//  1. résoudre l'écran de fond depuis l'état projeté — la PHASE décide, pas une
//     pile de navigation (RG-30) ;
//  2. porter le bandeau de phase, zone publique par construction, et la
//     pastille d'accès au panneau privé de solde ;
//  3. superposer la couche de liaison perdue, qui ne remplace jamais l'écran de
//     jeu : le joueur doit continuer à voir ce qu'il peut suivre à voix haute.
//
// Aucune donnée secrète ne transite par cette coquille : elle ne lit de l'état
// que ce qui est public (phase, échéance, liaison, manche) plus l'indicateur
// booléen d'ouverture du panneau privé.

import { computed, onMounted, ref } from 'vue';

import BandeauPhase from './composants/BandeauPhase.vue';
import BoutonAction from './composants/BoutonAction.vue';
import { utiliserHorlogeAffichage } from './composables/horloge-affichage.ts';
import { texte } from './logique/contenu.ts';
import { ecranPrincipal, type ContexteEcran } from './logique/resolution-ecran.ts';
import { dureePhaseS, etatPartie } from './magasin/etat.ts';
import { utiliserMagasin, utiliserStockage } from './magasin/injection.ts';
import {
  appliquerCote,
  appliquerTheme,
  relireCote,
  relireTheme,
} from './magasin/preferences.ts';
import EcranLiaisonPerdue from './vues/EcranLiaisonPerdue.vue';
import EcranMonOr from './vues/EcranMonOr.vue';
import { ECRANS_PAR_ID } from './vues/index.ts';

const magasin = utiliserMagasin();
const stockage = utiliserStockage();
const maintenant = utiliserHorlogeAffichage();

const panneauOuvert = ref(false);

onMounted(() => {
  const racine = globalThis.document.documentElement;
  appliquerTheme(racine, relireTheme(stockage));
  appliquerCote(racine, relireCote(stockage));
});

const contexte = computed((): ContexteEcran => ({
  acces_refuse: magasin.etat.acces_refuse,
  session_active: magasin.etat.session !== null,
  intention: magasin.intention(),
  etat_partie: etatPartie(magasin.etat),
  phase: magasin.etat.phase,
  est_hote: magasin.etat.moi?.est_hote === true,
  a_declare: magasin.etat.moi?.montant_declare !== null && magasin.etat.moi !== null,
  restitution_en_cours: magasin.etat.restitution_en_cours,
}));

const ecran = computed(() => ECRANS_PAR_ID[ecranPrincipal(contexte.value)]);

/** Le bandeau n'existe qu'une fois la session projetée : rien à ancrer avant. */
const bandeauVisible = computed(() => magasin.etat.session !== null);
const liaisonRompue = computed(() => magasin.etat.liaison === 'perdue');

const varianteBandeau = computed(() => {
  const etat = etatPartie(magasin.etat);
  if (etat === 'DERNIER_VOEU') return 'dernier_voeu' as const;
  if (etat === 'MANCHE_EN_COURS') return 'partie' as const;
  return 'hors_manche' as const;
});

const nbManches = computed((): number | null => {
  const config = magasin.etat.session?.config as { nb_manches?: number } | undefined;
  return config?.nb_manches ?? null;
});
</script>

<template>
  <div class="coquille">
    <BandeauPhase
      v-if="bandeauVisible"
      :numero-manche="magasin.etat.numero_manche"
      :nb-manches="nbManches"
      :phase="magasin.etat.phase"
      :phase-fin-at="magasin.etat.phase_fin_at"
      :duree-phase-s="dureePhaseS(magasin.etat)"
      :decalage="magasin.etat.decalage"
      :maintenant-ms="maintenant"
      :liaison="magasin.etat.liaison"
      :variante="varianteBandeau"
    />

    <!-- Couche NON BLOQUANTE : l'écran de jeu reste dessous. -->
    <EcranLiaisonPerdue v-if="liaisonRompue" />

    <!-- Pastille d'accès au panneau privé, dans le coin atteignable au pouce.
         Elle ne porte AUCUN chiffre : le solde est secret (M6). -->
    <div
      v-if="bandeauVisible"
      class="coquille__pastille"
    >
      <BoutonAction
        :libelle="texte('solde.pastille')"
        variante="secondaire"
        taille="md"
        @agir="panneauOuvert = true"
      />
    </div>

    <component
      :is="ecran"
      class="coquille__ecran"
    />

    <EcranMonOr
      v-if="panneauOuvert"
      @fermer="panneauOuvert = false"
    />
  </div>
</template>

<style scoped>
.coquille {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  min-block-size: 100vh;
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
}

.coquille__ecran {
  flex: 1 1 auto;
}

.coquille__pastille {
  display: flex;
  justify-content: flex-end;
  padding-inline: var(--gdv-gouttiere-ecran);
}

/* Côté dominant inversé pour les gauchers : la pastille passe à gauche, du
   côté que la main qui tient l'appareil atteint sans se repositionner. */
:global([data-cote-dominant='gauche']) .coquille__pastille {
  justify-content: flex-start;
}
</style>
