<script setup lang="ts">
// Parole du génie. Seule zone de texte long de l'application.
//
// Zone PUBLIQUE par construction : le génie ne chuchote jamais un secret dans
// cette bulle. Les messages privés passent par VoileSecret.
//
// Le texte n'est JAMAIS reçu du serveur : l'événement revelation ne porte qu'un
// gabarit, un index de variante, des cibles et des valeurs (ADR-TL-12). La
// phrase est composée par logique/contenu.ts depuis
// contenu/revelations.fr.json. C'est ce qui permettra de trancher l'univers
// sans toucher au serveur (RG-61, ESC-01).
//
// Aucun texte de remplacement n'est jamais fabriqué : une bulle qui invente
// trahirait la loi de véracité telle que le joueur la perçoit (RG-20). Le cas
// « aucune révélation éligible » est un CONTENU à part entière, pas un vide —
// il doit se lire comme une décision du génie, non comme un bogue.
//
// La famille typographique et le cadre de la bulle sont les deux SEULS points
// où une identité d'univers devra s'exprimer. Ils sont isolés exprès.

import { texte } from '../logique/contenu.ts';
import BandeauAlerte from './BandeauAlerte.vue';
import JetonMontant from './JetonMontant.vue';
import SqueletteChargement from './SqueletteChargement.vue';

export type VarianteBulle = 'annonce' | 'revelation' | 'verdict';
export type EtatBulle = 'repos' | 'chargement' | 'vide' | 'erreur' | 'aucune_revelation';

interface Props {
  variante?: VarianteBulle;
  etat?: EtatBulle;
  /** Phrase déjà composée depuis le fichier de contenu. */
  phrase?: string;
  /** Écart total : les deux nombres côte à côte avec leurs libellés. */
  totalDeclare?: number | null;
  totalPaye?: number | null;
  /** Clé de contenu de l'état vide : le génie se tait, à vous de parler. */
  cleVide?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variante: 'annonce',
  etat: 'repos',
  phrase: '',
  totalDeclare: null,
  totalPaye: null,
  cleVide: 'genie.se_tait_a_vous',
});

const emettre = defineEmits<{ reessayer: [] }>();

const LIGNES_SQUELETTE = 3;
</script>

<template>
  <div
    class="bulle"
    :class="[`bulle--${props.variante}`, `bulle--${props.etat}`]"
  >
    <SqueletteChargement
      v-if="props.etat === 'chargement'"
      :lignes="LIGNES_SQUELETTE"
      hauteur="var(--gdv-espacement-24)"
      :libelle="texte('genie.chargement')"
    />

    <BandeauAlerte
      v-else-if="props.etat === 'erreur'"
      variante="erreur"
      cle-contenu="genie.erreur"
      :action-libelle="texte('commun.reessayer')"
      @reprendre="emettre('reessayer')"
    />

    <template v-else>
      <!-- Écart total : c'est la JUXTAPOSITION qui porte le sens, aucune
           couleur ne qualifie l'écart. -->
      <dl
        v-if="props.totalDeclare !== null && props.totalPaye !== null"
        class="bulle__ecart"
      >
        <div class="bulle__mesure">
          <dt class="bulle__etiquette">
            {{ texte('commun.promis') }}
          </dt>
          <dd class="bulle__valeur">
            <JetonMontant
              :valeur="props.totalDeclare"
              :etiquette="texte('commun.promis')"
            />
          </dd>
        </div>
        <div class="bulle__mesure">
          <dt class="bulle__etiquette">
            {{ texte('commun.recu') }}
          </dt>
          <dd class="bulle__valeur">
            <JetonMontant
              :valeur="props.totalPaye"
              :etiquette="texte('commun.recu')"
            />
          </dd>
        </div>
      </dl>

      <p
        v-if="props.etat === 'aucune_revelation'"
        class="bulle__phrase"
        aria-live="polite"
      >
        {{ texte('genie.aucune_revelation') }}
      </p>
      <p
        v-else-if="props.etat === 'vide'"
        class="bulle__phrase bulle__phrase--vide"
      >
        {{ texte(props.cleVide) }}
      </p>
      <p
        v-else-if="props.phrase"
        class="bulle__phrase"
        aria-live="polite"
      >
        {{ props.phrase }}
      </p>

      <slot />
    </template>
  </div>
</template>

<style scoped>
.bulle {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-24);
  border: var(--gdv-trait-fin) solid var(--gdv-bordure-structurante);
  border-radius: var(--gdv-rayon-large);
  background: var(--gdv-surface-primaire);
  color: var(--gdv-texte-principal);
  inline-size: 100%;
}

.bulle--revelation {
  border-left: var(--gdv-trait-epais) solid var(--gdv-marque-public);
}

.bulle__phrase {
  margin: 0;
  max-inline-size: var(--gdv-mesure-ligne-etroit);
  font-family: var(--gdv-famille-voix-genie);
  font-size: var(--gdv-role-voix-genie);
  line-height: var(--gdv-interligne-courant);
}

.bulle__phrase--vide {
  color: var(--gdv-texte-secondaire);
}

.bulle__ecart {
  display: flex;
  gap: var(--gdv-espacement-24);
  margin: 0;
}

.bulle__mesure {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-4);
}

.bulle__etiquette {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.bulle__valeur {
  margin: 0;
  font-size: var(--gdv-role-nombre-secondaire);
}

@media (min-width: 768px) {
  .bulle__phrase {
    max-inline-size: var(--gdv-mesure-ligne-large);
  }
}
</style>
