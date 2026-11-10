<script setup lang="ts">
// Salle d'attente, vue INVITÉ — écran 1b du prototype. Reproduction fidèle :
// pas de QR (déjà utilisé pour rejoindre), nom de la table de l'hôte,
// statistiques de la partie, liste à statuts et bascule « Je suis prêt ».
//
// Le statut PRÊT est purement informatif (RG-02/CA-02 inchangées) : il ne
// bloque jamais demarrer_partie, qui reste gouverné par [joueurs_min,
// joueurs_max] côté hôte. Aucune règle de blocage n'est inventée ici.

import { computed, ref } from 'vue';

import type { JoueurPublic } from '@gdv/partage';

import { texte } from '../logique/contenu.ts';
import BoutonAction from './BoutonAction.vue';
import ListeJoueursPret from './ListeJoueursPret.vue';
import ReglesExplicatives from './ReglesExplicatives.vue';

interface Props {
  joueurs: readonly JoueurPublic[];
  moiId: string;
  code: string;
  nomHote: string;
  nbManches: number | null;
  negociationS: number | null;
  piecesDepart: number | null;
  moiPret: boolean;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ quitter: []; togglerPret: [pret: boolean] }>();

const reglesOuvertes = ref(false);

const connectes = computed(() => props.joueurs.filter((joueur) => joueur.connecte));
const nbPrets = computed(() => connectes.value.filter((joueur) => joueur.pret).length);

/** « 90 » → « 1:30 ». Affichage uniquement, pas une donnée de jeu. */
function minSec(secondes: number): string {
  const min = Math.floor(secondes / 60);
  const reste = String(secondes % 60).padStart(2, '0');
  return `${min}:${reste}`;
}

/** Pseudos des connectés non prêts, pour « en attente de {liste} ». */
const nomsEnAttente = computed((): string => {
  const noms = connectes.value.filter((joueur) => !joueur.pret && joueur.joueur_id !== props.moiId)
    .map((joueur) => joueur.pseudo);
  if (noms.length === 0) return '';
  if (noms.length === 1) return noms[0] ?? '';
  return `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`;
});
</script>

<template>
  <ReglesExplicatives
    v-if="reglesOuvertes"
    @fermer="reglesOuvertes = false"
  />

  <header class="invite__entete">
    <BoutonAction
      :libelle="texte('ecran.salle_attente.quitter')"
      variante="secondaire"
      taille="md"
      @agir="emettre('quitter')"
    />
    <span class="invite__code">{{ props.code }}</span>
  </header>

  <div class="invite__marque">
    <p class="invite__eyebrow">
      {{ texte('ecran.salle_attente.rejoint') }}
    </p>
    <h1 class="invite__titre">
      {{ texte('ecran.salle_attente.table_de', { hote: props.nomHote }) }}
    </h1>
    <p class="invite__attente-hote">
      {{ texte('ecran.salle_attente.attente_hote', { hote: props.nomHote }) }}
    </p>
  </div>

  <div class="invite__stats">
    <div class="invite__stat">
      <span>{{ texte('ecran.salle_attente.stat_manches') }}</span>
      <strong>{{ props.nbManches ?? texte('commun.valeur_indisponible') }}</strong>
    </div>
    <div class="invite__stat">
      <span>{{ texte('ecran.salle_attente.stat_negociation') }}</span>
      <strong>{{ props.negociationS !== null ? minSec(props.negociationS) : texte('commun.valeur_indisponible') }}</strong>
    </div>
    <div class="invite__stat">
      <span>{{ texte('ecran.salle_attente.stat_depart') }}</span>
      <strong>{{ props.piecesDepart !== null
        ? texte('ecran.creation.pieces_depart_valeur', { valeur: props.piecesDepart })
        : texte('commun.valeur_indisponible') }}</strong>
    </div>
  </div>

  <div class="invite__liste">
    <div class="invite__liste-entete">
      <h2>{{ texte('ecran.salle_attente.marchands_titre') }}</h2>
      <span>{{ texte('ecran.salle_attente.prets_compte', { n: nbPrets, total: connectes.length }) }}</span>
    </div>
    <ListeJoueursPret
      :joueurs="props.joueurs"
      :moi-id="props.moiId"
    />
    <p class="invite__explication">
      {{ texte('ecran.salle_attente.explication_placement') }}
    </p>
  </div>

  <footer class="invite__pied">
    <template v-if="!props.moiPret">
      <BoutonAction
        :libelle="texte('ecran.salle_attente.revoir_regles')"
        variante="discret"
        taille="md"
        @agir="reglesOuvertes = true"
      />
      <BoutonAction
        :libelle="texte('action.signaler_pret')"
        variante="principal"
        taille="lg"
        pleine-largeur
        @agir="emettre('togglerPret', true)"
      />
    </template>
    <template v-else>
      <p class="invite__confirmation">
        {{ nomsEnAttente === ''
          ? texte('ecran.salle_attente.tout_le_monde_pret')
          : texte('ecran.salle_attente.en_attente_de', { liste: nomsEnAttente }) }}
      </p>
      <BoutonAction
        :libelle="texte('ecran.salle_attente.pas_encore_bouton')"
        variante="secondaire"
        taille="lg"
        pleine-largeur
        @agir="emettre('togglerPret', false)"
      />
    </template>
  </footer>
</template>

<style scoped>
.invite__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.invite__code {
  padding-inline: var(--gdv-espacement-12);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-secondaire);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-etiquette);
  font-weight: var(--gdv-graisse-tres-gras);
  letter-spacing: var(--gdv-suivi-titre);
  line-height: var(--gdv-cible-minimale);
}

.invite__marque {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.invite__eyebrow {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-transform: uppercase;
  letter-spacing: var(--gdv-suivi-titre);
}

.invite__titre {
  margin: 0;
  font-family: var(--gdv-famille-titre);
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
  color: var(--gdv-accent-action);
}

.invite__attente-hote {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.invite__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--gdv-espacement-8);
}

.invite__stat {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
  padding: var(--gdv-espacement-8);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
}

.invite__stat span {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.invite__stat strong {
  font-size: var(--gdv-role-etiquette);
}

.invite__liste {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
}

.invite__liste-entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gdv-espacement-12);
}

.invite__liste-entete h2 {
  margin: 0;
  font-size: var(--gdv-role-titre-section);
}

.invite__liste-entete span {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.invite__explication {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.invite__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  margin-block-start: auto;
}

.invite__confirmation {
  margin: 0;
  padding: var(--gdv-espacement-12) var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) solid var(--gdv-statut-succes);
  border-radius: var(--gdv-rayon-moyen);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-texte-principal);
  font-size: var(--gdv-role-etiquette);
}
</style>
