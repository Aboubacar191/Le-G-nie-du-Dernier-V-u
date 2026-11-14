<script setup lang="ts">
// Tableau PUBLIC des promesses de la manche : le matériau de la négociation
// orale. La densité est assumée ici, parce qu'il est consulté en 20 secondes
// pendant que la table parle.
//
// N'accepte que des données publiques. Aucun montant payé, aucun solde : les
// entrées de ce composant sont le pseudo, le montant déclaré et le verdict.
//
// Les montants sont alignés à DROITE en chiffres tabulaires : c'est
// l'alignement qui permet de comparer les ordres de grandeur d'un coup d'œil.
// Une ligne sans déclaration affiche « Silencieux » et JAMAIS un zéro — un zéro
// affirmerait une déclaration qui n'existe pas encore.

import { computed, ref } from 'vue';

import type { JoueurPublic } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import BandeauAlerte from './BandeauAlerte.vue';
import EtatVide from './EtatVide.vue';
import JetonMontant from './JetonMontant.vue';
import SqueletteChargement from './SqueletteChargement.vue';

interface Props {
  joueurs: readonly JoueurPublic[];
  /** Ordre du cercle depuis soi : cohérent avec CercleDesPlaces. */
  ordre: readonly string[];
  declarations: Readonly<Record<string, number>>;
  verdicts?: Readonly<Record<string, 'MENTEUR' | 'HONNETE'>>;
  chargement?: boolean;
  erreur?: boolean;
  /** Lecture seule hors phase : le tri reste, il n'est plus modifiable. */
  desactive?: boolean;
  actionVideLibelle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  verdicts: () => ({}),
  chargement: false,
  erreur: false,
  desactive: false,
  actionVideLibelle: '',
});

const emettre = defineEmits<{ reessayer: []; agirSurVide: [] }>();

const parMontant = ref(false);

interface Ligne {
  readonly joueur_id: string;
  readonly pseudo: string;
  readonly montant: number | null;
  readonly verdict: 'MENTEUR' | 'HONNETE' | null;
  readonly offrandeScellee: boolean;
}

const lignes = computed((): readonly Ligne[] => {
  const base = props.ordre.length > 0 ? props.ordre : props.joueurs.map((j) => j.joueur_id);
  const construites = base.map((joueurId): Ligne => ({
    joueur_id: joueurId,
    pseudo: props.joueurs.find((j) => j.joueur_id === joueurId)?.pseudo ?? joueurId,
    montant: props.declarations[joueurId] ?? null,
    verdict: props.verdicts[joueurId] ?? null,
    offrandeScellee: props.joueurs.find((j) => j.joueur_id === joueurId)?.offrande_scellee ?? false,
  }));
  if (!parMontant.value) return construites;
  return [...construites].sort((a, b) => (b.montant ?? -1) - (a.montant ?? -1));
});

/** Total promis. Valeur publique (RG-07, étape 1 du pipeline). */
const total = computed((): number =>
  lignes.value.reduce((somme, ligne) => somme + (ligne.montant ?? 0), 0),
);

const aucuneDeclaration = computed(() => Object.keys(props.declarations).length === 0);
</script>

<template>
  <div class="declarations">
    <SqueletteChargement
      v-if="props.chargement"
      :lignes="props.joueurs.length || 5"
      hauteur="var(--gdv-hauteur-ligne-tableau)"
      :libelle="texte('commun.chargement')"
    />

    <!-- Un échec de chargement n'est JAMAIS rendu comme un état vide : les
         déclarations déjà reçues restent affichées sous le bandeau. -->
    <template v-else>
      <BandeauAlerte
        v-if="props.erreur"
        variante="erreur"
        cle-contenu="ecran.declaration.aucune_declaration"
        :action-libelle="texte('commun.reessayer')"
        @reprendre="emettre('reessayer')"
      />

      <EtatVide
        v-if="aucuneDeclaration"
        :titre="texte('ecran.declaration.aucune_declaration')"
        :action-libelle="props.actionVideLibelle"
        @agir="emettre('agirSurVide')"
      />

      <!-- Exception UNIQUE et nommée au principe zéro-scroll (conseil LLM,
           2026-11-14) : seule cette liste, de cardinalité VARIABLE (5 à 8
           joueurs), défile en interne (tbody seul, en-tête et total fixes).
           Le reste de l'écran — minuteur, montants, fenêtre de secret —
           garde une taille fixe et n'hérite jamais ce défilement
           (DESIGN-GDV-001 v1.2.0, composant.hauteur.liste_defilante_visible).
           UNE SEULE table : trois tables séparées désaligneraient les
           colonnes, chacune calculant ses largeurs indépendamment. -->
      <table
        v-else
        class="declarations__table declarations__table--defilante"
      >
        <caption class="declarations__legende">
          {{ texte('commun.promis') }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <button
                v-if="!props.desactive"
                type="button"
                class="declarations__tri"
                :aria-pressed="!parMontant"
                @click="parMontant = false"
              >
                {{ texte('cercle.titre') }}
              </button>
              <span v-else>{{ texte('cercle.titre') }}</span>
            </th>
            <th
              scope="col"
              class="declarations__colonne-nombre"
            >
              <button
                v-if="!props.desactive"
                type="button"
                class="declarations__tri"
                :aria-pressed="parMontant"
                @click="parMontant = true"
              >
                {{ texte('commun.promis') }}
              </button>
              <span v-else>{{ texte('commun.promis') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ligne in lignes"
            :key="ligne.joueur_id"
          >
            <th
              scope="row"
              class="declarations__pseudo"
            >
              {{ ligne.pseudo }}
              <span
                v-if="ligne.verdict !== null"
                class="declarations__verdict"
              >{{ texte(`verdict.${ligne.verdict}`) }}</span>
              <!-- Fidélité maquette (« Offrande scellée ») : statut SANS montant,
                   seulement pendant la phase en cours (CONF-12 annulée). -->
              <span
                v-else-if="!props.desactive"
                class="declarations__statut"
                :class="{ 'declarations__statut--scelle': ligne.offrandeScellee }"
              >{{ texte(ligne.offrandeScellee ? 'carte_joueur.offrande_scellee' : 'carte_joueur.offrande_reflechit') }}</span>
            </th>
            <td class="declarations__colonne-nombre">
              <JetonMontant
                v-if="ligne.montant !== null"
                :valeur="ligne.montant"
                :etiquette="texte('commun.promis')"
              />
              <span
                v-else
                class="declarations__silencieux"
              >{{ texte('carte_joueur.silencieux') }}</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="declarations__total">
            <th scope="row">
              {{ texte('commun.total_promis') }}
            </th>
            <td class="declarations__colonne-nombre">
              <JetonMontant
                :valeur="total"
                :etiquette="texte('commun.total_promis')"
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </template>
  </div>
</template>

<style scoped>
.declarations {
  inline-size: 100%;
}

.declarations__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
}

.declarations__legende {
  padding-block-end: var(--gdv-espacement-8);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
  text-align: start;
}

.declarations__table th,
.declarations__table td {
  min-block-size: var(--gdv-hauteur-ligne-tableau);
  padding: var(--gdv-espacement-8);
  text-align: start;
  font-weight: var(--gdv-graisse-normal);
}

/* Seul le corps défile : l'en-tête et le total restent toujours visibles.
   display:table sur chaque groupe (plutôt que sur la table entière) pour que
   le navigateur recalcule un tableau valide à chacun, et table-layout:fixed
   + largeurs en pourcentage pour que les deux groupes s'accordent sur les
   MÊMES colonnes — sans quoi chacun les calculerait indépendamment selon
   son propre contenu et les chiffres ne s'aligneraient plus sous le titre. */
.declarations__table--defilante {
  display: block;
}

.declarations__table--defilante thead,
.declarations__table--defilante tfoot {
  display: table;
  inline-size: 100%;
  table-layout: fixed;
}

.declarations__table--defilante tbody {
  display: block;
  max-block-size: var(--gdv-hauteur-liste-defilante-visible);
  overflow-y: auto;
}

.declarations__table--defilante tbody tr {
  display: table;
  inline-size: 100%;
  table-layout: fixed;
}

.declarations__table--defilante :is(thead, tbody) tr > :first-child {
  inline-size: 65%;
}

.declarations__table--defilante :is(thead, tbody) tr > :last-child {
  inline-size: 35%;
}

/* Regroupement par SURFACE, sans trait de séparation décoratif. */
.declarations__table tbody tr:nth-child(odd) {
  background: var(--gdv-surface-primaire);
}

.declarations__table tbody tr:nth-child(even) {
  background: var(--gdv-surface-secondaire);
}

.declarations__colonne-nombre {
  text-align: end;
}

.declarations__pseudo {
  color: var(--gdv-texte-principal);
}

.declarations__verdict {
  margin-inline-start: var(--gdv-espacement-8);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-gras);
}

.declarations__statut {
  margin-inline-start: var(--gdv-espacement-8);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.declarations__statut--scelle {
  color: var(--gdv-statut-succes);
  font-weight: var(--gdv-graisse-gras);
}

.declarations__silencieux {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.declarations__total {
  background: var(--gdv-surface-secondaire);
  font-weight: var(--gdv-graisse-moyen);
}

.declarations__tri {
  padding: 0;
  border: none;
  background: none;
  color: var(--gdv-texte-secondaire);
  font-family: inherit;
  font-size: var(--gdv-role-etiquette);
  cursor: pointer;
}

.declarations__tri:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}
</style>
