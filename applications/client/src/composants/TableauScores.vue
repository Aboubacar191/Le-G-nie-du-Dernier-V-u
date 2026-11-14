<script setup lang="ts">
// Classement final et révélation générale — RG-55 à RG-58.
//
// C'est le SEUL écran où tous les secrets sortent, donc le seul où AUCUN voile
// n'est appliqué. Fidélité à la maquette (reference-prototype, écran « Fin de
// partie ») : rôle, mission, paiements et signataires sont visibles D'EMBLÉE,
// sans contact supplémentaire — c'est justement l'écran où plus rien ne se
// cache.
//
// DEUX exclusions permanentes subsistent malgré RG-58, et la matrice_visibilite
// prime (CONF-04) : l'identité du porteur de la clause et l'existence des
// enquêtes ne figurent nulle part ici.
//
// Aucun score partiel n'est affiché en cas d'échec : un classement faux serait
// pire qu'un classement absent.

import { computed } from 'vue';

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
  /** Résumé global (RG-58/RG-75 : rien ici qu'un comptage déjà public ailleurs). */
  nbManchesCloses?: number;
  nbVoeuxExauces?: number;
  nbMensongesDemasques?: number;
  chargement?: boolean;
  erreur?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  genieLibere: false,
  victoireParLiberation: false,
  modeAvance: false,
  nbManchesCloses: 0,
  nbVoeuxExauces: 0,
  nbMensongesDemasques: 0,
  chargement: false,
  erreur: false,
});

const emettre = defineEmits<{ reessayer: []; rejouer: [] }>();

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

      <!-- Résumé global (fidélité maquette, écran « Fin de partie ») : deux
           comptages PUBLICS, jamais un total de mensonges non démasqués
           (RG-75 — ce total n'existe nulle part, pas même ici). -->
      <p
        v-if="props.nbManchesCloses > 0"
        class="scores__resume"
      >
        {{ texte('scores.resume_voeux', { exauces: props.nbVoeuxExauces, total: props.nbManchesCloses }) }}
        {{ texte('scores.resume_mensonges', { nombre: props.nbMensongesDemasques }) }}
      </p>

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
            <tr>
              <td
                colspan="3"
                class="scores__detail"
              >
                <p>
                  {{ texte('scores.pieces_restantes') }} : {{ ligne.pieces_restantes }} ·
                  {{ texte(`role.${ligne.role_secret}`) }}
                </p>
                <p>
                  {{ ligne.mission_secrete === null ? texte('commun.valeur_indisponible') : texte(`mission.${ligne.mission_secrete}`) }}
                  ·
                  {{ ligne.mission_reussie ? texte('scores.mission_reussie') : texte('scores.mission_echouee') }}
                </p>
                <p>
                  {{ texte('scores.paiements_par_manche') }} :
                  <span
                    v-for="paiement in paiementsDe(ligne.joueur_id)"
                    :key="paiement.numero_manche"
                    class="scores__paiement"
                  >{{ paiement.montant_declare }}/{{ paiement.montant_paye }}</span>
                </p>
                <p v-if="props.modeAvance">
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

.scores__resume {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
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
