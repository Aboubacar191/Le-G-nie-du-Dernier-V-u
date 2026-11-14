<script setup lang="ts">
// ECR-10 / ECR-12 — Annonce du vœu puis négociation, UN SEUL écran continu
// (US-12, RG-77, mesure M7-a). Fidélité maquette (conseil LLM, 2026-11-14) :
// la maquette affiche l'annonce et les outils de négociation sur un écran
// unique, avec un bandeau de temps commun ; l'app les séparait en deux
// composants pour deux phases serveur minutées (VOEU 20 s, NEGOCIATION
// 120 s). Les DEUX PHASES RESTENT DISTINCTES ET MINUTÉES côté serveur —
// seul l'AFFICHAGE est fusionné : ce composant change de contenu interne au
// changement de phase, sans démontage ni remontage, et le bandeau de phase
// (app.vue) continue de porter le seul minuteur, déjà commun aux deux.
//
// Risque vérifié avant fusion (conseil LLM) : VOEU est « SANS action de
// joueur » (ci-dessous) — aucun bouton n'existe pendant VOEU, donc rien ne
// peut basculer sous le doigt d'un joueur à la frontière des 20 s. Fusionner
// l'affichage n'introduit donc aucune confusion d'état : la négociation
// AJOUTE des actions, elle n'en remplace aucune.
//
// POINT CRITIQUE — RG-77, mesure M7-a. L'écran ne doit pas permettre de déduire
// qui porte la clause. La carte « Le pli du génie » est donc rendue
// INCONDITIONNELLEMENT, à la même place et au même instant chez tous les
// joueurs, dans un état masqué identique, PENDANT LES DEUX PHASES. Sous
// maintien, elle affiche soit la clause, soit « Aucun pli ne t'a été confié
// cette manche ».
//
// C'est légitime sans information supplémentaire du serveur : une clause est
// tirée à CHAQUE manche par règle (RG-18), donc l'existence d'un pli n'est pas
// une donnée à transmettre. Seul son DESTINATAIRE est secret, et c'est
// exactement ce que le masquage identique protège.
//
// Un voisin qui observe l'écran masqué n'apprend rien. Il n'y a aucun badge,
// aucun compteur, aucune variation d'apparence liée à la réception.
//
// NÉGOCIATION — ORALE. L'application n'est ici qu'un REGISTRE de transferts et
// de prêts : il n'y a pas de messagerie. Pendant VOEU, aucune de ces actions
// n'est montrée (rien à négocier avant l'annonce) ; dès que la phase passe à
// NEGOCIATION, le rappel oral et les boutons apparaissent SOUS la carte du
// pli, qui elle ne bouge pas.
//
// ANTI-FUITE : le bouton « Proposer un prêt » n'existe que chez le PRETEUR
// (RG-29), et un voisin pourrait en déduire le rôle. Mitigation retenue par le
// contrat de conception : il est placé DANS la feuille de transfert, en seconde
// option, et jamais sur l'écran de fond. L'écran au repos est donc identique
// pour tous.
//
// ÉTATS (DESIGN ECR-10 / ECR-12)
// chargement   : bulle en chargement, objectif en squelette de largeur fixe,
//                minuteur à deux tirets — jamais un zéro.
// contenu      : bandeau de phase, parole du génie au centre du cercle avec
//                l'objectif en grand, carte de pli voilée inconditionnelle ;
//                en négociation, rappel oral et actions de registre en pied.
// vide         : NON atteignable — la phase VOEU publie toujours un objectif,
//                et l'état vide de la négociation (aucun transfert) renvoie
//                explicitement à la conversation orale, qui EST l'action
//                attendue — pas un trou, une consigne.
// erreur       : annonce non reçue, bulle en erreur ; transfert refusé affiché
//                dans un bandeau public SANS aucun montant (M6).
// acces_refuse : jeton invalide, ECR-32 ; non-PRETEUR tentant un prêt — l'échec
//                propose l'action équivalente autorisée, le transfert simple.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import BulleGenie from '../composants/BulleGenie.vue';
import CercleDesPlaces from '../composants/CercleDesPlaces.vue';
import VoileSecret from '../composants/VoileSecret.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';
import EcranPropositionPret from './EcranPropositionPret.vue';
import EcranReponsePret from './EcranReponsePret.vue';
import EcranTransfert from './EcranTransfert.vue';

const magasin = utiliserMagasin();

const feuilleTransfert = ref(false);
const feuillePret = ref(false);
const feuilleReponsePret = ref(false);

const voeu = computed(() => magasin.etat.voeu);
const etatBulle = computed(() => (voeu.value === null ? 'chargement' : 'repos'));
const enNegociation = computed(() => magasin.etat.phase === 'NEGOCIATION');

const clause = computed(() => magasin.etat.clause_recue?.clause ?? null);
/** Clé de rendu : tout changement de manche remasque le pli (mesure M3). */
const clePhase = computed(() => `${magasin.etat.numero_manche ?? 0}-${magasin.etat.phase ?? ''}`);

const hote = computed(() => magasin.etat.moi?.est_hote === true);
/** Le rôle n'est connu que de son porteur : la condition est locale et privée. */
const preteur = computed(() => magasin.etat.moi?.role_secret === 'PRETEUR');

// ECR-15 : la pastille d'appel ne nomme JAMAIS le prêteur (RG-29) — sa seule
// présence suffit à dire « une proposition t'attend », le détail est sous
// voile dans la feuille elle-même.
const propositionRecue = computed(() =>
  magasin.etat.prets.some(
    (pret) => pret.statut === 'PROPOSE' && pret.emprunteur_joueur_id === magasin.etat.moi?.joueur_id,
  ),
);
</script>

<template>
  <section class="voeu">
    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <CercleDesPlaces
      :joueurs="magasin.etat.joueurs"
      :ordre="[...magasin.etat.ordre_cercle]"
      :moi="magasin.etat.moi?.joueur_id ?? ''"
      variante="lecture"
      :declarations="magasin.etat.declarations"
    >
      <template #centre>
        <BulleGenie
          variante="annonce"
          :etat="etatBulle"
          :phrase="voeu === null ? '' : texte('ecran.voeu.annonce', { objectif: voeu.objectif })"
        />
      </template>
    </CercleDesPlaces>

    <p
      v-if="voeu !== null"
      class="voeu__objectif"
    >
      <span class="voeu__etiquette">{{ texte('ecran.voeu.objectif_libelle') }}</span>
      <span class="voeu__nombre">{{ voeu.objectif }}</span>
    </p>

    <!-- Règle générique, vraie à CHAQUE manche : n'indique rien sur la clause
         de celle-ci, donc sans risque pour M7. -->
    <p
      v-if="voeu !== null"
      class="voeu__regle"
    >
      {{ texte('ecran.voeu.partage_regle') }}
    </p>

    <!-- Rendue SANS CONDITION, pendant les DEUX phases : c'est la mesure
         M7-a. Ne jamais remplacer ce composant par un v-if sur `clause` ni
         sur `enNegociation` — ce serait rouvrir la fuite. -->
    <VoileSecret
      variante="lecture"
      :intitule="texte('ecran.voeu.pli_du_genie')"
      :cle-phase="clePhase"
    >
      <template #secret>
        <span class="voeu__pli">
          {{ clause === null ? texte('ecran.voeu.aucun_pli') : texte(`clause.${clause}`) }}
        </span>
        <!-- Le masquage extérieur reste inconditionnel (M7-a) ; une fois la
             fenêtre ouverte, le conseil ne s'affiche que pour qui a une
             clause à jouer — ce choix n'est visible que du joueur lui-même. -->
        <span
          v-if="clause !== null"
          class="voeu__pli-conseil"
        >
          {{ texte('ecran.voeu.pli_conseil') }}
        </span>
      </template>
    </VoileSecret>

    <!-- Négociation : AJOUTÉE sous la carte du pli, qui ne bouge pas. Rien
         n'est actionnable pendant VOEU (ci-dessus) : cette section n'existe
         pas encore, elle n'en REMPLACE jamais une autre. -->
    <template v-if="enNegociation">
      <p class="voeu__rappel-oral">
        {{ texte('ecran.negociation.rappel_oral') }}
      </p>

      <footer class="voeu__pied">
        <!-- Neutre, SANS nom de prêteur (RG-29) : voir le commentaire sur
             propositionRecue. -->
        <BoutonAction
          v-if="propositionRecue"
          :libelle="texte('ecran.pret.pastille')"
          variante="secondaire"
          taille="md"
          pleine-largeur
          @agir="feuilleReponsePret = true"
        />

        <BoutonAction
          :libelle="texte('ecran.negociation.transferer')"
          variante="principal"
          taille="lg"
          pleine-largeur
          @agir="feuilleTransfert = true"
        />

        <!-- Seule commande d'avance de phase autorisée, et seulement en
             NEGOCIATION. En variante secondaire et en pied, loin de l'action
             courante : une avance accidentelle coûterait 120 s à huit personnes. -->
        <BoutonAction
          v-if="hote"
          :libelle="texte('ecran.negociation.passer_suite')"
          variante="secondaire"
          taille="md"
          @agir="magasin.envoyer('avancer_phase')"
        />
      </footer>
    </template>

    <!-- Aucun élément conditionné par `clause` au-delà du CONTENU de la
         fenêtre de lecture : un libellé d'aide, une pastille ou un compteur
         qui n'apparaîtrait que chez le porteur le désignerait au voisin
         (M7-c). Les feuilles ci-dessous restent DANS la racine unique de ce
         composant (convention de l'application) : une racine fragmentée
         empêcherait app.vue de lui transmettre sa classe de coquille. -->
    <EcranTransfert
      v-if="feuilleTransfert"
      :preteur="preteur"
      @fermer="feuilleTransfert = false"
      @proposer-pret="feuilleTransfert = false; feuillePret = true"
    />

    <EcranPropositionPret
      v-if="feuillePret"
      @fermer="feuillePret = false"
    />

    <EcranReponsePret
      v-if="feuilleReponsePret"
      @fermer="feuilleReponsePret = false"
    />
  </section>
</template>

<style scoped>
.voeu {
  display: flex;
  flex-direction: column;
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  gap: var(--gdv-espacement-16);
  padding: var(--gdv-gouttiere-ecran);
}

.voeu__objectif {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gdv-espacement-4);
  margin: 0;
}

.voeu__etiquette {
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-etiquette);
}

.voeu__nombre {
  font-family: var(--gdv-famille-chiffres);
  font-size: var(--gdv-role-nombre-principal);
  font-variant-numeric: var(--gdv-chiffres-variant);
}

.voeu__regle {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-align: center;
}

/* M4 — le secret est lu DANS la lucarne de secret.largeur_fenetre_lecture par
   secret.hauteur_fenetre_lecture, et il n’y est PAS rapetissé pour y entrer :
   « on réduit l’empreinte physique et l’angle utile, pas la lisibilité ».
   role.corps est le plancher de lecture mobile (role._regle_mobile) ; ce qui
   dépasse défile dans la lucarne, qui ne se dilate plus. */
.voeu__pli {
  font-family: var(--gdv-famille-interface);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.voeu__pli-conseil {
  display: block;
  margin-block-start: var(--gdv-espacement-8);
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-corps);
  text-align: center;
}

.voeu__rappel-oral {
  margin: 0;
  color: var(--gdv-texte-secondaire);
  font-size: var(--gdv-role-meta);
  text-align: center;
}

.voeu__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}
</style>
