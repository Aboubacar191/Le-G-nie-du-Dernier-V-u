// =============================================================================
// CARTOGRAPHIE DE VISIBILITÉ — données de la porte outils/verifier-visibilite.mjs
// =============================================================================
// Ce fichier ne contient QUE des tables : la traduction des jetons
// matrice_visibilite.visible_par vers les classes de destinataire du protocole,
// le rattachement des champs du protocole aux entrées de la matrice, et la liste
// des champs neutres avec leur motif.
//
// Il est séparé des contrôles pour une raison pratique : ces tables sont le seul
// endroit à relire quand la SPEC ou le contrat bougent. Les mélanger aux
// contrôles ferait un fichier que personne n'ouvre.
// =============================================================================

// Traduction des jetons de matrice_visibilite.visible_par vers les classes de
// destinataire du protocole. Table NORMATIVE : un jeton inconnu ferme la porte
// plutôt que d'être ignoré.
// -----------------------------------------------------------------------------
export const CLASSES_CONNUES = ['tous', 'proprietaire', 'enqueteur', 'porteur_clause_et_faiseur', 'hote'];

export const JETON_VERS_CLASSES = [
  ['tous', CLASSES_CONNUES],
  ['serveur', []],
  ['proprietaire', ['proprietaire']],
  ['emetteur', ['proprietaire']],
  ['destinataire', ['proprietaire']],
  ['preteur', ['proprietaire']],
  ['emprunteur', ['proprietaire']],
  ['signataire', ['proprietaire']],
  ['porteur tire au sort', ['porteur_clause_et_faiseur']],
  ['tout faiseur_contrats', ['porteur_clause_et_faiseur']],
  ['enqueteur', ['enqueteur']],
  ['hote', ['hote']],
];

// -----------------------------------------------------------------------------
// CARTOGRAPHIE : entrée de matrice_visibilite → noms de champs du protocole.
// La clé est le libellé EXACT de matrice_visibilite.entrees[].donnee.
// `publication` liste les EvtXxx autorisés à porter la donnée APRÈS le moment
// déclaré par devient_public.
// -----------------------------------------------------------------------------
export const CARTOGRAPHIE = {
  montant_declare: {
    champs: ['montant_declare', 'total_declare', 'declarations', 'nb_declarations'],
    publication: [],
  },
  montant_paye: {
    champs: ['montant_paye', 'paiements_historiques'],
    publication: ['EvtScoresFinaux'],
  },
  solde_pieces: {
    champs: [
      'solde_pieces',
      'solde_apres',
      'solde_initial',
      'pieces_restantes',
      'delta',
      'MouvementPiece.motif',
      'derniers_mouvements',
      'mes_mouvements',
    ],
    publication: ['EvtScoresFinaux'],
  },
  role_secret: { champs: ['role_secret'], publication: ['EvtScoresFinaux'] },
  mission_secrete: {
    champs: ['mission_secrete', 'mission_reussie'],
    publication: ['EvtScoresFinaux'],
  },
  'clause de la manche': {
    champs: [
      'clause',
      'clause_revelee',
      'clause_connue',
      'je_suis_porteur',
      'effet_clause',
      'multiplicateur_applique',
      'consolation_appliquee',
      // total_consolation RETIRÉ ici en même temps que du protocole (RUP-05) :
      // il est désormais déclaré en champs_interdits de l'entrée « total des
      // consolations de la manche ». Le laisser cartographié comme publiable
      // par EvtExecutionResultat aurait AUTORISÉ sa réintroduction, c'est-à-dire
      // la réouverture de ANO-05 — et P9 ferme la porte sur la contradiction.
      'exclu_du_partage',
    ],
    publication: ['EvtExecutionResultat'],
  },
  'identite du porteur de la clause': {
    champs: ['porteur_clause_joueur_id', 'porteur_joueur_id', 'porteur'],
    publication: [],
    _note: 'Jamais en v1 : ces noms de champs ne doivent apparaître dans AUCUN événement.',
  },
  "existence d'une enquête (enquêteur, cible)": {
    champs: ['mes_enquetes_de_la_manche', 'cout_paye', 'cible_joueur_id'],
    publication: [],
  },
  "resultat d'enquête": {
    champs: [],
    publication: [],
    _note:
      'Porté par le champ montant_paye (entrée montant_paye) dans EvtResultatEnquete, ' +
      'de classe enqueteur. Aucun nom de champ propre.',
  },
  'accusation et son verdict': {
    champs: [
      'verdict',
      'accusation_id',
      'accusateur_joueur_id',
      'accuse_joueur_id',
      'a_accuse_cette_manche',
      'accusations',
    ],
    publication: [],
  },
  "montant d'amende liquidé": {
    champs: [
      'montant_liquide',
      'montant_du',
      'amendes_liquidees',
      'debiteur_joueur_id',
      'crediteur_joueur_id',
      'liquidation_differee',
      'reliquat_du',
    ],
    publication: [],
  },
  'montant de consolation individuel': {
    champs: ['montant_consolation', 'consolation_individuelle'],
    // L'entrée de la SPEC ne porte pas de devient_public : lecture littérale,
    // aucun événement de publication. Signalé au tech-lead.
    publication: [],
    _note:
      'RG-74 : plancher(montant_paye / 2) est une fonction directe du paiement secret. ' +
      'Seuls consolation_appliquee et total_consolation (entrée « clause de la manche ») ' +
      'sont publics.',
  },
  // ---------------------------------------------------------------------------
  // QUATRE AGRÉGATS RETIRÉS DU PROTOCOLE PAR L'API 1.2.0 (ADR-TL-21, RUP-05).
  //
  // Ces quatre données n'ont AUCUN champ à cartographier : les champs qui les
  // portaient ont été supprimés des schémas. Une cartographie à `champs: []`
  // les ferait donc passer P3 sans RIEN mesurer — exactement le défaut que
  // l'audit du nœud S6 a sanctionné. Elles se déclarent par `champs_interdits`,
  // dont le contrôle P9 exige l'absence dans TOUS les schémas du contrat, et
  // non dans les seuls EvtXxx : ANO-06 avait un second vecteur, les parts
  // voyageaient aussi dans ResumeManchePublique, un schéma imbriqué.
  //
  // Les noms listés sont ceux qui ont RÉELLEMENT existé dans le protocole,
  // plus leurs variantes orthographiques évidentes : un correctif réintroduit
  // presque toujours le nom d'avant.
  // ---------------------------------------------------------------------------
  'total des consolations de la manche': {
    champs: [],
    publication: [],
    champs_interdits: ['total_consolation', 'total_consolations'],
    _note:
      'RG-81, ANO-05 mesurée : total_paye − 2 × total_consolation = Σ(paye_i mod 2), soit le ' +
      'nombre exact de paiements impairs. Agrégat INVERSIBLE, donc jamais émis sous aucun nom.',
  },
  'part de récompense individuelle': {
    champs: [],
    publication: [],
    champs_interdits: ['parts', 'part', 'part_recompense', 'parts_recompense'],
    _note:
      'RG-81, ANO-06 mesurée : des parts [10,5,5,5,5,5] sous LE_PLUS_GENEREUX désignent ' +
      'l’argmax des paiements secrets. Le joueur apprend sa part par son seul journal de ' +
      'pièces (motif part_recompense de MouvementPiece), qui est couvert par l’entrée ' +
      'solde_pieces : un MOTIF d’énumération n’est pas un champ, et P9 ne contrôle que des ' +
      'noms de propriétés.',
  },
  "reliquat d'arrondi non distribué": {
    champs: [],
    publication: [],
    champs_interdits: ['reliquat_non_distribue', 'reliquat_arrondi'],
    _note:
      'RG-81 : reliquat = recompense − Σ parts. Le publier redonne la somme des parts, donc ' +
      'rouvre ANO-06 par un autre chemin.',
  },
  'total distribué de la manche': {
    champs: [],
    publication: [],
    champs_interdits: ['total_distribue', 'total_distribue_manche'],
    _note:
      'RG-81 : identique au reliquat par complémentarité. Σ poids restreint l’identité du ' +
      'plus gros payeur à l’ensemble des joueurs ayant ce montant déclaré.',
  },
  'ampleur du mensonge': {
    champs: ['ampleur_mensonge'],
    // Idem : la publication à l'écran de scores n'est annoncée que dans le champ
    // justification de l'entrée, pas dans devient_public. Lecture littérale :
    // aucun événement de publication déclaré. Ambiguïté signalée au tech-lead.
    publication: [],
  },
  'transfert de pièces (émetteur, destinataire, montant)': {
    champs: ['emetteur_joueur_id', 'destinataire_joueur_id', 'montant', 'contrepartie_joueur_id'],
    publication: [],
  },
  'pret (preteur, emprunteur, montant)': {
    champs: [
      'pret',
      'pret_id',
      'preteur_joueur_id',
      'emprunteur_joueur_id',
      'principal',
      'du_total',
      'rembourse',
      'montant_propose',
      'montant_preleve',
      'manche_emission',
      'mes_prets',
      'statut',
      'accepte',
    ],
    publication: [],
  },
  'total_paye de la manche': {
    champs: ['total_paye'],
    publication: ['EvtRevelationEcartTotal', 'EvtExecutionResultat'],
  },
  'liste des menteurs de la manche': {
    champs: [],
    publication: [],
    _note:
      'Aucun champ : la liste n’existe dans aucun message. Elle ne transparaît que ' +
      'par les révélations (agrégats) et les accusations (publiques).',
  },
  'signature du Dernier Vœu': {
    champs: ['a_signe_dernier_voeu', 'ma_signature_dernier_voeu', 'nb_signataires'],
    publication: ['EvtDernierVoeuResolu', 'EvtScoresFinaux'],
  },
  'ordre des places dans le cercle': {
    champs: ['ordre_cercle', 'position_cercle'],
    publication: [],
  },
  'pseudo, position, etat de connexion': {
    champs: ['pseudo', 'connecte', 'nb_connectes', 'joueurs', 'joueur', 'moi', 'joueur_id'],
    publication: [],
  },
  // Qualifié (porteur.champ), PAS en forme nue : « pret » nu désigne déjà
  // l'objet prêt embarqué (entrée « pret (preteur, emprunteur, montant) ») dans
  // EvtPretPropose/EvtPretResolu/EvtPretPreleve. Même nom, donnée différente —
  // même mécanisme que MouvementPiece.motif / EvtPartieAbandonnee.motif.
  "statut pret (salle d'attente)": {
    champs: ['JoueurPublic.pret', 'EvtJoueurPretChange.pret'],
    publication: [],
  },
  "jeton_session d'un joueur": {
    champs: ['jeton_session', 'jeton', 'jeton_hote', 'jeton_groupe', 'jeton_session_hache'],
    publication: [],
    _note:
      'Un jeton ne voyage que dans une réponse REST, vers son seul propriétaire. ' +
      'Aucun événement temps réel ne peut en porter un, sous aucun nom.',
  },
};

// -----------------------------------------------------------------------------
// CHAMPS_NEUTRES : noms de champs qui ne portent AUCUNE donnée de la matrice.
// Chaque entrée porte son motif : c'est ce qui empêche d'y ranger un secret
// « pour faire passer la porte ».
// -----------------------------------------------------------------------------
export const CHAMPS_NEUTRES = {
  // Enveloppe, corrélation, erreurs (standards.enveloppe_erreur)
  id_correlation: 'Enveloppe : corrélation commande/réponse, valeur générée par le client.',
  sequence: 'Enveloppe : numéro de séquence par destinataire.',
  code: 'Enveloppe d’erreur : énumération fermée de codes_erreur.',
  message: 'Enveloppe d’erreur : texte français sans donnée secrète.',
  details: 'Enveloppe d’erreur : objet optionnel, jamais de valeur secrète.',
  type_commande: 'Accusé de réception : type de la commande acquittée, connu de son auteur.',
  enregistre: 'Accusé booléen de prise en compte, sans valeur.',
  elements: 'Pagination : page d’éléments.',
  curseur_suivant: 'Pagination : curseur opaque.',
  tronque: 'Pagination : indicateur de troncature.',

  // Identité de session et de groupe (publics par nature)
  session: 'Bloc de l’état de session projeté.',
  session_id: 'Identifiant de session, connu de tous ses joueurs.',
  code_adhesion: 'Code d’adhésion : partagé à voix haute autour de la table.',
  groupe: 'Bloc d’état du groupe, émis au seul hôte (classe hote).',
  groupe_id: 'Identifiant de groupe, émis au seul hôte.',
  parties_terminees: 'Compteur de parties du groupe (US-18), émis au seul hôte.',
  parties_requises: 'Seuil de déblocage du mode avancé, règle du jeu publique.',
  dernier_voeu_debloque: 'Déblocage du mode avancé, règle du jeu publique.',
  compteur_groupe_incremente: 'Indicateur d’incrément du compteur de groupe.',
  est_hote: 'Qualité d’hôte : physiquement évidente autour de la table.',
  mode_avance_actif: 'Mode de jeu de la session, connu de tous.',

  // Machine à états, phases, minuteurs (RG-72 : le serveur est l'unique horloge)
  etat_partie: 'État de partie : public par nature (machine_etats_partie).',
  phase: 'Phase courante : publique par nature (machine_etats_manche).',
  phase_fin_at: 'Fin de phase : minuteur serveur, identique pour toute la table.',
  actions_autorisees: 'Liste des actions ouvertes au destinataire dans la phase.',
  manche_courante: 'Numéro de la manche en cours, public.',
  numero_manche: 'Numéro de manche, public.',
  manche_numero: 'Numéro de manche, public.',
  numero: 'Numéro d’ordre (manche, élément), public.',
  cloture: 'Indicateur de clôture de manche, public.',
  historique_manches: 'Résumés publics des manches closes.',
  nb_joueurs: 'Effectif de la session, public.',
  objectif: 'Objectif de la manche = objectif_par_joueur × nb_joueurs (RG-07), public.',
  reussi: 'Vœu réussi ou non (RG-12), public à l’exécution.',
  recompense: 'Récompense distribuée, publique à l’exécution.',
  // RETRAIT 1.2.0 (ADR-TL-21, RUP-05) — quatre déclarations de neutres supprimées
  // ici parce que les champs qu'elles couvraient ne sont plus publiés par AUCUN
  // EvtXxx : parts, part, reliquat_non_distribue, bonus_epices_verse. La porte a
  // elle-même signalé qu'elles étaient périmées (contrôle P7, 2 divergences), ce
  // qui est exactement son office : « une liste de neutres qui dérive finit par
  // couvrir un champ qui n'existe plus et laisser passer celui qui existe ».
  // NE PAS les réintroduire sans décision d'architecture : les trois premières
  // sont les vecteurs de ANO-06, bloquante et mesurée.
  consequence: 'Conséquence textuelle neutre d’une transition.',

  // Révélations (publiques par construction : c'est leur objet)
  revelation: 'Révélation publique : son contenu est public par construction.',
  revelations: 'Révélations publiques de la manche.',
  gabarit: 'Gabarit de révélation, clé technique publique (RG-25).',
  variante_formulation: 'Index de variante de formulation, rendu par le client (RG-25).',
  cibles: 'Cibles d’une révélation publique.',
  valeurs: 'Valeurs numériques publiques d’une révélation (agrégats uniquement).',
  suspects_restants: 'Nombre de suspects restants (RG-21), public.',

  // Fin de partie
  classement: 'Classement final (RG-58, écran de scores).',
  vainqueurs: 'Vainqueurs (RG-58).',
  rang: 'Rang au classement final (RG-58).',
  score_final: 'Score final (RG-58).',
  genie_libere: 'Libération du génie, résultat public de la partie.',
  victoire_par_liberation: 'Modalité de victoire, publique en fin de partie.',

  // Configuration publique (ARCHI conventions.configuration_de_jeu.exposition :
  // « ce sont les règles du jeu, connues de tous autour de la table »)
  config: 'Configuration publique de la session.',
  joueurs_min: 'Règle du jeu publique.',
  joueurs_max: 'Règle du jeu publique.',
  pieces_initiales: 'Règle du jeu publique.',
  nb_manches: 'Règle du jeu publique.',
  objectif_par_joueur: 'Règle du jeu publique.',
  multiplicateur_recompense: 'Règle du jeu publique.',
  multiplicateur_recompense_tresor_honnetes: 'Règle du jeu publique.',
  multiplicateur_amende: 'Règle du jeu publique.',
  cout_enquete: 'Règle du jeu publique.',
  cout_enquete_inspecteur_tresor: 'Règle du jeu publique.',
  cout_fausse_accusation: 'Règle du jeu publique.',
  accusations_max_par_joueur_par_manche: 'Règle du jeu publique.',
  bonus_mission_reussie: 'Règle du jeu publique.',
  bonus_marchand_epices_par_voeu_reussi: 'Règle du jeu publique.',
  taux_interet_pret: 'Règle du jeu publique.',
  fraction_retenue_genie: 'Règle du jeu publique.',
  fraction_consolation: 'Règle du jeu publique.',
  recompense_signature_dernier_voeu: 'Règle du jeu publique.',
  manche_min_revelation_passe: 'Règle du jeu publique.',
  parties_requises_pour_debloquer_dernier_voeu: 'Règle du jeu publique.',
  durees_phases_s: 'Durées de phases : règle du jeu publique.',
  VOEU: 'Clé de phase dans durees_phases_s.',
  NEGOCIATION: 'Clé de phase dans durees_phases_s.',
  DECLARATION_PAIEMENT: 'Clé de phase dans durees_phases_s.',
  REVELATION: 'Clé de phase dans durees_phases_s.',
  ENQUETES_ACCUSATIONS: 'Clé de phase dans durees_phases_s.',
  EXECUTION: 'Clé de phase dans durees_phases_s.',
  DV_PROPOSITION: 'Clé de phase dans durees_phases_s.',
  DV_DEBAT: 'Clé de phase dans durees_phases_s.',
  DV_SIGNATURE: 'Clé de phase dans durees_phases_s.',

  // Horodatages non secrets
  cree_at: 'Horodatage de création d’un élément déjà visible de son destinataire.',

  // Homonymes : même nom de champ, donnée différente. Forme qualifiée obligatoire.
  'EvtPartieAbandonnee.motif':
    'Motif d’abandon de la partie (ABANDON_HOTE | INACTIVITE_DEPASSEE), énumération ' +
    'publique. Homonyme NON secret de MouvementPiece.motif, qui est un MotifMouvement ' +
    'du journal de pièces et reste strictement privé (CA-36).',
};
