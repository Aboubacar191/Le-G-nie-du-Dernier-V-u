# Audit de fidélité — maquette vs application réelle

Référence : `Le Génie du Dernier Vœu — Prototype mobile.html`, 33 écrans, inchangé depuis le 2026-11-09 21:41 (vérifié par taille/horodatage avant cet audit).

Légende :
- ✅ **Conforme** — correspond à la maquette, ou diverge pour une raison de sécurité déjà démontrée dans le code (jamais à « corriger » vers la maquette).
- 🔧 **À corriger** — écart simple, sans enjeu de sécurité ni de judgment call : je peux le faire dès que tu valides la liste.
- ❓ **Décision requise** — écart réel mais qui n'est pas un simple oubli : il faut trancher avant que je code quoi que ce soit.

---

## Groupe A — Accueil (écrans 1 à 6)

**1. Lancement** — ✅ conforme (badge, titre, accroche, effectif : identiques).

**2. Bienvenue** — 🔧 + ❓
- 🔧 Le libellé du champ est « Ton pseudo » dans la maquette, « Ton nom de marchand » dans l'app (clé `ecran.creation.libelle_pseudo`, réutilisée aussi par Créer/Rejoindre).
- ❓ La maquette annonce « 14 caractères maximum. **Tu pourras le changer plus tard.** » ; l'app dit « 12 caractères au maximum, pour que ta carte reste lisible » et ne permet pas de rechanger le pseudo. Si je copie la maquette telle quelle, j'introduis une promesse fausse (aucune fonction de modification n'existe). Deux options : (a) j'aligne le texte sur l'app actuelle (pas de promesse), (b) tu veux vraiment une fonction « changer son pseudo plus tard » et je la construis. Je recommande (a) sauf si tu tiens à (b).

**3. Accueil** — ✅ conforme (déjà corrigé en session précédente : « · débloqué », texte conditionnel). Écart assumé et documenté dans le code : carte « Créer » dorée comme la maquette (contrairement à un choix Von Restorff antérieur) — décision déjà prise sur ta demande explicite, rien à changer.

**4-6. Règles en 3 étapes** — ✅ conforme à 100 %. J'ai comparé chaque phrase (`fr.json` clés `ecran.regles.*`) mot pour mot contre la maquette : identiques, y compris les exemples chiffrés (annonce 4 / paye 1) et les noms (Inspecteur du Trésor, Le Justicier).

---

## Groupe B — Créer / Rejoindre / Salle d'attente (écrans 7 à 11)

**7. Créer une partie** — ✅ conforme (déjà corrigé : pseudo retiré, réglages fusionnés, flèche retour, CTA renommé).

**8. Salle d'attente, vue hôte** — ❓ deux écarts structurels, pas des détails
- ❓ **Modèle d'interaction** : la maquette réordonne les places par **glisser-déposer directement dans la liste d'attente**, avec un seul bouton « Invoquer le génie » qui démarre tout. L'app sépare en deux écrans : salle d'attente (juste le décompte de connectés) puis un écran de placement dédié (ECR-07) où l'hôte touche chaque nom dans l'ordre pour l'asseoir. Le code documente pourquoi : « le glisser-déposer a été écarté d'emblée : plus coûteux, fragile au tactile, inutilisable au clavier ». Ce n'est pas une question de sécurité, c'est de l'accessibilité — je recommande de garder le modèle actuel, mais c'est ton choix.
- ❓ **Format du code de partie** : la maquette montre `ZAF-482` (3 lettres, un tiret, 3 chiffres) ; l'app génère des codes à 6 caractères alphanumériques sans tiret (ex. `53664U`). Changer ça touche le format serveur (génération du code), pas juste l'affichage — je veux ton feu vert avant d'y toucher.

**9. Rejoindre une partie** — 🔧
- Le champ pseudo ne doit pas apparaître ici (la maquette ne montre que le champ code — le pseudo vient de l'étape Bienvenue). C'est exactement la règle que tu as donnée pour l'écran Créer ; je ne l'avais pas appliquée à Rejoindre.
- Vérifier la présence d'une flèche de retour vers l'accueil (présente dans la maquette, absente du composant actuel).

**10. Salle d'attente, vue invité** — ✅ conforme (ajouté cette session : QR, grille arrivée, liste « Je suis prêt »).

**11. Mon identité secrète** — 🔧
- Titre : maquette dit « Ton identité », l'app dit « Ton pli » (clé `ecran.attribution.titre`).
- Manque l'en-tête « Avant la manche 1 » et le solde de départ affiché en haut (« 12 pièces ») — cette valeur est publique (config de la partie), rien à cacher.
- Bouton : maquette « J'ai mémorisé, masquer », app « J'ai lu, je suis prêt ».

---

## Groupe C — Déroulé d'une manche (écrans 12-17, réutilisés en 25-30)

**12/25. Annonce du vœu** — ✅ conforme (bulle, objectif, pli du génie masqué inconditionnellement — exactement la mesure anti-fuite M7-a documentée).

**13/26. Offrande / déclaration** — ✅ archi conforme + 🔧 texte manquant
- ✅ La maquette montre « ce que tu annonces » et « ce que tu paies » sur le **même écran, en clair tous les deux**. L'app les sépare en deux écrans (déclaration publique sans voile, puis paiement sous voile) parce que le paiement ne doit JAMAIS apparaître en clair (CA-10). C'est plus sûr que la maquette, je ne reviens pas dessus.
- 🔧 Trois phrases pédagogiques de la maquette sont absentes de l'app, et elles sont sans danger à ajouter (ce sont des conséquences publiques du choix du joueur, pas un secret d'autrui) : « Tu gardes {gap} pièce(s) pour toi », « Si tu es démasqué : amende de {fine} pièces et part perdue », « Une fausse accusation contre toi te rapporterait 2 pièces ».
- Note de vocabulaire : la maquette dit « offrande », l'app dit « promesse » partout. Pas d'action nécessaire sauf si tu préfères unifier sur un des deux mots.

**14. Offrande scellée** — ❓
- La maquette montre, pour CHAQUE marchand, un statut public « Scellé » ou « Réfléchit… ». Ce champ n'existe pas dans le protocole actuel, et le code le dit explicitement : « aucun événement du protocole ne publie cette information, et je n'en invente pas ». L'ajouter demande un nouveau champ public (`a_paye: boolean` par joueur) — travail de protocole, pas juste d'écran. Je ne le fais pas sans ton accord, et il faut vérifier que ça ne fuit rien (qui a scellé vite pourrait, par exemple, trahir un rôle si certains rôles paient plus vite — à vérifier avant de l'ajouter).

**15/27. Révélation du génie** — ✅ conforme (écart total public, une révélation du catalogue au plus, rien n'est déduit par l'app).

**16/21/28. Enquêtes et accusations, fiche « Enquêter sur Awa »** — ✅ déjà tranché cette session : la fiche de confirmation n'est pas reproduite littéralement (elle fuiterait le rôle Inspecteur du Trésor et ajouterait un 3ᵉ contact dans une fenêtre de 60 s) ; le contenu de réassurance de la maquette est déjà repris mot pour mot sous le voile.

**17/30. Exécution du vœu** — 🔧
- Maquette : « Vœu refusé » / « Vœu exaucé ». App : « Vœu échoué » / « Vœu réussi » (clés `ecran.execution.echoue`/`reussi`). Changement de vocabulaire simple et sûr, cohérent avec le ton « génie qui exauce des vœux » du reste du jeu.

**23/24. Accuser / Fausse accusation** — ✅ conforme. La maquette montre le résultat (montant du mensonge, qui paie qui) immédiatement après l'accusation ; l'app diffère cet affichage jusqu'à l'EXÉCUTION pour protéger la clause PRIME_AU_DÉLATEUR (ADR-CP-06, déjà démontré dans une session précédente). Pas un oubli, une décision de sécurité déjà prise.

---

## Groupe D — Panneaux superposés (écrans 18-20, 22)

**18. Panneau Moi** — ✅ conforme. La maquette affiche les montants en clair (normal, c'est une maquette statique) ; l'app les place sous un voile unique à maintien (M6). Rôle + mission regroupés sous un seul voile côté app contre deux cartes séparées côté maquette — différence mineure de mise en page, sans enjeu, je ne touche pas sauf si tu veux les séparer visuellement.

**19. Donner des pièces** — ✅ conforme (déjà audité, transfert immédiat et visible seulement des deux parties, comme la maquette le décrit).

**20. Offre de prêt (côté emprunteur)** — ✅ conforme (déjà corrigé cette session : pastille neutre + feuille de réponse, taux d'intérêt affiché).

**22. Résultat d'enquête** — ✅ conforme. Maquette : montant en clair. App : sous voile (M8 — même l'enquêteur ne doit pas exposer son résultat d'un regard). Contenu identique, juste protégé.

---

## Groupe E — Dernier Vœu (écran 32)

❓ **Écart structurel majeur, déjà volontaire et documenté**
La maquette montre **un seul écran** : règles + proposition + choix Signer/Refuser. L'app le sépare en **trois phases distinctes** :
- DV_PROPOSITION (lecture seule, 20 s)
- DV_DEBAT (lecture seule, 60 s, discussion orale)
- DV_SIGNATURE (10 s, choix sous voile avec les boutons Signer/Refuser **à une position tirée au hasard par joueur**)

La raison est dans le code : si « Signer » est toujours à la même position, un voisin déduit le choix du joueur rien qu'en regardant quel côté de l'écran il touche (mesure M7-b — « la fuite la plus facile du jeu »). Je recommande fortement de garder cette séparation. Rien à corriger ici sauf si tu veux explicitement revenir à un écran unique (ce qui rouvrirait la fuite).

---

## Groupe F — Fin de partie (écrans 31, 33)

**31. Manches 3 à 5** — ✅ confirmé : le texte même de la maquette dit « le prototype les résume ici » — c'est un outil de présentation, pas un écran à construire.

**33. Fin de partie** — ❓ + 🔧
- ❓ La maquette affiche rôles/missions/paiements **directement visibles** dans le tableau. L'app les cache derrière des boutons « Dévoiler les rôles / missions / paiements » qu'il faut toucher un par un. Le code dit que c'est voulu pour rythmer la conversation de fin de partie, pas pour la sécurité (cet écran est justement celui où TOUT sort). C'est donc un vrai choix UX à trancher, pas un oubli : veux-tu tout visible d'emblée comme la maquette, ou garder le dévoilement progressif ?
- 🔧 La maquette affiche la durée de la partie (« Fin de partie · 27 min ») — absente de l'app, et la donnée (horodatage de création/fin de session) existe déjà côté serveur.
- 🔧 La maquette affiche un résumé global (« 7 mensonges cette partie, dont 3 démasqués. 4 vœux exaucés sur 5. ») — à vérifier si ces totaux sont calculables à partir de ce que le protocole transporte déjà, sinon c'est un ajout plus lourd (nouveau champ agrégé).

---

## Résumé pour la suite

**🔧 À corriger, sans attendre (8 points)** : écrans 2 (libellé), 9 (retirer pseudo + vérifier retour), 11 (titre, bandeau solde départ, libellé bouton), 13/26 (3 phrases pédagogiques), 17/30 (vocabulaire exaucé/refusé), 33 (durée de partie).

**❓ Décisions à prendre avant tout code (6 points)** :
1. Pseudo modifiable plus tard — vrai feature ou je retire la promesse ?
2. Glisser-déposer vs écran de placement dédié (accessibilité).
3. Format du code de partie (`ZAF-482` vs `53664U`) — touche le serveur.
4. Statut public « scellé / réfléchit » par joueur — nouveau champ protocole, à vérifier pour fuite.
5. Dévoilement progressif des scores finaux vs tout visible d'emblée.
6. Résumé global de fin de partie (mensonges/vœux) — vérifier si calculable sans nouveau champ.

Dis-moi comment trancher les 6 points, et je commence les 8 corrections directes en parallèle.
