<script setup lang="ts">
// ECR-06 — Salle d'attente (RG-02, CA-02). Montrer qui est entré, et rendre la
// condition de démarrage LISIBLE sans la deviner.
//
// Le bouton de démarrage reste VISIBLE et désactivé pour l'hôte, avec sa raison
// chiffrée : le masquer laisserait l'hôte chercher ce qui manque.
//
// Rien n'est encore distribué : aucun rôle, aucune mission, aucun solde. Cet
// écran n'a donc aucun secret à protéger, et c'est pour cela qu'il n'a aucun
// voile — le contraste avec les écrans suivants est pédagogique.
//
// ÉTATS (DESIGN ECR-06)
// chargement   : squelette de 5 lignes de joueurs, aux dimensions des cartes.
// contenu      : marque + QR/code pour l'hôte (ÉCRAN 1 du prototype, montré en
//                permanence, plus besoin d'un détour par ECR-04), compteur
//                « n / max », liste des connectés, et pour l'hôte le bouton de
//                démarrage.
// vide         : l'hôte seul n'est PLUS un état à part — la liste à un élément
//                ET le QR déjà affiché suffisent, rien à déclarer séparément.
// erreur       : un joueur perdu passe en carte déconnectée et le bandeau dit
//                l'effectif restant ; échec de démarrage hors de [min, max].
// acces_refuse : jeton invalide, redirection vers ECR-32 par le magasin.
//
// ÉCRAN 1 DU PROTOTYPE (vue hôte) — la marque (lampe, titre, accroche), le
// QR/code avec « Partager le lien », l'en-tête « Marchands autour de la
// table » suivi du compte « n / max », la grille à numéros d'arrivée
// (jamais position_cercle, NUL avant PLACEMENT — RG-06) et l'encart
// pointillé du mode avancé en reprennent la présentation.
//
// ÉCRAN 1b DU PROTOTYPE (vue invité) — composants/VueInviteAttente.vue : nom
// de la table de l'hôte, statistiques de la partie, liste à statuts et
// bascule « Je suis prêt », purement informative (CA-02 inchangée).
//
// Le numéro de connexion n'a plus sa place en tête ici dans aucune des deux
// vues : BandeauPhase (app.vue) la porte déjà globalement.

import { computed, ref } from 'vue';

import BandeauAlerte from '../composants/BandeauAlerte.vue';
import BoiteInvitationQr from '../composants/BoiteInvitationQr.vue';
import BoutonAction from '../composants/BoutonAction.vue';
import DialogueConfirmationIrreversible from '../composants/DialogueConfirmationIrreversible.vue';
import GrilleJoueursAttente from '../composants/GrilleJoueursAttente.vue';
import MarqueSalleAttente from '../composants/MarqueSalleAttente.vue';
import SqueletteChargement from '../composants/SqueletteChargement.vue';
import VueInviteAttente from '../composants/VueInviteAttente.vue';
import { texte } from '../logique/contenu.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

const magasin = utiliserMagasin();
const confirmerAbandon = ref(false);

interface Bornes {
  readonly min: number;
  readonly max: number;
}

const bornesEffectif = computed((): Bornes => {
  const config = magasin.etat.session?.config as
    | { joueurs_min?: number; joueurs_max?: number }
    | undefined;
  return { min: config?.joueurs_min ?? 0, max: config?.joueurs_max ?? 0 };
});

const connectes = computed(() => magasin.etat.joueurs.filter((joueur) => joueur.connecte));
const nbConnectes = computed(() => connectes.value.length);
const hote = computed(() => magasin.etat.moi?.est_hote === true);
const chargement = computed(() => magasin.etat.joueurs.length === 0);

const effectifSuffisant = computed(
  () =>
    nbConnectes.value >= bornesEffectif.value.min &&
    nbConnectes.value <= bornesEffectif.value.max,
);

const raisonDemarrage = computed(() =>
  texte('ecran.salle_attente.demarrer_desactive', {
    min: bornesEffectif.value.min,
    max: bornesEffectif.value.max,
  }),
);

const code = computed(
  () => magasin.etat.session?.code_adhesion ?? magasin.codeAdhesionPrerempli(),
);

const nomHote = computed(
  () => magasin.etat.joueurs.find((joueur) => joueur.est_hote)?.pseudo ?? '',
);

const moiPret = computed(() =>
  magasin.etat.joueurs.some(
    (joueur) => joueur.joueur_id === magasin.etat.moi?.joueur_id && joueur.pret,
  ),
);

interface ConfigPartieAffichee {
  readonly nb_manches?: number;
  readonly pieces_initiales?: number;
  readonly durees_phases_s?: Readonly<Record<string, number>>;
}

const configAffichee = computed(
  () => magasin.etat.session?.config as ConfigPartieAffichee | undefined,
);
const nbManches = computed(() => configAffichee.value?.nb_manches ?? null);
const piecesDepart = computed(() => configAffichee.value?.pieces_initiales ?? null);
const negociationS = computed(() => configAffichee.value?.durees_phases_s?.NEGOCIATION ?? null);

function togglerPret(pret: boolean): void {
  magasin.envoyer('signaler_pret', { pret });
}

function abandonner(): void {
  magasin.envoyer('abandonner_partie', { confirmation: true });
  confirmerAbandon.value = false;
}
</script>

<template>
  <main class="attente">
    <BandeauAlerte
      v-if="magasin.etat.alerte !== null"
      :variante="magasin.etat.alerte.variante"
      :cle-contenu="magasin.etat.alerte.cle_contenu"
      :valeurs="magasin.etat.alerte.valeurs"
    />

    <SqueletteChargement
      v-if="chargement"
      :lignes="5"
      hauteur="var(--gdv-hauteur-carte-joueur)"
      :libelle="texte('commun.chargement')"
    />

    <template v-else-if="hote">
      <BoutonAction
        class="attente__fermer"
        :libelle="texte('ecran.salle_attente.fermer_salle')"
        variante="secondaire"
        taille="md"
        @agir="confirmerAbandon = true"
      />

      <MarqueSalleAttente />

      <BoiteInvitationQr :code="code" />

      <GrilleJoueursAttente
        :joueurs="magasin.etat.joueurs"
        :moi-id="magasin.etat.moi?.joueur_id ?? ''"
        :hote="hote"
        :n="nbConnectes"
        :max="bornesEffectif.max"
      />

      <div class="attente__mode-avance">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="4"
            y="9"
            width="12"
            height="8"
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M7 9V6a3 3 0 0 1 6 0v3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <span>{{ magasin.etat.session?.mode_avance_actif
          ? texte('ecran.salle_attente.mode_avance_actif')
          : texte('ecran.salle_attente.mode_avance_inactif') }}</span>
      </div>

      <footer class="attente__pied">
        <BoutonAction
          :libelle="texte('cercle.fixer_places')"
          variante="principal"
          taille="lg"
          pleine-largeur
          :desactive="!effectifSuffisant"
          :raison="raisonDemarrage"
          @agir="magasin.envoyer('demarrer_partie')"
        />
      </footer>
    </template>

    <VueInviteAttente
      v-else
      :joueurs="magasin.etat.joueurs"
      :moi-id="magasin.etat.moi?.joueur_id ?? ''"
      :code="code"
      :nom-hote="nomHote"
      :nb-manches="nbManches"
      :negociation-s="negociationS"
      :pieces-depart="piecesDepart"
      :moi-pret="moiPret"
      @quitter="magasin.quitter()"
      @toggler-pret="togglerPret"
    />

    <DialogueConfirmationIrreversible
      v-if="confirmerAbandon"
      :titre="texte('ecran.abandon.confirmer_titre')"
      :corps="texte('ecran.abandon.confirmer_corps')"
      :libelle-confirmer="texte('action.abandonner_partie')"
      :libelle-renoncer="texte('commun.renoncer')"
      @confirmer="abandonner"
      @renoncer="confirmerAbandon = false"
    />
  </main>
</template>

<style scoped>
.attente {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-12);
  /* Reçoit le budget réel de coquille__ecran au lieu de le dépasser : voir
     EcranPaiementSecret.vue pour la justification complète. */
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--gdv-gouttiere-ecran);
  background: var(--gdv-surface-fond);
  color: var(--gdv-texte-principal);
}

.attente__mode-avance {
  display: flex;
  align-items: center;
  gap: var(--gdv-espacement-12);
  padding: var(--gdv-espacement-12) var(--gdv-espacement-16);
  border: var(--gdv-trait-fin) dashed var(--gdv-bordure-champ);
  border-radius: var(--gdv-rayon-moyen);
  color: var(--gdv-texte-secondaire);
}

.attente__mode-avance svg {
  inline-size: var(--gdv-espacement-16);
  block-size: var(--gdv-espacement-16);
  flex-shrink: 0;
}

.attente__mode-avance span {
  font-size: var(--gdv-role-meta);
}

.attente__pied {
  display: flex;
  flex-direction: column;
  gap: var(--gdv-espacement-24);
  margin-block-start: auto;
}

.attente__fermer {
  align-self: flex-start;
}
</style>
