# Le Génie du Dernier Vœu

Prototype d'un jeu de table **en présentiel**, arbitré par un serveur. Chaque joueur a son
téléphone ; le serveur est le génie, et il est le seul à connaître les secrets.

Contrats de référence, dans `.claude/orchestration/contrats/` — ils font foi, le code non :

| Fichier | Rôle |
|---|---|
| `SPEC-GDV-001.json` | règles de gestion, critères d'acceptation, matrice de visibilité |
| `ARCHI-GDV-001.json` | pile technique, modèle de données, standards, **seuils de qualité** |
| `API-GDV-001.json` | protocole REST + temps réel (OpenAPI 3.1) |

La règle maîtresse est **RG-01** : aucun message sortant ne contient une donnée dont le
destinataire n'est pas propriétaire, et il n'existe **aucun message d'état global diffusé à
tous**. Tout message est une projection calculée pour un destinataire unique.

---

## Prérequis

* Node.js **24.18.1** (voir `.nvmrc`). Le projet utilise `node:sqlite` et l'exécution
  directe de TypeScript par le runtime : une version inférieure ne suffit pas.
* npm 11 (fourni avec Node 24).
* Rien d'autre. Aucune compilation native, aucun service externe.

## Installer

```bash
npm install          # ou : npm run installer
```

Mono-repo **npm workspaces**, quatre paquets :

```
paquets/partage        @gdv/partage   contrats : protocole, énumérations, configuration
paquets/moteur         @gdv/moteur    MOTEUR PUR : déterministe, sans E/S, sans horloge
applications/serveur   @gdv/serveur   transport, persistance, sécurité — zéro règle de jeu
applications/client    @gdv/client    PWA Vue 3 — affiche la projection reçue, ne calcule rien
```

## Lancer

```bash
npm run dev           # serveur + client ensemble
npm run dev:serveur   # http://127.0.0.1:8443  — sonde : /sante
npm run dev:client    # http://127.0.0.1:5173
npm run construire    # tsc pour partage/moteur/serveur, vite build + service worker pour le client
```

Configuration par l'environnement : copier `.env.exemple` en `.env` (ignoré par git).
**Aucun secret n'est versionné, ni placé dans une image.** En `MODE=production`, le serveur
**refuse de démarrer** sans `CHEMIN_CERT` et `CHEMIN_CLE` : `https://` et `wss://` sont
obligatoires en toute circonstance, playtest sur réseau local compris — un jeton de session
écouté en clair donne accès aux secrets de son propriétaire.

## Vérifier

```bash
npm run verifier      # enchaîne les portes ci-dessous et S'ARRÊTE À LA PREMIÈRE FERMÉE
```

| Porte | Commande | Ce qu'elle refuse de laisser passer |
|---|---|---|
| secrets | `npm run secrets` | un secret en dur ; un fichier sensible non ignoré par git |
| visibilité | `npm run verifier:visibilite` | une divergence entre `x-visibilite` de l'API et `matrice_visibilite` de la SPEC ; un champ de message non classé |
| types | `npm run types` | `tsc --noEmit` sur les quatre paquets, strict + `noUncheckedIndexedAccess` |
| lint | `npm run lint` | `Math.random`, `Date`, `crypto`, `process`, un `import node:` ou un nombre magique **dans le moteur** ; une primitive de diffusion dans la couche temps réel ; complexité > 10, fonction > 50 lignes, imbrication > 3, fichier > 300 lignes |
| couches | `npm run verifier:couches` | le moteur qui importe autre chose que `@gdv/partage` ; le client qui importe le moteur ou le serveur ; le transport qui court-circuite `moteur/src/projection` |
| tests | `npm run test` | `node:test` sur les quatre paquets |
| couverture | `npm run couverture` | moteur < 95 % (lignes **et** branches), `moteur/projection` < 100 %, global < 70 % — seuils **lus** dans l'ARCHI |
| audit | `npm run audit` | une vulnérabilité haute ou critique |

Les seuils ne sont écrits nulle part dans la configuration : `eslint.config.mjs` et
`outils/verifier-couverture.mjs` les **lisent** dans `ARCHI-GDV-001.json`. Modifier un seuil
se fait dans le contrat, par le tech-lead, ou pas du tout.

Chaque porte **échoue avec un code de sortie non nul** ; aucune ne se contente d'avertir.
Chacune a été vue en échec sur une violation volontaire (voir
`.claude/orchestration/contrats/SCAFFOLD-GDV-001.json`, section `portes_qualite`).

### La porte de visibilité, en détail

`outils/verifier-visibilite.mjs` est l'instrument qui rend la non-fuite **vérifiable
mécaniquement** plutôt que déclarative. Il confronte les 30 schémas `EvtXxx` du protocole aux
21 entrées de `matrice_visibilite` et ferme la porte si :

* une annotation `x-visibilite`, `x-destinataires` ou `x-justification-visibilite` manque ;
* un message de classe `tous` porte une donnée qui n'est pas visible de tous — sauf s'il est
  l'événement de publication déclaré par `devient_public` ;
* une donnée réservée au serveur apparaît dans un message, à n'importe quelle classe ;
* une donnée réservée à l'enquêteur ou au porteur de clause sort vers une autre classe ;
* **un champ du contrat n'est pas classé** : chaque nom de champ doit être rattaché à une
  entrée de la matrice ou déclaré neutre avec son motif dans
  `outils/visibilite/cartographie.mjs`. C'est ce contrôle qui attrape la fuite introduite par
  un champ ajouté six mois plus tard.

## État du squelette

Ce dépôt est un **squelette** : il ne contient aucune logique de jeu. Les fichiers d'amorce
portent leur signature et le nœud qui les remplira (S4 pour le moteur et le serveur, S5 pour
le client). Deux portes sont donc **légitimement fermées** à ce stade et le resteront jusqu'à
la livraison du moteur :

* **couverture** — le moteur n'a pas de code, donc 0 % : la porte ferme, comme elle le doit ;
* **audit** — Zod 3.x, imposé par l'ARCHI, porte une vulnérabilité haute
  (`GHSA-mrhx-c7xc-m3w5`, corrigée en 4.6.6) alors que l'ARCHI tolère 0 haute. Arbitrage du
  tech-lead requis : monter en Zod 4, ou inscrire la dette avec sa date.

Le reste de la chaîne — secrets, visibilité, types, lint, couches, tests — passe.
