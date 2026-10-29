<script setup lang="ts">
// Classement final et révélation générale — RG-55 à RG-58.
//
// C'est le SEUL écran où tous les secrets sortent, donc le seul où AUCUN voile
// n'est appliqué. Le dévoilement se fait section par section, à la demande, un
// contact par section, pour que la table commente au rythme de la conversation
// plutôt que de tout lire en silence. Chaque section est déjà chargée : le
// dévoilement est purement local, sans aller-retour.
//
// DEUX exclusions permanentes subsistent malgré RG-58, et la matrice_visibilite
// prime (CONF-04) : l'identité du porteur de la clause et l'existence des
// enquêtes ne figurent nulle part ici.
//
// Aucun score partiel n'est affiché en cas d'échec : un classement faux serait
// pire qu'un classement absent.

import { computed, ref } from 'vue';

import type { LigneClassement, PaiementHistorique } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import BandeauAlerte from './BandeauAlerte.vue';
import EtatVide from './EtatVide.vue';
import JetonMontant from './JetonMontant.vue';
import SqueletteChargement from './SqueletteChargement.vue';

interface Props {
  classement: readonly LigneClassement[];
  vainqueurs: readonly string[];
  paiementsHistoriques: readonly PaiementHistorique[];
  genieLibere?: boolean;
  victoireParLiberation?: boolean;
  modeAvance?: boolean;
  chargement?: boolean;
  erreur?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  genieLibere: false,
  victoireParLiberation: false,
  modeAvance: false,
  chargement: false,
  erreur: false,
});

const emettre = defineEmits<{ reessayer: []; rejouer: [] }>();

const devoile = ref({ roles: false, missions: false, paiements: false, signataires: false });

const LIGNES_SQUELETTE = 8;

const estVainqueur = (ligne: LigneClassement): boolean => props.vainqueurs.includes(ligne.joueur_id);

/** RG-57 : deux lignes de même rang portent le MÊME rang affiché. */
const exAequo = (ligne: LigneClassement): boolean =>
  props.classement.filter((autre) => autre.rang === ligne.rang).length > 1;

const paiementsDe = (joueurId: string): readonly PaiementHistorique[] =>
  props.paiementsHistoriques.filter((paiement) => paiement.joueur_id === joueurId);

const vainqueurParLiberation = computed((): LigneClassement | null => {
  if (!props.victoireParLiberation) return null;
  return props.classement.find((ligne) => estVainqueur(ligne)) ?? null;
});
</script>

<template>
  <div class="scores">
    <SqueletteChargement
      v-if="props.chargement"
      :lignes="LIGNES_SQUELETTE"
      hauteur="var(--gdv-hauteur-ligne-tableau)"
      :libelle="texte('commun.chargement')"
    />

    <BandeauAlerte
      v-else-if="props.erreur"
      variante="erreur"
      cle-contenu="scores.erreur"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="emettre('reessayer')"
    />

    <EtatVide
      v-else-if="props.classement.length === 0"
      :titre="texte('scores.aucune_trace')"
      :action-libelle="texte('scores.rejouer')"
      @agir="emettre('rejouer')"
    />

    <template v-else>
      <!-- RG-56 : le classement par points reste affiché dessous, marqué
           « à titre informatif ». Le cacher priverait la table de sa
           conversation de fin de partie. -->
      <BandeauAlerte
        v-if="vainqueurParLiberation !== null"
        variante="information"
        cle-contenu="scores.genie_libere"
        :valeurs="{ pseudo: vainqueurParLiberation.pseudo }"
      />
      <p
        v-if="vainqueurParLiberation !== null"
        class="scores__informatif"
      >
        {{ texte('scores.classement_informatif') }}
      </p>

      <div class="scores__devoilement">
        <button
          type="button"
          class="scores__section"
          :aria-pressed="devoile.roles"
          @click="devoile.roles = !devoile.roles"
        >
          {{ texte('scores.devoiler_roles') }}
        </button>
        <button
          type="button"
          class="scores__section"
          :aria-pressed="devoile.missions"
          @click="devoile.missions = !devoile.missions"
        >
          {{ texte('scores.devoiler_missions') }}
        </button>
        <button
          type="button"
          class="scores__section"
          :aria-pressed="devoile.paiements"
          @click="devoile.paiements = !devoile.paiements"
        >
          {{ texte('scores.devoiler_paiements') }}
        </button>
        <button
          v-if="props.modeAvance"
          type="button"
          class="scores__section"
          :aria-pressed="devoile.signataires"
          @click="devoile.signataires = !devoile.signataires"
        >
          {{ texte('scores.devoiler_signataires') }}
        </button>
      </div>

      <table class="scores__table">
        <caption class="scores__legende">
          {{ texte('scores.titre') }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ texte('scores.rang') }}
            </th>
            <th scope="col">
              {{ texte('cercle.titre') }}
            </th>
            <th
              scope="col"
              class="scores__nombre"
            >
              {{ texte('scores.score') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="ligne in props.classement"
            :key="ligne.joueur_id"
          >
            <tr :class="{ 'scores__ligne--vainqueur': estVainqueur(ligne) }">
              <td class="scores__nombre">
                {{ ligne.rang }}
                <span
                  v-if="exAequo(ligne)"
                  class="scores__badge"
                >{{ texte('scores.ex_aequo') }}</span>
              </td>
              <th
                scope="row"
                class="scores__pseudo"
              >
                {{ ligne.pseudo }}
                <span
                  v-if="estVainqueur(ligne)"
                  class="scores__badge"
                >{{ texte('scores.vainqueur') }}</span>
              </th>
              <td class="scores__nombre">
                <JetonMontant
                  :valeur="ligne.score_final"
                  :etiquette="texte('scores.score')"
                />
              </td>
            </tr>
            <tr v-if="devoile.roles || devoile.missions || devoile.paiements || devoile.signataires">
              <td
                colspan="3"
                class="scores__detail"
              >
                <p v-if="devoile.roles">
                  {{ texte('scores.pieces_restantes') }} : {{ ligne.pieces_restantes }} ·
                  {{ texte(`role.${ligne.role_secret}`) }}
                </p>
                <p v-if="devoile.missions">
                  {{ ligne.mission_secrete === null ? texte('commun.valeur_indisponible') : texte(`mission.${ligne.mission_secrete}`) }}
                  ·
                  {{ ligne.mission_reussie ? texte('scores.mission_reussie') : texte('scores.mission_echouee') }}
                </p>
                <p v-if="devoile.paiements">
                  {{ texte('scores.paiements_par_manche') }} :
                  <span
                    v-for="paiement in paiementsDe(ligne.joueur_id)"
                    :key="paiement.numero_manche"
                    class="scores__paiement"
                  >{{ paiement.montant_declare }}/{{ paiement.montant_paye }}</span>
                </p>
                <p v-if="devoile.signataires && props.modeAvance">
                  {{ ligne.a_signe_dernier_voeu === true ? texte('scores.a_signe') : texte('scores.n_a_pas_signe') }}
                </p>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.scores {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  inline-size: 100%;
}

.scores__informatif {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.scores__devoilement {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gdv-espacement-8);
}

.scores__section {
  min-block-size: var(--gdv-hauteur-bouton-md);
  padding-inline: var(--gdv-espacement-16);
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-accent-action);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-etiquette);
  cursor: pointer;
}

.scores__section[aria-pressed='true'] {
  background: var(--gdv-surface-secondaire);
}

.scores__section:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.scores__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
}

.scores__legende {
  padding-block-end: var(--gdv-espacement-8);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  text-align: start;
}

.scores__table th,
.scores__table td {
  min-block-size: var(--gdv-hauteur-ligne-tableau);
  padding: var(--gdv-espacement-8);
  text-align: start;
  font-weight: var(--gdv-graisse-normal);
}

.scores__table tbody tr:nth-child(odd) {
  background: var(--gdv-surface-primaire);
}

.scores__table tbody tr:nth-child(even) {
  background: var(--gdv-surface-secondaire);
}

/* Une SEULE ligne est distinguée, celle du vainqueur (Von Restorff). */
.scores__ligne--vainqueur {
  border-inline-start: var(--gdv-trait-epais) solid var(--gdv-statut-succes);
  background: var(--gdv-surface-secondaire);
}

.scores__nombre {
  text-align: end;
  font-family: var(--gdv-famille-chiffres);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

.scores__pseudo {
  color: var(--gdv-texte-principal);
}

.scores__badge {
  margin-inline-start: var(--gdv-espacement-8);
  padding-inline: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-primaire);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-gras);
}

.scores__detail {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.scores__detail p {
  margin: 0;
}

.scores__paiement {
  margin-inline-start: var(--gdv-espacement-8);
  font-family: var(--gdv-famille-chiffres);
  font-variant-numeric: var(--gdv-chiffres-variant);
}
</style>
