<script setup lang="ts">
// Solde et journal des mouvements du joueur — US-13, RG-42. Données
// STRICTEMENT privées (ADR-CP-05).
//
// Découpe volontaire : le MOTIF de chaque mouvement est affiché EN CLAIR (il ne
// chiffre rien : « Part de récompense », « Amende payée », « Coût d'enquête »),
// le DELTA est sous voile. Le joueur relit la nature de ses mouvements d'un
// coup d'œil sans exposer un seul chiffre ; révéler les montants demande un
// maintien.
//
// Une zone de maintien UNIQUE révèle tous les deltas pendant le maintien, pour
// la lecture rapide avant une négociation.
//
// L'historique d'enquêtes est entièrement sous voile (M8) : l'enquêteur
// lui-même ne doit pas l'exposer d'un regard.

import { computed } from 'vue';

import type { MoiPrive, PageMouvements, PretVuPartie, ResultatEnqueteItem } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import EtatVide from './EtatVide.vue';
import SqueletteChargement from './SqueletteChargement.vue';
import VoileSecret from './VoileSecret.vue';

interface Props {
  moi: MoiPrive | null;
  mouvements: PageMouvements | null;
  prets: readonly PretVuPartie[];
  enquetes: readonly ResultatEnqueteItem[];
  /** Pseudonyme d'un joueur, pour nommer une cible d'enquête. */
  pseudoDe: (joueurId: string) => string;
  chargement?: boolean;
  erreur?: boolean;
  /** Solde connu localement mais peut-être périmé (état erreur). */
  perime?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  chargement: false,
  erreur: false,
  perime: false,
});

const emettre = defineEmits<{ fermer: []; reessayer: [] }>();

const LIGNES_SQUELETTE = 5;

const mouvements = computed(() => props.mouvements?.elements ?? []);
const pretsDus = computed(() => props.prets.filter((pret) => pret.statut === 'ACTIF'));
/** Au-delà de la seule dotation initiale, le journal a-t-il bougé ? */
const journalVide = computed(() => mouvements.value.length <= 1);
</script>

<template>
  <div class="panneau">
    <SqueletteChargement
      v-if="props.chargement"
      :lignes="LIGNES_SQUELETTE"
      hauteur="var(--gdv-hauteur-ligne-tableau)"
      :libelle="texte('commun.chargement')"
    />

    <template v-else>
      <!-- Solde : sous voile, en fenêtre de lecture. Jamais en clair. -->
      <VoileSecret
        variante="lecture"
        :intitule="texte('solde.titre')"
        :etat-impose="props.erreur ? 'erreur' : null"
      >
        <template #secret>
          {{ props.moi?.solde_pieces ?? texte('commun.valeur_indisponible') }}
        </template>
        <template #reprise>
          <p
            v-if="props.perime"
            class="panneau__perime"
          >
            {{ texte('connexion.peut_etre_perime') }}
          </p>
        </template>
      </VoileSecret>

      <!-- Rôle et mission, relisibles sous voile (ECR-28). -->
      <VoileSecret
        variante="lecture"
        :intitule="texte('solde.relire_role')"
      >
        <template #secret>
          <span class="panneau__attribution">
            {{ props.moi?.role_secret ? texte(`role.${props.moi.role_secret}`) : texte('commun.valeur_indisponible') }}
            ·
            {{ props.moi?.mission_secrete ? texte(`mission.${props.moi.mission_secrete}`) : texte('commun.valeur_indisponible') }}
          </span>
        </template>
      </VoileSecret>

      <section class="panneau__section">
        <h3 class="panneau__titre">
          {{ texte('solde.mouvements') }}
        </h3>

        <EtatVide
          v-if="journalVide"
          :titre="texte('solde.aucun_mouvement')"
          :action-libelle="texte('solde.sortie_vide')"
          @agir="emettre('fermer')"
        />

        <!-- Une zone de maintien unique pour TOUS les deltas. Les motifs, eux,
             restent en clair : ils ne chiffrent rien. -->
        <VoileSecret
          v-else
          variante="lecture"
          :intitule="texte('solde.reveler_tout')"
        >
          <template #secret>
            <ul class="panneau__deltas">
              <li
                v-for="mouvement in mouvements"
                :key="mouvement.sequence"
                class="panneau__delta"
              >
                {{ mouvement.delta > 0 ? '+' : '−' }}{{ Math.abs(mouvement.delta) }}
              </li>
            </ul>
          </template>
        </VoileSecret>

        <ul class="panneau__motifs">
          <li
            v-for="mouvement in mouvements"
            :key="mouvement.sequence"
            class="panneau__motif"
          >
            <span>{{ texte(`motif_mouvement.${mouvement.motif}`) }}</span>
            <span class="panneau__manche">
              {{ mouvement.manche_numero === null ? '' : texte('cercle.siege', { numero: mouvement.manche_numero }) }}
            </span>
          </li>
        </ul>
      </section>

      <section
        v-if="pretsDus.length > 0"
        class="panneau__section"
      >
        <h3 class="panneau__titre">
          {{ texte('solde.pret_du') }}
        </h3>
        <VoileSecret
          variante="lecture"
          :intitule="texte('solde.pret_du')"
        >
          <template #secret>
            <ul class="panneau__deltas">
              <li
                v-for="pret in pretsDus"
                :key="pret.pret_id"
                class="panneau__delta"
              >
                {{ pret.du_total - pret.rembourse }}
              </li>
            </ul>
          </template>
        </VoileSecret>
      </section>

      <section class="panneau__section">
        <h3 class="panneau__titre">
          {{ texte('solde.mes_enquetes') }}
        </h3>
        <EtatVide
          v-if="props.enquetes.length === 0"
          :titre="texte('solde.aucune_enquete')"
          :action-libelle="texte('solde.sortie_aucune_enquete')"
          @agir="emettre('fermer')"
        />
        <!-- M8 : entièrement sous voile, cible comprise. -->
        <VoileSecret
          v-else
          variante="lecture"
          :intitule="texte('solde.mes_enquetes')"
        >
          <template #secret>
            <ul class="panneau__deltas">
              <li
                v-for="enquete in props.enquetes"
                :key="`${enquete.cible_joueur_id}-${enquete.manche_numero}`"
                class="panneau__delta panneau__delta--texte"
              >
                {{ props.pseudoDe(enquete.cible_joueur_id) }} · {{ enquete.montant_paye }}
              </li>
            </ul>
          </template>
        </VoileSecret>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panneau {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  inline-size: 100%;
}

.panneau__section {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.panneau__titre {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-moyen);
}

.panneau__motifs,
.panneau__deltas {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.panneau__motif {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-8);
  min-block-size: var(--gdv-hauteur-ligne-tableau);
  padding-inline: var(--gdv-espacement-8);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-principal);
  font-size: var(--gdv-role-corps);
}

.panneau__manche {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.panneau__delta {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-corps);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

.panneau__delta--texte {
  font-size: var(--gdv-role-meta);
}

.panneau__attribution {
  font-size: var(--gdv-role-etiquette);
  text-align: center;
}

.panneau__perime {
  margin: 0;
  font-size: var(--gdv-role-meta);
}
</style>
