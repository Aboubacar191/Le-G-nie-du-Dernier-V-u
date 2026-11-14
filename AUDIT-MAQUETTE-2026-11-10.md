# Audit de fidélité — maquette vs application réelle

Référence : `Le Génie du Dernier Vœu — Prototype mobile.html`, 33 écrans.

Légende :
- ✅ **Conforme** — correspond à la maquette, ou diverge pour une raison de sécurité déjà démontrée dans le code (jamais à « corriger » vers la maquette).
- 🔒 **Décision prise** — écart réel, tranché avec sa justification écrite ci-dessous.

**Clôture (2026-11-14)** : les 14 points laissés ouverts le 2026-11-10 (8 corrections, 6 décisions) sont tous résolus — la plupart l'avaient déjà été par des sessions intermédiaires, vérifié ligne à ligne contre le code réel avant de les classer ✅ dans cette révision. Les deux derniers (durée de partie, format du code) ont été tranchés le 2026-11-14 pendant l'audit de sécurité RG-24/RG-27 (voir commits « RG-24 » et « duree_s »).

---

## Groupe A — Accueil (écrans 1 à 6)

**1. Lancement** — ✅ conforme (badge, titre, accroche, effectif).

**2. Bienvenue** — ✅ conforme. Libellé « Ton pseudo » (`ecran.creation.libelle_pseudo`) ; aide « 14 caractères maximum. Tu pourras le changer plus tard. » (`ecran.creation.aide_pseudo`), identique à la maquette.

**3. Accueil** — ✅ conforme (parcours A→B→C dans ECR-01, carte « Créer » dorée comme la maquette — décision déjà prise sur demande explicite).

**4-6. Règles en 3 étapes** — ✅ conforme à 100 % (`fr.json` clés `ecran.regles.*`).

---

## Groupe B — Créer / Rejoindre / Salle d'attente (écrans 7 à 11)

**7. Créer une partie** — ✅ conforme.

**8. Salle d'attente, vue hôte** — ✅ conforme. Écran de placement dédié (ECR-07) CONSERVÉ comme étape séparée, mais le réordonnancement lui-même est fidèle à la maquette (« Glisse pour réordonner ») depuis un arbitrage ultérieur au 2026-11-10 : `ReordonneurJoueurs.vue` porte le geste par pointer events (fiable au tactile, contrairement à l'API HTML5 Drag and Drop) AVEC deux boutons Monter/Descendre toujours visibles pour le clavier — les deux reproches qui avaient fait écarter le glisser-déposer sont traités, pas contournés. 🔒 Format de code CONSERVÉ : voir décision générale en fin de document.
⚠️ **Trouvé le 2026-11-14, pas encore résolu** : `ReordonneurJoueurs.vue` déborde lourdement à 8 marchands — mesuré à 1207px de contenu contre 432-708px de budget visible selon l'appareil (iPhone SE à iPhone 13/14), soit jusqu'à ~500px d'écart même sur un téléphone courant. Le filet de secours (défilement de toute la coquille) fonctionne et le bouton « Valider l'ordre » reste atteignable, mais ce n'est pas le scroll scopé visé. Risque identifié avant toute correction : confiner le défilement à la seule liste (comme pour `GrilleJoueursAttente.vue`, corrigé le même jour) imposerait un conteneur à défilement interne SANS auto-scroll pendant le glissement — readapté au clavier (Monter/Descendre) mais pas forcément au doigt près du bord. Décision à prendre avant de coder : accepter le filet de secours tel quel, ou investir dans un auto-scroll pendant le glissement (plus risqué, à tester en interaction réelle, pas seulement par mesure).

**9. Rejoindre une partie** — ✅ conforme (EcranRejoindre.vue : pseudo absent sauf arrivée directe par lien/QR sans Bienvenue ; flèche retour présente).

**10. Salle d'attente, vue invité** — ✅ conforme.

**11. Mon identité secrète** — ✅ conforme. Titre « Ton identité », bandeau « Avant la manche 1 » + solde de départ, bouton « J'ai mémorisé, masquer » (`ecran.attribution.*`).

---

## Groupe C — Déroulé d'une manche (écrans 12-17, réutilisés en 25-30)

**12/25. Annonce du vœu** — ✅ conforme. Fusionné avec la négociation en un seul écran continu (C1, conseil LLM 2026-11-14, `EcranAnnonceVoeu.vue`).

**13/26. Offrande / déclaration** — ✅ archi conforme (paiement sous voile, jamais en clair — CA-10, plus sûr que la maquette) + les trois phrases pédagogiques sont présentes (`gap_garde`, `amende_risque`, `fausse_accusation_rapport`).

**14. Offrande scellée** — ✅ conforme (C3, conseil LLM 2026-11-14) : statut public « Scellé/Réfléchit… » via `afficherStatutScelle` sur `ListeDeclarationsPubliques.vue`, découplé du tri.

**15/27. Révélation du génie** — ✅ conforme.

**16/21/28. Enquêtes, fiche « Enquêter sur Awa »** — ✅ tranché : fiche non reproduite littéralement (fuiterait le rôle Inspecteur du Trésor), contenu de réassurance repris sous voile.

**17/30. Exécution du vœu** — ✅ conforme. « Vœu exaucé » / « Vœu refusé » (`ecran.execution.reussi`/`echoue`).

**23/24. Accuser / Fausse accusation** — ✅ conforme (affichage différé à l'EXÉCUTION pour protéger PRIME_AU_DÉLATEUR, ADR-CP-06).

---

## Groupe D — Panneaux superposés (écrans 18-20, 22)

**18. Panneau Moi** — ✅ conforme (`EcranMonOr.vue`, voile M6).

**19. Donner des pièces** — ✅ conforme.

**20. Offre de prêt** — ✅ conforme.

**22. Résultat d'enquête** — ✅ conforme (sous voile, M8).

---

## Groupe E — Dernier Vœu (écran 32)

✅ **Écart structurel volontaire, confirmé toujours en vigueur** (2026-11-14) : séparation en DV_PROPOSITION / DV_DEBAT / DV_SIGNATURE maintenue. `EcranDvSignature.vue` tire la position des boutons Signer/Refuser au hasard, par joueur et par partie (RG-77, mesure M7-b : « la fuite la plus facile du jeu »). Rien à corriger.

---

## Groupe F — Fin de partie (écrans 31, 33)

**31. Manches 3 à 5** — ✅ confirmé : outil de présentation du prototype, pas un écran à construire.

**33. Fin de partie** — ✅ conforme, trois points résolus :
- Dévoilement : TOUT visible d'emblée comme la maquette (`TableauScores.vue`, RG-58 — « aucune section n'est repliée ni à dévoiler »), pas de bouton de révélation progressive.
- Résumé global : `{exauces} vœu(x) exaucé(s) sur {total}` + `{nombre} mensonge(s) démasqué(s) cette partie` — deux comptages PUBLICS seulement, jamais un total de mensonges non démasqués (RG-75 : ce total n'existe nulle part).
- Durée de partie : « Fin de partie · {minutes} min » (`scores.duree_partie`), ajoutée le 2026-11-14 — `duree_s` publié par `EvtScoresFinaux` (`scores_calcules_le − cree_le`, moteur), collectif donc sans fuite individuelle.

---

## Décisions générales, tranchées le 2026-11-14

**Format du code de partie (`ZAF-482` vs l'actuel 6 caractères mixtes)** — 🔒 **CONSERVÉ, pas de changement.**
La maquette montre 3 lettres + tiret + 3 chiffres. Le format actuel (`securite/jetons.ts`, `creerCodeAdhesion`) tire 6 caractères indépendants dans un alphabet unique de 32 symboles sans ambiguïté (ni I, ni O, ni 0, ni 1 — pensé pour la lecture à voix haute), soit 32⁶ ≈ 1,07 milliard de combinaisons (~30 bits). Scinder en 3 lettres (24 symboles) + 3 chiffres (8 symboles) comme la maquette réduirait l'espace à 24³ × 8³ ≈ 7,08 millions (~23 bits) — un facteur ~151, soit une perte réelle de résistance au tirage/devinage du code d'adhésion, qui est un mécanisme de contrôle d'accès, pas un simple affichage. Une limitation de débit existe déjà (`securite/limitation-debit.ts`, QUOTA_ADHESION) mais c'est une défense, pas une raison d'en affaiblir une autre : le format maquette n'est pas repris. L'alphabet actuel servait déjà l'intention de la maquette (code court, lisible à voix haute) par un autre moyen, plus sûr.

**Pseudo modifiable plus tard** — 🔒 promesse tenue dans le texte (« Tu pourras le changer plus tard. »), la fonction elle-même reste une tâche future distincte (mémoire projet : page hors-partie de changement de pseudo).
