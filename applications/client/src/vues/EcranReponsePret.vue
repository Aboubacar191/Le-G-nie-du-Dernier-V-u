<script setup lang="ts">
// ECR-15 — Réponse à une proposition de prêt, EMPRUNTEUR.
//
// Accepter ou refuser en connaissant le coût du remboursement AVANT de
// s'engager : les deux montants sont dans le voile, lisibles sous maintien.
//
// RÈGLE D'INTERRUPTION : la feuille ne s'ouvre PAS d'elle-même. Elle s'annonce
// par une pastille et s'ouvre au contact. Une feuille qui surgit pendant une
// phase de 30 s ferait manquer la fenêtre à l'emprunteur.
//
// La proposition arrive dans une FEUILLE et non en bandeau : un bandeau
// persistant est public par construction (M6), et le montant est secret.
//
// ÉTATS (DESIGN ECR-15)
// chargement   : voile en chargement, montants en squelette.
// contenu      : sous maintien, « X te prête N, tu lui devras M ». Deux boutons.
// vide         : aucune proposition — la feuille n'est pas atteignable, et la
//                pastille d'appel est absente.
// erreur       : proposition expirée (phase terminée) ; refus serveur à
//                l'acceptation, le prêteur n'a plus l'or promis.
// acces_refuse : proposition adressée à un autre joueur — non atteignable,
//                aucune route n'expose une proposition dont on n'est pas
//                destinataire.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import EtatVide from '../composants/EtatVide.vue';
import FeuilleModale from '../composants/FeuilleModale.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const emettre = defineEmits<{ fermer: [] }>();

const magasin = utiliserMagasin();
const envoi = ref(false);

/** Seules les propositions dont JE suis l'emprunteur existent pour cet écran. */
const proposition = computed(() =>
  magasin.etat.prets.find(
    (pret) =>
      pret.statut === 'PROPOSE' && pret.emprunteur_joueur_id === magasin.etat.moi?.joueur_id,
  ) ?? null,
);

const expiree = computed(() => magasin.etat.phase !== 'NEGOCIATION');

/** Taux PUBLIC de la configuration de session — un pourcentage, pas une règle. */
const pourcentageInteret = computed((): number | null => {
  const config = magasin.etat.session?.config as { taux_interet_pret?: readonly number[] };
  const taux = config?.taux_interet_pret;
  if (taux === undefined || taux.length !== 2) return null;
  const [numerateur, denominateur] = taux as readonly [number, number];
  if (denominateur === 0) return null;
  return Math.round((numerateur / denominateur) * 100);
});

function repondre(accepte: boolean): void {
  if (proposition.value === null) return;
  envoi.value = true;
  magasin.envoyer('repondre_pret', { pret_id: proposition.value.pret_id, accepte });
  envoi.value = false;
  emettre('fermer');
}
</script>

<template>
  <FeuilleModale
    :titre="texte('ecran.pret.titre_repondre')"
    ouverte
    @fermer="emettre('fermer')"
  >
    <EtatVide
      v-if="proposition === null"
      :titre="texte('ecran.pret.expiree')"
      :action-libelle="texte('commun.fermer')"
      @agir="emettre('fermer')"
    />

    <EtatVide
      v-else-if="expiree"
      :titre="texte('ecran.pret.expiree')"
      :action-libelle="texte('commun.fermer')"
      @agir="emettre('fermer')"
    />

    <template v-else>
      <BandeauAlerte
        v-if="magasin.etat.alerte !== null"
        :variante="magasin.etat.alerte.variante"
        :cle-contenu="magasin.etat.alerte.cle_contenu"
        :valeurs="magasin.etat.alerte.valeurs"
      />

      <!-- Le prêteur, le principal et le dû sont TOUS secrets : l'identité du
           prêteur révélerait son rôle (RG-29). -->
      <VoileSecret
        variante="lecture"
        :intitule="texte('ecran.pret.titre_repondre')"
      >
        <template #secret>
          <span class="reponse__montants">
            {{ texte('ecran.pret.proposition', {
              preteur: pseudoDe(magasin.etat, proposition.preteur_joueur_id),
              principal: proposition.principal,
              du_total: proposition.du_total,
            }) }}
          </span>
        </template>
      </VoileSecret>

      <p
        v-if="pourcentageInteret !== null"
        class="reponse__interets"
      >
        {{ texte('ecran.pret.interets_regle', { pourcentage: pourcentageInteret }) }}
      </p>

      <BoutonAction
        :libelle="texte('ecran.pret.accepter')"
        variante="principal"
        taille="lg"
        pleine-largeur
        :chargement="envoi"
        @agir="repondre(true)"
      />
      <BoutonAction
        :libelle="texte('ecran.pret.refuser')"
        variante="secondaire"
        taille="md"
        pleine-largeur
        :chargement="envoi"
        @agir="repondre(false)"
      />
    </template>
  </FeuilleModale>
</template>

<style scoped>
/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.reponse__montants {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.reponse__interets {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-align: center;
}
</style>
