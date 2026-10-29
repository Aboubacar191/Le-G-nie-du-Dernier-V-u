<script setup lang="ts">
// État de la liaison au génie. Donnée PUBLIQUE (matrice_visibilite : l'état de
// connexion est visible par tous).
//
// Jamais la couleur seule : l'état est doublé d'un libellé textuel dès qu'il
// n'est pas nominal. L'état normal, lui, n'occupe aucun espace visuel — il est
// accessible mais non affiché, parce qu'un bandeau « tout va bien » permanent
// vole de la place à ce qui compte.

import { texte } from '../logique/contenu.ts';
import type { EtatLiaison } from '../transport/client-ws.ts';

interface Props {
  liaison: EtatLiaison;
}

const props = defineProps<Props>();

/** Correspondance liaison → clé de contenu et forme de pastille. */
const ETATS: Readonly<Record<EtatLiaison, { cle: string; pleine: boolean; nominal: boolean }>> = {
  etablie: { cle: 'connexion.connecte', pleine: true, nominal: true },
  inactive: { cle: 'connexion.chargement', pleine: false, nominal: false },
  connexion: { cle: 'connexion.chargement', pleine: false, nominal: false },
  authentification: { cle: 'connexion.reconnexion', pleine: false, nominal: false },
  perdue: { cle: 'connexion.perdu', pleine: false, nominal: false },
  refusee: { cle: 'connexion.erreur', pleine: false, nominal: false },
};

const etat = (): { cle: string; pleine: boolean; nominal: boolean } =>
  ETATS[props.liaison] ?? ETATS.inactive;
</script>

<template>
  <span
    class="liaison"
    :class="[`liaison--${props.liaison}`, { 'liaison--nominale': etat().nominal }]"
  >
    <span
      class="liaison__pastille"
      :class="{ 'liaison__pastille--pleine': etat().pleine }"
      aria-hidden="true"
    />
    <span
      class="liaison__libelle"
      :class="{ 'liaison__libelle--accessible-seul': etat().nominal }"
    >{{ texte(etat().cle) }}</span>
  </span>
</template>

<style scoped>
.liaison {
  display: inline-flex;
  align-items: center;
  gap: var(--gdv-espacement-4);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.liaison__pastille {
  inline-size: var(--gdv-espacement-8);
  block-size: var(--gdv-espacement-8);
  border: var(--gdv-trait-moyen) solid currentcolor;
  border-radius: var(--gdv-rayon-pilule);
}

.liaison__pastille--pleine {
  background: currentcolor;
}

.liaison--etablie {
  color: var(--gdv-statut-succes);
}

.liaison--authentification,
.liaison--connexion,
.liaison--inactive {
  color: var(--gdv-texte-desactive);
}

.liaison--perdue {
  color: var(--gdv-statut-echec);
}

.liaison--refusee {
  color: var(--gdv-statut-echec);
}

/* État nominal : accessible, non affiché. */
.liaison__libelle--accessible-seul {
  position: absolute;
  overflow: hidden;
  clip-path: inset(50%);
  inline-size: var(--gdv-trait-fin);
  block-size: var(--gdv-trait-fin);
  white-space: nowrap;
}
</style>
