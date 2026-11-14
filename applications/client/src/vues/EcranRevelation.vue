<script setup lang="ts">
// ECR-18 — Révélation du génie. Phase REVELATION, 20 s, lecture seule.
//
// Temps 1 : l'écart total, systématique. Les deux nombres CÔTE À CÔTE avec
// leurs libellés « Promis » et « Reçu » : c'est la juxtaposition qui porte le
// sens, aucune couleur ne qualifie l'écart.
//
// Temps 2 : au plus une révélation du catalogue. Si aucun gabarit n'est
// éligible (RG-21, CA-15), la bulle affiche l'état « aucune révélation » —
// traité comme un CONTENU, pas comme un vide : « Le génie n'ajoute rien. Il a
// dit l'écart, rien de plus. »
//
// L'écran n'affiche QUE ce que le serveur a publié. Il ne recalcule rien, ne
// déduit rien, et n'affiche AUCUNE aide à la déduction : afficher « il reste 3
// suspects » donnerait à l'application un rôle d'analyste que les règles ne lui
// donnent pas. La déduction est le travail des joueurs, à voix haute.
//
// La phrase est composée localement depuis le gabarit, la variante et les
// valeurs (ADR-TL-12) : l'événement ne porte aucun texte.
//
// ÉTATS (DESIGN ECR-18)
// chargement   : bulle en chargement, hauteur de 3 lignes réservée pour que
//                l'arrivée du texte ne décale pas le cercle.
// contenu      : écart total en haut, parole du génie au centre du cercle,
//                cibles nommées mises en évidence.
// vide         : aucune révélation éligible — état « aucune révélation » de la
//                bulle. L'écart, lui, est toujours là : l'écran n'est jamais vide.
// erreur       : révélation non reçue, reprise. Aucun texte de remplacement
//                n'est fabriqué : une bulle qui invente trahirait RG-20.
// acces_refuse : jeton invalide, ECR-32.

import { computed } from 'vue';

import BulleGenie from '../composants/BulleGenie.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import ListeDeclarationsPubliques from '../composants/ListeDeclarationsPubliques.vue';
import { composerRevelation } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const ecart = computed(() => magasin.etat.ecart_total);
const revelation = computed(() => magasin.etat.revelation);

const etatBulle = computed(() => {
  if (ecart.value === null) return 'chargement' as const;
  if (revelation.value === null) return 'aucune_revelation' as const;
  return 'repos' as const;
});

/** Phrase composée depuis le fichier de contenu. Aucun texte ne vient du fil. */
const phrase = computed((): string => {
  const recue = revelation.value;
  if (recue === null) return '';
  return composerRevelation(recue.revelation, (joueurId) => pseudoDe(magasin.etat, joueurId));
});

/**
 * Cibles nommées par la révélation. Mises en évidence par une bordure ET un
 * libellé textuel, jamais par la couleur seule, et JAMAIS par un qualificatif :
 * le gabarit VOISINAGE nomme sans accuser (CA-18), l'interface ne doit pas
 * transformer cette nomination en soupçon.
 */
const nommes = computed(() => [...(revelation.value?.revelation.cibles ?? [])]);
</script>

<template>
  <section class="revelation">
    <BulleGenie
      variante="revelation"
      :etat="etatBulle"
      :phrase="phrase"
      :total-declare="ecart?.total_declare ?? null"
      :total-paye="ecart?.total_paye ?? null"
    />

    <CercleDesPlaces
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="magasin.etat.moi?.joueur_id ?? ''"
      variante="lecture"
      :declarations="magasin.etat.declarations"
      :nommes="nommes"
    />

    <ListeDeclarationsPubliques
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :declarations="magasin.etat.declarations"
      desactive
    />
  </section>
</template>

<style scoped>
.revelation {
  display: flex;
  flex-direction: column;
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}
</style>
