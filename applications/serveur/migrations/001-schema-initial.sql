-- 001 — schéma initial.
--
-- DDL écrit à partir de ARCHI-GDV-001.json / modele_donnees, qui en est la
-- source normative (attributs, types, clés étrangères, index, unicité, CHECK).
--
-- Les contraintes d'intégrité sont gravées EN BASE, pas seulement dans le code :
-- le code a des bugs, la contrainte non. Et RG-41 / RG-42 sont des invariants
-- que le QA doit pouvoir vérifier par une requête, pas par une relecture.
--
-- Les horodatages sont des INTEGER (ms depuis l'époque Unix, UTC) : aucune date
-- locale n'est jamais persistée ni transmise.

CREATE TABLE IF NOT EXISTS groupes (
  id                    TEXT PRIMARY KEY,
  jeton_hote_hache      TEXT NOT NULL UNIQUE,
  parties_terminees     INTEGER NOT NULL DEFAULT 0 CHECK (parties_terminees >= 0),
  dernier_voeu_debloque INTEGER NOT NULL DEFAULT 0 CHECK (dernier_voeu_debloque IN (0, 1)),
  cree_le               INTEGER NOT NULL,
  derniere_activite_le  INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_groupes_jeton ON groupes (jeton_hote_hache);
CREATE INDEX IF NOT EXISTS idx_groupes_activite ON groupes (derniere_activite_le);

CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  code_adhesion     TEXT NOT NULL,
  groupe_id         TEXT NOT NULL REFERENCES groupes (id),
  etat_partie       TEXT NOT NULL CHECK (etat_partie IN
                      ('CREEE','SALLE_ATTENTE','PLACEMENT','DISTRIBUTION','MANCHE_EN_COURS',
                       'DERNIER_VOEU','SCORES','TERMINEE','ABANDONNEE')),
  config_json       TEXT NOT NULL,
  mode_avance_actif INTEGER NOT NULL CHECK (mode_avance_actif IN (0, 1)),
  manche_courante   INTEGER NOT NULL DEFAULT 0 CHECK (manche_courante >= 0),
  phase             TEXT,
  phase_fin_at      INTEGER,
  graine_alea       TEXT NOT NULL,
  genie_libere      INTEGER CHECK (genie_libere IS NULL OR genie_libere IN (0, 1)),
  version_protocole TEXT NOT NULL,
  sequence_journal  INTEGER NOT NULL DEFAULT 0 CHECK (sequence_journal >= 0),
  cree_le           INTEGER NOT NULL,
  termine_le        INTEGER,
  -- termine_le non nul si et seulement si la partie est dans un état terminal
  CHECK (
    (etat_partie IN ('TERMINEE','ABANDONNEE') AND termine_le IS NOT NULL)
    OR (etat_partie NOT IN ('TERMINEE','ABANDONNEE') AND termine_le IS NULL)
  )
) STRICT;

-- Index unique PARTIEL : un code d'adhésion est unique parmi les sessions
-- vivantes seulement, et réutilisable après TERMINEE ou ABANDONNEE. Traite le
-- cas limite « code collisionnant avec une session encore active ».
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_code_vivant
  ON sessions (code_adhesion)
  WHERE etat_partie NOT IN ('TERMINEE', 'ABANDONNEE');

CREATE INDEX IF NOT EXISTS idx_sessions_groupe ON sessions (groupe_id);
CREATE INDEX IF NOT EXISTS idx_sessions_etat ON sessions (etat_partie);
CREATE INDEX IF NOT EXISTS idx_sessions_cree ON sessions (cree_le);

CREATE TABLE IF NOT EXISTS joueurs (
  id                   TEXT PRIMARY KEY,
  session_id           TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  pseudo               TEXT NOT NULL,
  jeton_session_hache  TEXT NOT NULL UNIQUE,
  position_cercle      INTEGER,
  connecte             INTEGER NOT NULL CHECK (connecte IN (0, 1)),
  role_secret          TEXT CHECK (role_secret IS NULL OR role_secret IN
                         ('INSPECTEUR_TRESOR','FAISEUR_CONTRATS','PRETEUR',
                          'MARCHAND_EPICES','MARCHAND_DEJA_LIE')),
  mission_secrete      TEXT CHECK (mission_secrete IS NULL OR mission_secrete IN
                         ('LE_MAGNAT','LE_FAUSSAIRE','LE_JUSTICIER','LE_BATISSEUR',
                          'LE_SABOTEUR','GARDIEN_DE_LA_LAMPE')),
  -- RG-41 garanti aussi par la base, pas seulement par le code
  solde_pieces         INTEGER NOT NULL DEFAULT 0 CHECK (solde_pieces >= 0),
  est_hote             INTEGER NOT NULL CHECK (est_hote IN (0, 1)),
  score_activite       INTEGER NOT NULL DEFAULT 0 CHECK (score_activite >= 0),
  mission_reussie      INTEGER CHECK (mission_reussie IS NULL OR mission_reussie IN (0, 1)),
  score_final          INTEGER,
  ordre_arrivee        INTEGER NOT NULL,
  rejoint_le           INTEGER NOT NULL,
  derniere_activite_le INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_joueurs_pseudo ON joueurs (session_id, pseudo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_joueurs_position
  ON joueurs (session_id, position_cercle) WHERE position_cercle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_joueurs_hote
  ON joueurs (session_id) WHERE est_hote = 1;
CREATE INDEX IF NOT EXISTS idx_joueurs_session ON joueurs (session_id);
CREATE INDEX IF NOT EXISTS idx_joueurs_jeton ON joueurs (jeton_session_hache);
CREATE INDEX IF NOT EXISTS idx_joueurs_connecte ON joueurs (connecte);

CREATE TABLE IF NOT EXISTS clauses (
  cle             TEXT PRIMARY KEY CHECK (cle IN
                    ('GENIE_GARDE_UN_TIERS','TRESOR_DES_HONNETES','LE_PLUS_GENEREUX',
                     'CONSOLATION','PRIME_AU_DELATEUR')),
  effet_type      TEXT NOT NULL,
  parametres_json TEXT NOT NULL,
  etape_pipeline  TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_clauses_effet ON clauses (effet_type);

CREATE TABLE IF NOT EXISTS manches (
  id                       TEXT PRIMARY KEY,
  session_id               TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  numero                   INTEGER NOT NULL CHECK (numero >= 1),
  objectif                 INTEGER NOT NULL CHECK (objectif >= 0),
  clause_cle               TEXT NOT NULL REFERENCES clauses (cle),
  porteur_clause_joueur_id TEXT NOT NULL REFERENCES joueurs (id),
  total_declare            INTEGER,
  total_paye               INTEGER CHECK (total_paye IS NULL OR total_paye >= 0),
  reussi                   INTEGER CHECK (reussi IS NULL OR reussi IN (0, 1)),
  recompense               INTEGER,
  multiplicateur_applique  INTEGER,
  facteur_amende           INTEGER,
  reliquat_non_distribue   INTEGER,
  consolation_appliquee    INTEGER NOT NULL DEFAULT 0 CHECK (consolation_appliquee IN (0, 1)),
  total_consolation        INTEGER,
  bonus_epices_verse       INTEGER NOT NULL DEFAULT 0 CHECK (bonus_epices_verse IN (0, 1)),
  cloture                  INTEGER NOT NULL DEFAULT 0 CHECK (cloture IN (0, 1)),
  cloture_at               INTEGER,
  CHECK ((cloture = 1 AND cloture_at IS NOT NULL) OR (cloture = 0 AND cloture_at IS NULL))
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_manches_numero ON manches (session_id, numero);
-- Impose EN BASE le tirage sans remise des clauses (RG-18 / CA-13)
CREATE UNIQUE INDEX IF NOT EXISTS idx_manches_clause ON manches (session_id, clause_cle);
CREATE INDEX IF NOT EXISTS idx_manches_session ON manches (session_id);
CREATE INDEX IF NOT EXISTS idx_manches_porteur ON manches (porteur_clause_joueur_id);

CREATE TABLE IF NOT EXISTS contributions (
  id              TEXT PRIMARY KEY,
  manche_id       TEXT NOT NULL REFERENCES manches (id) ON DELETE CASCADE,
  joueur_id       TEXT NOT NULL REFERENCES joueurs (id),
  montant_declare INTEGER CHECK (montant_declare IS NULL OR montant_declare >= 0),
  montant_paye    INTEGER,
  declare_at      INTEGER,
  paye_at         INTEGER,
  -- RG-10 : pas de paiement sans déclaration
  CHECK (montant_paye IS NULL OR montant_declare IS NOT NULL),
  -- RG-09 : 0 <= montant_paye <= montant_declare
  CHECK (montant_paye IS NULL OR (montant_paye >= 0 AND montant_paye <= montant_declare))
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_unicite
  ON contributions (manche_id, joueur_id);
CREATE INDEX IF NOT EXISTS idx_contributions_joueur ON contributions (joueur_id);
CREATE INDEX IF NOT EXISTS idx_contributions_declare ON contributions (declare_at);

CREATE TABLE IF NOT EXISTS revelations (
  id                      TEXT PRIMARY KEY,
  manche_id               TEXT NOT NULL REFERENCES manches (id) ON DELETE CASCADE,
  gabarit                 TEXT NOT NULL CHECK (gabarit IN
                            ('ECART_TOTAL','COMPTAGE','VOISINAGE','EXONERATION',
                             'COMPARAISON','PASSE')),
  variante_formulation    INTEGER NOT NULL CHECK (variante_formulation >= 0),
  cibles_json             TEXT NOT NULL,
  valeurs_json            TEXT NOT NULL,
  suspects_restants_apres INTEGER NOT NULL,
  verifiee_vraie          INTEGER NOT NULL,
  emise_at                INTEGER NOT NULL,
  -- RG-20 : une révélation non vérifiée ne peut pas être écrite, donc pas émise
  CHECK (verifiee_vraie = 1),
  -- RG-21 gravé en base : au moins 2 suspects après émission
  CHECK (gabarit = 'ECART_TOTAL' OR suspects_restants_apres >= 2)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_revelations_manche ON revelations (manche_id);
CREATE INDEX IF NOT EXISTS idx_revelations_gabarit ON revelations (gabarit);
CREATE INDEX IF NOT EXISTS idx_revelations_emise ON revelations (emise_at);

CREATE TABLE IF NOT EXISTS enquetes (
  id                    TEXT PRIMARY KEY,
  manche_id             TEXT NOT NULL REFERENCES manches (id) ON DELETE CASCADE,
  enqueteur_joueur_id   TEXT NOT NULL REFERENCES joueurs (id),
  cible_joueur_id       TEXT NOT NULL REFERENCES joueurs (id),
  cout_paye             INTEGER NOT NULL CHECK (cout_paye >= 0),
  resultat_montant_paye INTEGER NOT NULL CHECK (resultat_montant_paye >= 0),
  cree_at               INTEGER NOT NULL,
  -- RG-19 : on n'enquête pas sur soi-même
  CHECK (enqueteur_joueur_id <> cible_joueur_id)
) STRICT;

-- RG-28 : une seule enquête par cible et par manche
CREATE UNIQUE INDEX IF NOT EXISTS idx_enquetes_unicite
  ON enquetes (manche_id, enqueteur_joueur_id, cible_joueur_id);
CREATE INDEX IF NOT EXISTS idx_enquetes_manche ON enquetes (manche_id);
CREATE INDEX IF NOT EXISTS idx_enquetes_enqueteur ON enquetes (enqueteur_joueur_id);
CREATE INDEX IF NOT EXISTS idx_enquetes_cible ON enquetes (cible_joueur_id);

CREATE TABLE IF NOT EXISTS accusations (
  id                      TEXT PRIMARY KEY,
  manche_id               TEXT NOT NULL REFERENCES manches (id) ON DELETE CASCADE,
  accusateur_joueur_id    TEXT NOT NULL REFERENCES joueurs (id),
  accuse_joueur_id        TEXT NOT NULL REFERENCES joueurs (id),
  verdict                 TEXT NOT NULL CHECK (verdict IN ('MENTEUR', 'HONNETE')),
  ampleur_mensonge        INTEGER NOT NULL CHECK (ampleur_mensonge >= 0),
  montant_amende_du       INTEGER NOT NULL CHECK (montant_amende_du >= 0),
  montant_amende_liquide  INTEGER NOT NULL CHECK (montant_amende_liquide >= 0),
  liquide_at              INTEGER,
  cree_at                 INTEGER NOT NULL,
  -- RG-19 : on ne s'accuse pas soi-même
  CHECK (accusateur_joueur_id <> accuse_joueur_id)
) STRICT;

-- RG-19 / CA-24 : une accusation par manche et par accusateur
CREATE UNIQUE INDEX IF NOT EXISTS idx_accusations_unicite
  ON accusations (manche_id, accusateur_joueur_id);
CREATE INDEX IF NOT EXISTS idx_accusations_manche ON accusations (manche_id);
CREATE INDEX IF NOT EXISTS idx_accusations_accuse ON accusations (accuse_joueur_id);
CREATE INDEX IF NOT EXISTS idx_accusations_verdict ON accusations (verdict);

CREATE TABLE IF NOT EXISTS mouvements_pieces (
  id                     TEXT PRIMARY KEY,
  session_id             TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  manche_numero          INTEGER,
  joueur_id              TEXT NOT NULL REFERENCES joueurs (id),
  delta                  INTEGER NOT NULL CHECK (delta <> 0),
  motif                  TEXT NOT NULL CHECK (motif IN
                           ('dotation_initiale','paiement_voeu','part_recompense','bonus_epices',
                            'amende_recue','amende_payee','penalite_fausse_accusation_payee',
                            'penalite_fausse_accusation_recue','cout_enquete','transfert_emis',
                            'transfert_recu','pret_emis','pret_recu','remboursement_pret',
                            'consolation','signature_dernier_voeu','sanction_contrat_conteste')),
  contrepartie_joueur_id TEXT REFERENCES joueurs (id),
  -- RG-41 : dénormalisé pour que RG-42 soit vérifiable par une seule requête
  solde_apres            INTEGER NOT NULL CHECK (solde_apres >= 0),
  sequence               INTEGER NOT NULL CHECK (sequence >= 1),
  cree_at                INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mouvements_sequence ON mouvements_pieces (joueur_id, sequence);
CREATE INDEX IF NOT EXISTS idx_mouvements_session ON mouvements_pieces (session_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_contrepartie ON mouvements_pieces (contrepartie_joueur_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_motif ON mouvements_pieces (motif);
CREATE INDEX IF NOT EXISTS idx_mouvements_manche ON mouvements_pieces (manche_numero);

CREATE TABLE IF NOT EXISTS prets (
  id                   TEXT PRIMARY KEY,
  session_id           TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  preteur_joueur_id    TEXT NOT NULL REFERENCES joueurs (id),
  emprunteur_joueur_id TEXT NOT NULL REFERENCES joueurs (id),
  principal            INTEGER NOT NULL CHECK (principal > 0),
  du_total             INTEGER NOT NULL CHECK (du_total >= 0),
  rembourse            INTEGER NOT NULL DEFAULT 0 CHECK (rembourse >= 0),
  manche_emission      INTEGER NOT NULL,
  statut               TEXT NOT NULL CHECK (statut IN
                         ('PROPOSE','REFUSE','ACTIF','SOLDE','EXPIRE')),
  cree_at              INTEGER NOT NULL,
  repondu_at           INTEGER,
  CHECK (preteur_joueur_id <> emprunteur_joueur_id),
  CHECK (rembourse <= du_total)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_prets_session ON prets (session_id);
CREATE INDEX IF NOT EXISTS idx_prets_preteur ON prets (preteur_joueur_id);
CREATE INDEX IF NOT EXISTS idx_prets_emprunteur ON prets (emprunteur_joueur_id);
CREATE INDEX IF NOT EXISTS idx_prets_statut ON prets (statut);
CREATE INDEX IF NOT EXISTS idx_prets_manche ON prets (manche_emission);

CREATE TABLE IF NOT EXISTS signatures_dernier_voeu (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  joueur_id  TEXT NOT NULL UNIQUE REFERENCES joueurs (id),
  a_signe    INTEGER CHECK (a_signe IS NULL OR a_signe IN (0, 1)),
  cree_at    INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_signatures_session ON signatures_dernier_voeu (session_id);

-- Support du rejeu déterministe (ADR-TL-05). Sans lui, un redémarrage du
-- serveur détruit 30 minutes de jeu en présentiel, ce que la priorité 2
-- interdit. horodatage_serveur est rejoué TEL QUEL : c'est ce qui rend le rejeu
-- indépendant de l'horloge.
CREATE TABLE IF NOT EXISTS journal_commandes (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  sequence           INTEGER NOT NULL CHECK (sequence > 0),
  joueur_id          TEXT REFERENCES joueurs (id),
  type_commande      TEXT NOT NULL,
  charge_json        TEXT NOT NULL,
  id_correlation     TEXT,
  accepte            INTEGER NOT NULL CHECK (accepte IN (0, 1)),
  code_erreur        TEXT,
  horodatage_serveur INTEGER NOT NULL,
  cree_at            INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_sequence ON journal_commandes (session_id, sequence);
-- Base de l'idempotence RG-70 : un id_correlation rejoué rend la réponse d'origine
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_correlation
  ON journal_commandes (joueur_id, id_correlation) WHERE id_correlation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_session ON journal_commandes (session_id);
CREATE INDEX IF NOT EXISTS idx_journal_type ON journal_commandes (type_commande);
