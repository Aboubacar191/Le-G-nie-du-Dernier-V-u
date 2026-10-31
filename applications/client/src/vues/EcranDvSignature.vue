<script setup lang="ts">
// ECR-25 — Dernier Vœu, signature secrète. Phase DV_SIGNATURE, 10 s (CA-39).
//
// RG-77, mesure M7-b — LA FUITE LA PLUS FACILE DU JEU. Les deux options
// « Signer » et « Refuser » sont placées à des positions TIRÉES AU HASARD, par
// joueur et par partie. Sans cela, un voisin déduirait le choix du côté de
// l'écran touché, et le dilemme serait annulé.
//
// Le tirage est LOCAL : il n'est jamais demandé au serveur. Une commande qui le
// porterait entrerait au journal de commandes, donc dans un état rejouable, et
// la position deviendrait déductible par quiconque lit le journal.
//
// Au repos, les deux pastilles sont IDENTIQUES et MUETTES. Les libellés ne sont
// lisibles que sous maintien.
//
// 10 s seulement : c'est la phase la plus courte du jeu. L'interaction est
// pré-chargée pendant DV_DEBAT, déjà à l'écran, sans aucune navigation. Si le
// voile n'est pas prêt, l'état affiché est ERREUR, pas chargement — les 10 s ne
// peuvent pas être entamées par une attente réseau.
//
// Le DÉFAUT est annoncé AVANT l'expiration : ne rien sceller vaut refus. Le
// joueur doit connaître le défaut, sinon le silence devient un piège.
//
// ÉTATS (DESIGN ECR-25)
// chargement   : non admissible au-delà du seuil — l'état est erreur.
// contenu      : minuteur en taille lg, consigne du défaut, voile de choix avec
//                deux pastilles identiques, bouton de scellement.
// vide         : non atteignable.
// erreur       : soumission refusée, avec le temps restant ; expiration sans
//                soumission, énoncée APRÈS la phase, quand le refus n'est plus
//                une information exploitable.
// acces_refuse : mode avancé inactif — non atteignable.

import { computed, onMounted, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import MinuteurPhase from '../composants/MinuteurPhase.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { utiliserHorlogeAffichage } from '../composables/horloge-affichage.ts';
import { texte } from '../logique/contenu.ts';
import { calculerDecompte, formaterDecompte } from '../logique/decompte.ts';
import {
  dispositionStable,
  type DispositionSignature,
  type OptionSignature,
} from '../logique/positions-signature.ts';
import { dureePhaseS } from '../magasin/etat.ts';
import { utiliserMagasin, utiliserStockage } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const stockage = utiliserStockage();
const maintenant = utiliserHorlogeAffichage();

const choix = ref<OptionSignature | null>(null);
const disposition = ref<DispositionSignature>(['signer', 'refuser']);

onMounted(() => {
  // Tirage local, stable pour cette partie et ce joueur : les pastilles ne
  // sautent pas sous le pouce pendant une fenêtre de 10 secondes.
  disposition.value = dispositionStable(
    stockage,
    magasin.etat.session?.session_id ?? '',
    magasin.etat.moi?.joueur_id ?? '',
  );
});

const scelle = computed(() => magasin.etat.signature_scellee);
const decompte = computed(() =>
  calculerDecompte(
    magasin.etat.decalage,
    magasin.etat.phase_fin_at,
    maintenant.value,
    dureePhaseS(magasin.etat),
  ),
);

const etatVoile = computed(() => (scelle.value ? ('scelle' as const) : null));

function sceller(): void {
  if (choix.value === null) return;
  magasin.envoyer('signer_dernier_voeu', { a_signe: choix.value === 'signer' });
  // M5 : le choix disparaît de l'état local dès la soumission. Rien ne doit
  // pouvoir le réafficher, jamais.
  choix.value = null;
}
</script>

<template>
  <section class="signature">
    <MinuteurPhase
      class="signature__minuteur"
      variante="anneau"
      taille="lg"
      :decompte="decompte"
      :duree-phase-s="dureePhaseS(magasin.etat)"
      :libelle="texte('bandeau_phase.secondes_restantes', { secondes: decompte.secondes ?? 0 })"
    />

    <!-- Le défaut est annoncé AVANT l'expiration. -->
    <BandeauAlerte
      variante="information"
      cle-contenu="ecran.dernier_voeu.defaut"
    />
    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="{ temps: formaterDecompte(decompte.secondes) }"
    />

    <VoileSecret
      variante="choix"
      :intitule="texte('ecran.dernier_voeu.titre')"
      :etat-impose="etatVoile"
    >
      <!-- Les deux options sont dans la fenêtre de lecture, dans l'ordre TIRÉ.
           Au repos, rien de leur libellé n'est rendu dans l'arbre. -->
      <template #secret>
        <div class="signature__options">
          <button
            v-for="option in disposition"
            :key="option"
            type="button"
            class="signature__option"
            :class="{ 'signature__option--choisie': choix === option }"
            :aria-pressed="choix === option"
            @click="choix = option"
          >
            {{ option === 'signer'
              ? texte('ecran.dernier_voeu.signer')
              : texte('ecran.dernier_voeu.refuser') }}
          </button>
        </div>
      </template>

      <template #saisie>
        <BoutonAction
          :libelle="texte('ecran.dernier_voeu.sceller')"
          variante="principal"
          taille="lg"
          pleine-largeur
          :desactive="choix === null || scelle"
          :raison="texte('ecran.dernier_voeu.defaut')"
          @agir="sceller"
        />
      </template>
    </VoileSecret>
  </section>
</template>

<style scoped>
.signature {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.signature__minuteur {
  align-self: center;
}

.signature__options {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-8);
  inline-size: 100%;
}

/* Les deux pastilles sont rigoureusement identiques : même taille, même
   surface, même bordure. Seul leur ORDRE change d'un joueur à l'autre. */
/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.signature__option {
  min-block-size: var(--gdv-cible-minimale);
  inline-size: 100%;
  border: var(--gdv-trait-moyen) solid var(--gdv-bordure-secret);
  border-radius: var(--gdv-rayon-moyen);
  background: transparent;
  color: var(--gdv-texte-sur-voile);
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  cursor: pointer;
}

.signature__option--choisie {
  background: var(--gdv-accent-action-actif);
  color: var(--gdv-texte-sur-accent);
}

.signature__option:focus-visible {
  outline: var(--gdv-trait-moyen) solid var(--gdv-accent-focus);
  outline-offset: var(--gdv-espacement-4);
}
</style>
