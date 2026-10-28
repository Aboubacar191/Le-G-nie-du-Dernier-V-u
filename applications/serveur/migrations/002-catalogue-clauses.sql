-- 002 — catalogue des clauses (données de référence).
--
-- Les cinq clauses de SPEC-GDV-001.json / catalogue_clauses. Le catalogue est
-- en LECTURE SEULE à l'exécution : les joueurs connaissent les clauses
-- possibles, c'est l'ASSOCIATION clause/manche qui est secrète, et elle vit
-- dans manches.clause_cle.
--
-- parametres_json ne contient AUCUNE valeur d'équilibrage : les rationnels et
-- les multiplicateurs sont lus dans la configuration de session (RG-60, CA-46).
-- Il porte le NOM du paramètre à lire, pas sa valeur.

INSERT INTO clauses (cle, effet_type, parametres_json, etape_pipeline) VALUES
  ('GENIE_GARDE_UN_TIERS', 'RETENUE_SUR_RECOMPENSE',
   '{"fraction":"fraction_retenue_genie"}', '6'),
  ('TRESOR_DES_HONNETES', 'MULTIPLICATEUR_SI_AUCUN_MENTEUR',
   '{"multiplicateur":"multiplicateur_recompense_tresor_honnetes"}', '4'),
  ('LE_PLUS_GENEREUX', 'POIDS_DOUBLE_PLUS_GROS_PAYEUR',
   '{"cas_egalite":"tous_les_ex_aequo"}', '8'),
  ('CONSOLATION', 'REMBOURSEMENT_PARTIEL_SI_ECHEC',
   '{"fraction":"fraction_consolation"}', '11'),
  ('PRIME_AU_DELATEUR', 'AMENDES_DOUBLEES',
   '{"portee":"amendes_et_penalites_de_la_manche"}', '12-14')
ON CONFLICT (cle) DO NOTHING;
