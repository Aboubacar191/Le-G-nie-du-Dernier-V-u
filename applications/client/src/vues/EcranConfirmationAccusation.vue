<script setup lang="ts">
// ECR-21 — Confirmation d'accusation (US-10, RG-19, CA-22 à CA-24).
//
// Dernier garde-fou avant un acte public, irréversible et limité à un par
// manche.
//
// Le dialogue annonce le RISQUE encouru (cout_fausse_accusation, valeur de
// configuration publique) mais JAMAIS le gain potentiel chiffré : celui-ci
// dépendrait de l'ampleur du mensonge, qui est une donnée secrète à ce stade.
// Le montant de l'amende à venir n'est pas annoncé non plus — sa liquidation
// est différée à l'EXECUTION pour ne pas divulguer la clause PRIME_AU_DELATEUR
// (ADR-CP-06).
//
// Le focus initial porte « Renoncer », jamais l'acte destructeur.
//
// ÉTATS (DESIGN ECR-21)
// chargement   : bouton destructeur en chargement, dialogue non fermable pour
//                éviter la double soumission (RG-70).
// contenu      : titre nommant la conséquence, corps chiffrant le risque, deux
//                actions séparées de 24, focus initial sur Renoncer.
// vide         : non atteignable.
// erreur       : quota déjà consommé ; phase expirée pendant le dialogue, qui
//                se ferme de lui-même — jamais de soumission silencieuse.
// acces_refuse : accusation de soi-même — non atteignable, la carte est
//                non sélectionnable en amont.

import { computed, ref } from 'vue';

import DialogueConfirmationIrreversible from '../composants/DialogueConfirmationIrreversible.vue';
import { texte } from '../logique/contenu.ts';
import { pseudoDe } from '../magasin/etat.ts';
import { utiliserMagasin } from '../magasin/injection.ts';

interface Props {
  accuseJoueurId: string;
}

const props = defineProps<Props>();
const emettre = defineEmits<{ fermer: [] }>();

const magasin = utiliserMagasin();
const envoi = ref(false);

const pseudo = computed(() => pseudoDe(magasin.etat, props.accuseJoueurId));
const phaseExpiree = computed(() => magasin.etat.phase !== 'ENQUETES_ACCUSATIONS');

const cout = computed((): number => {
  const config = magasin.etat.session?.config as { cout_fausse_accusation?: number };
  return config?.cout_fausse_accusation ?? 0;
});

const erreur = computed((): string =>
  magasin.etat.moi?.a_accuse_cette_manche === true ? texte('ecran.accusation.quota') : '',
);

function accuser(): void {
  envoi.value = true;
  magasin.envoyer('accuser', { accuse_joueur_id: props.accuseJoueurId });
  envoi.value = false;
  emettre('fermer');
}

function expirer(): void {
  magasin.signaler({
    variante: 'avertissement',
    cle_contenu: 'ecran.accusation.phase_expiree',
    valeurs: {},
  });
  emettre('fermer');
}
</script>

<template>
  <DialogueConfirmationIrreversible
    :titre="texte('ecran.accusation.titre', { pseudo })"
    :corps="texte('ecran.accusation.corps', { pseudo, cout })"
    :libelle-confirmer="texte('ecran.accusation.accuser')"
    :libelle-renoncer="texte('commun.renoncer')"
    :chargement="envoi"
    :erreur="erreur"
    :phase-expiree="phaseExpiree"
    @confirmer="accuser"
    @renoncer="emettre('fermer')"
    @expirer="expirer"
  />
</template>
