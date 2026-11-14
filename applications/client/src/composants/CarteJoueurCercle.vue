<script setup lang="ts">
// Un marchand vu par les AUTRES.
//
// Ne porte QUE des données publiques de matrice_visibilite : pseudo, position,
// état de connexion, montant déclaré de la manche, accusations et verdicts
// publics. Le contrat d'entrée ci-dessous est la liste close : il n'existe
// aucune propriété pour un solde, un montant payé, un rôle, une mission, ni
// pour l'existence d'une enquête subie.
//
// Pas d'entrée `a_paye` : aucun événement du protocole ne publie qui a payé
// (API-GDV-001 / EvtPaiementEnregistre est projeté au seul payeur, et
// « aucun compteur public de paiements n'existe »). Le contrat de conception
// prévoyait cette pastille ; elle est sans source. Écart consigné au rapport.
//
// Le montant déclaré s'affiche EN CLAIR, sans voile : c'est le contraste
// pédagogique qui apprend au joueur que ce qui est voilé est secret.

import { computed } from 'vue';

import { texte } from '../logique/contenu.ts';
import type { Relation } from '../logique/positions-cercle.ts';
import JetonMontant from './JetonMontant.vue';

export type VarianteCarte = 'compacte' | 'etendue' | 'selectionnable';

interface Props {
  pseudo: string;
  positionCercle: number | null;
  connecte: boolean;
  relation?: Relation;
  /** Montant DÉCLARÉ, public dès la soumission. Null = pas encore déclaré. */
  montantDeclare?: number | null;
  verdict?: 'MENTEUR' | 'HONNETE' | null;
  excluDuPartage?: boolean;
  variante?: VarianteCarte;
  selectionnee?: boolean;
  /** Non sélectionnable : la raison est TOUJOURS affichée. */
  raisonIndisponible?: string;
  nommeParLeGenie?: boolean;
  chargement?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  relation: 'en_face',
  montantDeclare: null,
  verdict: null,
  excluDuPartage: false,
  variante: 'compacte',
  selectionnee: false,
  raisonIndisponible: '',
  nommeParLeGenie: false,
  chargement: false,
});

const emettre = defineEmits<{ choisir: [] }>();

const CLES_RELATION: Readonly<Record<Relation, string>> = {
  moi: 'commun.moi',
  gauche: 'cercle.a_ta_gauche',
  droite: 'cercle.a_ta_droite',
  en_face: 'cercle.en_face',
};

const indisponible = computed(() => props.raisonIndisponible !== '');
const actionnable = computed(() => props.variante === 'selectionnable' && !indisponible.value);

/** Nom accessible : pseudo, relation de voisinage, état — dans cet ordre. */
const nomAccessible = computed((): string => {
  const etat = props.connecte ? '' : `, ${texte('carte_joueur.deconnecte')}`;
  return `${props.pseudo}, ${texte(CLES_RELATION[props.relation])}${etat}`;
});
</script>

<template>
  <component
    :is="actionnable ? 'button' : 'div'"
    class="carte"
    :class="[
      `carte--${props.variante}`,
      {
        'carte--moi': props.relation === 'moi',
        'carte--deconnecte': !props.connecte,
        'carte--menteur': props.verdict === 'MENTEUR',
        'carte--honnete': props.verdict === 'HONNETE',
        'carte--exclu': props.excluDuPartage,
        'carte--selectionnee': props.selectionnee,
        'carte--indisponible': indisponible,
        'carte--nommee': props.nommeParLeGenie,
      },
    ]"
    :type="actionnable ? 'button' : undefined"
    :disabled="actionnable && indisponible ? true : undefined"
    :aria-label="nomAccessible"
    :aria-pressed="props.variante === 'selectionnable' ? props.selectionnee : undefined"
    @click="actionnable ? emettre('choisir') : undefined"
  >
    <p class="carte__pseudo">
      {{ props.pseudo }}
    </p>

    <p
      v-if="props.relation === 'moi'"
      class="carte__meta"
    >
      {{ texte('commun.moi') }}
    </p>
    <p
      v-else-if="props.variante === 'etendue' && props.positionCercle !== null"
      class="carte__meta"
    >
      {{ texte('cercle.siege', { numero: props.positionCercle }) }}
    </p>

    <!-- Avancement de la déclaration : pastille ÉVIDÉE quand rien n'est promis,
         PLEINE sinon. La forme double la couleur. -->
    <p
      v-if="props.montantDeclare === null"
      class="carte__attente"
    >
      <span
        class="carte__pastille"
        aria-hidden="true"
      />
      {{ texte('carte_joueur.pas_encore_parle') }}
    </p>
    <p
      v-else
      class="carte__declare"
    >
      <span
        class="carte__pastille carte__pastille--pleine"
        aria-hidden="true"
      />
      <JetonMontant
        :valeur="props.montantDeclare"
        :etiquette="texte('carte_joueur.promis')"
      />
    </p>

    <p
      v-if="props.verdict !== null"
      class="carte__badge"
    >
      {{ props.verdict === 'MENTEUR' ? texte('carte_joueur.menteur') : texte('carte_joueur.honnete') }}
    </p>

    <p
      v-if="props.excluDuPartage"
      class="carte__badge carte__badge--exclu"
    >
      {{ texte('carte_joueur.exclu_du_partage') }}
    </p>

    <p
      v-if="!props.connecte"
      class="carte__meta"
    >
      {{ texte('carte_joueur.deconnecte') }}
    </p>

    <p
      v-if="props.nommeParLeGenie"
      class="carte__meta"
    >
      {{ texte('carte_joueur.nomme_par_le_genie') }}
    </p>

    <p
      v-if="props.selectionnee"
      class="carte__meta"
    >
      {{ texte('carte_joueur.cible_choisie') }}
    </p>

    <p
      v-if="indisponible"
      class="carte__meta"
    >
      {{ props.raisonIndisponible }}
    </p>
  </component>
</template>

<style scoped>
.carte {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--gdv-espacement-4);
  /* PAS de min-inline-size ici : la loi de Fitts protège une cible TACTILE,
     pas une carte de lecture seule. La variante compacte (cercle en lecture,
     VOEU/NEGOCIATION/REVELATION) n'est jamais tapée — c'est elle que
     CercleDesPlaces.vue contraint en largeur pour effectif élevé (RUP
     responsive, conseil LLM), et un plancher ici annulerait cette contrainte
     dès que l'effectif approche 8. Le plancher tactile reste porté par
     --selectionnable et --etendue ci-dessous, les deux seules variantes
     tapées ou pleine-largeur. */
  min-block-size: var(--gdv-hauteur-carte-joueur);
  padding: var(--gdv-espacement-8);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-principal);
  font-family: var(--gdv-famille-interface);
  text-align: start;
  /* Sans effet tant que rien ne borne la hauteur (etendue, selectionnable).
     En variante compacte sur le cercle à effectif élevé, CercleDesPlaces.vue
     pose un max-height : le surplus de texte (statut sur plusieurs lignes)
     doit être MASQUÉ, jamais déborder visuellement sur la carte voisine —
     le pseudo, premier enfant, reste toujours lisible en entier. */
  overflow: hidden;
}

.carte--etendue {
  min-inline-size: var(--gdv-largeur-carte-joueur);
  inline-size: 100%;
}

.carte--selectionnable {
  min-inline-size: var(--gdv-largeur-carte-joueur);
  min-block-size: var(--gdv-cible-geante);
  border-width: var(--gdv-trait-moyen);
  border-color: var(--gdv-bordure-champ);
  cursor: pointer;
}

.carte--selectionnee {
  border-width: var(--gdv-trait-epais);
  border-color: var(--gdv-accent-action);
  background: var(--gdv-surface-secondaire);
}

.carte--moi {
  border-width: var(--gdv-trait-epais);
  border-color: var(--gdv-marque-prive);
}

.carte--deconnecte {
  border-style: dashed;
}

.carte--menteur {
  border-width: var(--gdv-trait-moyen);
  border-color: var(--gdv-statut-echec);
}

.carte--honnete {
  border-width: var(--gdv-trait-moyen);
  border-color: var(--gdv-statut-succes);
}

.carte--exclu {
  background: var(--gdv-surface-secondaire);
}

.carte--nommee {
  border-left: var(--gdv-trait-epais) solid var(--gdv-marque-public);
}

.carte--indisponible {
  background: var(--gdv-surface-desactivee);
  color: var(--gdv-texte-desactive);
  cursor: not-allowed;
}

.carte:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}

.carte__pseudo {
  margin: 0;
  inline-size: 100%;
  /* Un pseudo long et sans espace (ex. « Guillemette ») ne doit jamais
     DÉBORDER visuellement d'une carte resserrée par CercleDesPlaces.vue : la
     carte resterait géométriquement sans chevauchement, mais le texte, lui,
     chevaucherait quand même la carte voisine. */
  overflow-wrap: break-word;
  font-size: var(--gdv-role-corps);
  font-weight: var(--gdv-graisse-moyen);
}

.carte__meta {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.carte__attente,
.carte__declare {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-4);
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.carte__pastille {
  inline-size: var(--gdv-espacement-8);
  block-size: var(--gdv-espacement-8);
  border: var(--gdv-trait-moyen) solid currentcolor;
  border-radius: var(--gdv-rayon-pilule);
}

.carte__pastille--pleine {
  background: var(--gdv-marque-public);
  border-color: var(--gdv-marque-public);
}

.carte__badge {
  margin: 0;
  padding-inline: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-statut-echec);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-gras);
}

.carte--honnete .carte__badge {
  color: var(--gdv-statut-succes);
}

.carte__badge--exclu {
  color: var(--gdv-texte-principal);
  font-weight: var(--gdv-graisse-moyen);
}
</style>
