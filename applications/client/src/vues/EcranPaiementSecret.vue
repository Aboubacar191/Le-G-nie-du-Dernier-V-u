<script setup lang="ts">
// ECR-17 — Paiement secret (US-06, RG-09, CA-09, CA-10).
//
// C'est le cœur du jeu et l'écran le plus exposé au regard du voisin. CA-10 est
// le critère le plus strict de la spécification : la valeur payée ne doit
// apparaître dans aucun message reçu par les autres, sous aucune forme. Le
// miroir d'interface de cette exigence est double :
//  · la valeur n'apparaît dans AUCUNE zone publique de l'écran (M6) ;
//  · elle n'apparaît NULLE PART après validation (M5).
//
// Fuites explicitement fermées ici :
//  · aucun montant dans le bandeau de phase ;
//  · aucun récapitulatif avant validation ;
//  · aucune confirmation chiffrée après validation — l'état scellé ne porte
//    aucun nombre, définitivement ;
//  · aucun retour haptique ni sonore à la révélation ;
//  · remasquage sur blur, visibilitychange, défilement et changement de phase.
//
// Le message de non-soumission ne contient AUCUN chiffre : annoncer « le génie
// a inscrit 0 » dans une zone publique divulguerait un paiement nul.
//
// ÉTATS (DESIGN ECR-17)
// chargement   : voile en chargement, « Le génie attend ton or ».
// contenu      : rappel public « Tu as promis N » en haut ; tiers bas, voile de
//                saisie avec l'incrémenteur et le bouton. Borne haute = déclaré.
// vide         : NON atteignable — le paiement n'existe qu'après la déclaration.
// erreur       : paiement supérieur au déclaré (borne_atteinte, message DANS le
//                voile) ; refus serveur en zone publique SANS chiffre ; double
//                soumission refusée.
// acces_refuse : pas encore déclaré, sortie vers la déclaration ; hors phase,
//                voile désactivé avec raison.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import IncrementeurMontant from '../composants/IncrementeurMontant.vue';
import ListeDeclarationsPubliques from '../composants/ListeDeclarationsPubliques.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { bornes, raccourcisPaiement } from '../logique/montant.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();

const montant = ref(0);
const envoi = ref(false);

const declare = computed(() => magasin.etat.moi?.montant_declare ?? null);
const limites = computed(() => bornes(0, declare.value ?? 0));
const raccourcis = computed(() => raccourcisPaiement(limites.value, declare.value ?? 0));

/**
 * Mensonge envisagé et amende qui en découlerait — calculés DANS le voile :
 * gap = declare - montant expose indirectement le montant payé si on le
 * publie hors voile (le déclaré, lui, est déjà public). Jamais en dehors.
 */
const gap = computed(() => Math.max(0, (declare.value ?? 0) - montant.value));
const multiplicateurAmende = computed((): number => {
  const config = magasin.etat.session?.config as { multiplicateur_amende?: number };
  return config?.multiplicateur_amende ?? 1;
});
const amende = computed(() => gap.value * multiplicateurAmende.value);

const horsPhase = computed(() => magasin.etat.phase !== 'DECLARATION_PAIEMENT');
const scelle = computed(() => magasin.etat.paiement_scelle);

/** État imposé au voile : scellé après validation (M5), désactivé hors phase. */
const etatVoile = computed(() => {
  if (scelle.value) return 'scelle' as const;
  if (horsPhase.value) return 'desactive' as const;
  return null;
});

const clePhase = computed(() => `${magasin.etat.numero_manche ?? 0}-paiement`);

function sceller(): void {
  envoi.value = true;
  magasin.envoyer('payer_secret', { montant: montant.value });
  // La valeur locale est effacée IMMÉDIATEMENT : plus rien ne doit pouvoir la
  // réafficher, pas même un retour arrière de rendu (M5).
  montant.value = 0;
  envoi.value = false;
}
</script>

<template>
  <section class="paiement">
    <EtatVide
      v-if="declare === null"
      :titre="texte('ecran.paiement.declare_d_abord')"
      :action-libelle="texte('ecran.paiement.declarer')"
    />

    <template v-else>
      <h1 class="paiement__titre">
        {{ texte('ecran.paiement.titre') }}
      </h1>

      <!-- Zone PUBLIQUE : le montant déclaré y figure, car il est déjà public.
           Le montant PAYÉ n'y figure jamais, sous aucune forme. -->
      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <p class="paiement__rappel">
        {{ texte('ecran.paiement.rappel_declare', { declare }) }}
      </p>

      <ListeDeclarationsPubliques
        :joueurs="magasin.etat.joueurs"
        :ordre="[...magasin.etat.ordre_cercle]"
        :declarations="magasin.etat.declarations"
        desactive
      />

      <!-- Tiers inférieur : là où la main qui tient l'appareil fait écran. -->
      <div class="paiement__saisie">
        <p class="paiement__libelle">
          {{ texte('ecran.paiement.libelle') }}
          <span class="paiement__marque">{{ texte('ecran.paiement.marque_secrete') }}</span>
        </p>

        <VoileSecret
          variante="saisie"
          :intitule="texte('ecran.paiement.titre')"
          :etat-impose="etatVoile"
          :cle-phase="clePhase"
        >
          <!-- Les libellés des raccourcis sont EUX-MÊMES secrets : « Tout ce que
               j'ai promis » renseigne sur le montant. Ils vivent donc dans le
               voile, pas à côté. -->
          <template #saisie>
            <IncrementeurMontant
              v-model:valeur="montant"
              :bornes="limites"
              variante="secret"
              :raccourcis="raccourcis"
              :desactive="horsPhase || scelle"
              :chargement="envoi"
              :intitule="texte('ecran.paiement.libelle')"
            />
            <!-- Conséquence du mensonge envisagé, dans le voile : si c'était
                 hors voile, « tu gardes N » exposerait le montant payé par
                 déduction (le déclaré est déjà public). -->
            <p
              v-if="gap > 0"
              class="paiement__consequence"
            >
              {{ texte('ecran.paiement.gap_garde', { gap }) }}
              {{ texte('ecran.paiement.amende_risque', { fine: amende }) }}
            </p>
            <BoutonAction
              :libelle="texte('action.payer_secret')"
              variante="principal"
              taille="lg"
              pleine-largeur
              :desactive="horsPhase || scelle"
              :raison="horsPhase ? texte('ecran.declaration.hors_phase') : texte('ecran.paiement.deja_scelle')"
              :chargement="envoi"
              @agir="sceller"
            />
          </template>
        </VoileSecret>

        <p class="paiement__borne">
          {{ texte('ecran.paiement.borne') }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.paiement {
  display: flex;
  flex-direction: column;
  /* flex + min-block-size: 0 : reçoit le budget réel de coquille__ecran au
     lieu de pousser son parent à grandir (conseil LLM, responsive). Sans ça,
     .paiement__saisie { margin-block-start: auto } ouvrait un grand vide au
     lieu de compresser quand le contenu dépassait le viewport. */
  flex: 1 1 auto;
  min-block-size: 0;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-gouttiere-ecran);
}

.paiement__titre {
  margin: 0;
  font-size: var(--gdv-role-titre-ecran);
  line-height: var(--gdv-interligne-titre);
}

.paiement__rappel {
  margin: 0;
  font-size: var(--gdv-role-corps);
}

.paiement__saisie {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  margin-block-start: auto;
}

.paiement__libelle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gdv-espacement-8);
  margin: 0;
  font-size: var(--gdv-role-corps);
}

/* Pastille PLEINE, et c'est la règle et non un effet : couleur._regle_jamais_la
   _couleur_seule interdit que public et secret se distinguent par la TEINTE.
   marque-prive appartient à la même famille d'or que accent-action, donc
   l'opposition porte sur le REMPLISSAGE — pastille pleine pour le secret,
   pastille sur surface-secondaire pour le public (.declaration__marque) —
   doublée du libellé persistant « Secret » contre « Visible par tous ».
   L'or passe ici en FOND et non en texte : à role.meta (12 px) il serait de
   toute façon interdit par _regle_or_jamais_en_texte_courant. */
.paiement__marque {
  padding-inline: var(--gdv-espacement-8);
  border-radius: var(--gdv-rayon-pilule);
  background: var(--gdv-marque-prive);
  color: var(--gdv-texte-sur-accent);
  font-size: var(--gdv-role-meta);
  font-weight: var(--gdv-graisse-moyen);
}

.paiement__consequence {
  margin: 0;
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.paiement__borne {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
}
</style>
