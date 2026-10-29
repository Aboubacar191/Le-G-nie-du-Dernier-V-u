<script setup lang="ts">
// ECR-16 — Déclaration publique de contribution (US-05, RG-08, RG-31).
//
// 30 s pour DEUX actes, déclarer ET payer. Cible : 5 s pour déclarer, 5 s pour
// payer, 20 s de marge pour l'hésitation et la conversation. L'incrémenteur est
// donc actif DÈS LE PREMIER RENDU, avec la valeur 0 et les bornes connues
// localement : ne jamais bloquer la saisie en attendant le réseau.
//
// La déclaration est PUBLIQUE : elle s'affiche en clair, en grand, sans voile.
// Ce contraste est pédagogique — le joueur apprend en une manche que ce qui est
// en clair est public et que ce qui est voilé est secret.
//
// La borne supérieure dépend du solde (RG-08). Le solde lui-même reste SOUS
// VOILE dans le panneau privé ; seule la borne est appliquée, silencieusement.
//
// ÉTATS (DESIGN ECR-16)
// chargement   : incrémenteur actif dès le premier rendu ; la liste des
//                déclarations arrive en squelette.
// contenu      : incrémenteur dans le tiers bas, 3 raccourcis, bouton en pied,
//                déclarations déjà publiées en haut.
// vide         : personne n'a encore promis — l'action est déjà à l'écran.
// erreur       : déclaration supérieure au solde (borne_atteinte) ; refus
//                serveur, la valeur est ramenée à la borne, jamais effacée ;
//                non-soumission à l'expiration, énoncée sans dramatiser.
// acces_refuse : hors phase, ou déjà déclaré et payé — état scellé.

import { computed, ref, watch } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import ListeDeclarationsPubliques from '../composants/ListeDeclarationsPubliques.vue';
import { texte } from '../logique/contenu.ts';
import { bornes, borner, raccourcisDeclaration } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const montant = ref(0);
const envoi = ref(false);

const solde = computed(() => magasin.etat.moi?.solde_pieces ?? 0);
const limites = computed(() => bornes(0, solde.value));
const objectifParJoueur = computed(() => {
  const config = magasin.etat.session?.config as { objectif_par_joueur?: number };
  return config?.objectif_par_joueur ?? 0;
});
const raccourcis = computed(() =>
  raccourcisDeclaration(limites.value, objectifParJoueur.value, solde.value),
);

const horsPhase = computed(() => magasin.etat.phase !== 'DECLARATION_PAIEMENT');
const dejaDeclare = computed(() => magasin.etat.moi?.montant_declare !== null);

// Refus serveur : la valeur est RAMENÉE à la borne valide, jamais effacée.
watch(limites, (nouvelles) => {
  montant.value = borner(montant.value, nouvelles);
});

function declarer(): void {
  envoi.value = true;
  magasin.envoyer('declarer_contribution', { montant: montant.value });
  envoi.value = false;
}
</script>

<template>
  <section class="declaration">
    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <ListeDeclarationsPubliques
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :declarations="magasin.etat.declarations"
      :desactive="horsPhase"
      :action-vide-libelle="texte('ecran.declaration.declarer_ma_contribution')"
    />

    <p class="declaration__avancement">
      {{ texte('ecran.declaration.avancement', {
        k: magasin.etat.nb_declarations,
        n: magasin.etat.joueurs.length,
      }) }}
    </p>

    <!-- Tiers bas : zone atteignable au pouce sans repositionner la main. -->
    <div class="declaration__saisie">
      <p class="declaration__libelle">
        {{ texte('ecran.declaration.libelle') }}
        <span class="declaration__marque">{{ texte('ecran.declaration.marque_publique') }}</span>
      </p>

      <IncrementeurMontant
        v-model:valeur="montant"
        :bornes="limites"
        variante="public"
        :raccourcis="raccourcis"
        :desactive="horsPhase || dejaDeclare"
        :chargement="envoi"
        :intitule="texte('ecran.declaration.libelle')"
      />

      <BoutonAction
        :libelle="dejaDeclare ? texte('ecran.declaration.declare') : texte('action.declarer_contribution')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :desactive="horsPhase || dejaDeclare"
        :raison="horsPhase ? texte('ecran.declaration.hors_phase') : texte('ecran.declaration.declare')"
        :chargement="envoi"
        @agir="declarer"
      />
    </div>
  </section>
</template>

<style scoped>
.declaration {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-gouttiere-ecran);
}

.declaration__avancement {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}

.declaration__saisie {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  margin-block-start: auto;
}

.declaration__libelle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-8);
  margin: 0;
  font-size: var(--gdv-role-corps);
}

/* La marque « Visible par tous » est le pendant lisible du voile : c'est elle
   qui apprend au joueur la différence entre public et secret. */
.declaration__marque {
  padding-inline: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-surface-secondaire);
  color: var(--gdv-marque-public);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-moyen);
}
</style>
