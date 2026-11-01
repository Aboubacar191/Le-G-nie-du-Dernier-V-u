// Boucle de session : reçoit une commande, appelle le moteur, persiste, projette.
//
// L'ordre des quatre temps n'est pas indifférent :
//   1. AUTORISER — c'est le moteur qui tranche, jamais cette couche (RG-71) ;
//   2. PERSISTER — journal et audit dans la même transaction, avant toute
//      émission : un client ne doit jamais voir un effet qui n'a pas survécu ;
//   3. PROJETER  — une projection PAR DESTINATAIRE, par le moteur (ADR-TL-09) ;
//   4. ÉMETTRE   — une trame par destinataire, par envoyerA et par rien d'autre.
//
// Un « événement public » est la BOUCLE de l'étape 3 : trente destinataires,
// trente projections recalculées. Il n'existe aucun objet d'état global.

import type { CodeErreur, TypeCommande } from '@gdv/partage';
import { definirConnexion, projeterEvenement } from '@gdv/moteur';
import type { Effet, EtatSession, Resultat } from '@gdv/moteur';

import type { Depot } from '../persistance/depot.ts';
import type { Diffuseur } from '../temps-reel/diffuseur.ts';
import type { Partie } from './partie.ts';

/** Types de journal réservés aux transitions SANS commande client (CA-50). */
export const TRANSITION_SYSTEME = {
  expirationPhase: 'systeme:expiration_phase',
  cloturePartie: 'systeme:cloture_partie',
  abandonInactivite: 'systeme:abandon_inactivite',
} as const;

export interface ResultatTraitement {
  readonly accepte: boolean;
  readonly code_erreur: CodeErreur | null;
  readonly message: string | null;
}

export class BoucleSession {
  private readonly parties = new Map<string, Partie>();

  private readonly depot: Depot;
  private readonly diffuseur: Diffuseur;
  private readonly maintenant: () => number;

  constructor(depot: Depot, diffuseur: Diffuseur, maintenant: () => number) {
    this.depot = depot;
    this.diffuseur = diffuseur;
    this.maintenant = maintenant;
  }

  inscrire(partie: Partie): void {
    this.parties.set(partie.sessionId, partie);
  }

  partie(sessionId: string): Partie | undefined {
    return this.parties.get(sessionId);
  }

  sessions(): readonly string[] {
    return [...this.parties.keys()];
  }

  /**
   * Projette un effet vers CHAQUE joueur de la session, individuellement, puis
   * émet les N trames en UN LOT (RUP-02).
   *
   * La boucle de projection est inchangée et reste la garantie de RG-01 : N
   * appels à projeterEvenement, N charges recalculées, jamais un objet partagé.
   * Ce qui change, c'est qu'un destinataire hors classe reçoit désormais la
   * CHARGE NEUTRE au lieu de rien — et que les N trames partent avec le même
   * numéro de séquence, la même taille et dans le même tour de boucle.
   *
   * `null` ne signifie plus « pas destinataire » mais « aucune trame ne part » :
   * les trois seuls cas sont un joueur hors session, un effet inapplicable à
   * l'état (personne ne le reçoit, le dénombrement reste donc égal) et les deux
   * exemptions de la liste fermée du contrat.
   */
  private emettre(etat: EtatSession, effets: readonly Effet[], idCorrelation?: string): void {
    for (const effet of effets) {
      const lot: { joueur_id: string; charge: Readonly<Record<string, unknown>> }[] = [];
      for (const joueur of etat.joueurs) {
        const charge = projeterEvenement(etat, effet, joueur.id);
        if (charge === null) continue;
        lot.push({ joueur_id: joueur.id, charge });
      }
      this.diffuseur.envoyerLot(etat.session_id, effet.type, lot, idCorrelation ?? null);
    }
  }

  private journaliser(
    partie: Partie,
    entree: {
      readonly joueur_id: string | null;
      readonly type_commande: string;
      readonly charge: Readonly<Record<string, unknown>>;
      readonly id_correlation: string | null;
      readonly accepte: boolean;
      readonly code_erreur: string | null;
    },
  ): void {
    this.depot.enregistrer(partie.etat, {
      sequence: this.depot.prochaineSequence(partie.sessionId),
      joueur_id: entree.joueur_id,
      type_commande: entree.type_commande,
      charge_json: JSON.stringify(entree.charge),
      id_correlation: entree.id_correlation,
      accepte: entree.accepte,
      code_erreur: entree.code_erreur,
      horodatage_serveur: partie.instantCourant,
    });
  }

  /** Une commande client. Rien n'est émis si le moteur refuse (CA-43). */
  traiterCommande(
    partie: Partie,
    auteur: string,
    type: TypeCommande,
    charge: Readonly<Record<string, unknown>>,
    idCorrelation: string,
  ): ResultatTraitement {
    partie.figerInstant(this.maintenant());
    const resultat = partie.appliquerCommande(type, charge, auteur);
    const compte = this.rendreCompte(resultat);
    this.journaliser(partie, {
      joueur_id: auteur,
      type_commande: type,
      charge,
      id_correlation: idCorrelation,
      accepte: compte.accepte,
      code_erreur: compte.code_erreur,
    });
    if (!resultat.ok) return compte;

    this.emettreAccuse(partie, auteur, type, idCorrelation);
    this.emettre(resultat.etat, resultat.effets);
    this.poursuivre(partie);
    return compte;
  }

  /**
   * Accusé de réception — RUP-02 : émis à TOUS, charge neutre pour les N−1.
   *
   * Sa présence disait « ce joueur a émis une commande dans cette phase ». En
   * phase ENQUETES_ACCUSATIONS, un joueur qui n'a pas accusé publiquement et qui
   * a néanmoins reçu un accusé a enquêté : c'est exactement le bit que RG-27
   * protège. Et c'est l'UN DES TROIS contributeurs du profil 28 contre 25 mesuré
   * par le QA à ANO-02 — les deux autres étant resultat_enquete et
   * solde_mis_a_jour. Uniformiser les deux derniers seuls n'aurait PAS fermé la
   * fuite.
   *
   * L'accusé n'est plus construit à la main ici : il passe par la projection,
   * comme tout le reste. Un second endroit où composer une charge serait un
   * second endroit où oublier la charge neutre.
   */
  emettreAccuse(
    partie: Partie,
    auteur: string,
    type: string,
    idCorrelation: string,
  ): void {
    this.emettre(
      partie.etat,
      [
        {
          type: 'accuse_reception',
          auteur_joueur_id: auteur,
          id_correlation: idCorrelation,
          type_commande: type,
        },
      ],
      idCorrelation,
    );
  }

  /**
   * Refus — RUP-02 : émis à TOUS, hors les cinq codes de protocole, charge
   * neutre pour les N−1.
   *
   * Sa présence disait « ce joueur a TENTÉ un acte, y compris secret, et a été
   * refusé » : SOLDE_INSUFFISANT sur une enquête, QUOTA_DEPASSE sur une seconde
   * enquête. Chacun des refus de jeu peut sanctionner un acte SECRET, et c'est
   * pourquoi la liste des exemptions est si courte.
   *
   * L'exemption n'est pas décidée ici : elle est portée par la projection, qui
   * lit x-emission et la liste fermée du contrat. Cette méthode émet un lot sans
   * savoir si le code est exempté ; si la projection rend null pour tous, le lot
   * est vide et rien ne part — c'est alors au transport d'écrire la trame
   * unitaire.
   */
  emettreRefus(
    partie: Partie,
    auteur: string,
    code: string,
    message: string,
    idCorrelation: string | null,
  ): void {
    this.emettre(
      partie.etat,
      [
        {
          type: 'erreur',
          auteur_joueur_id: auteur,
          code,
          message,
          id_correlation: idCorrelation,
        },
      ],
      idCorrelation ?? undefined,
    );
  }

  /** Expiration d'un minuteur : la seule façon dont le temps fait avancer la partie. */
  traiterExpiration(partie: Partie): void {
    partie.figerInstant(this.maintenant());
    const resultat = partie.expirerPhaseCourante();
    this.journaliser(partie, {
      joueur_id: null,
      type_commande: TRANSITION_SYSTEME.expirationPhase,
      charge: {},
      id_correlation: null,
      accepte: resultat.ok,
      code_erreur: null,
    });
    if (!resultat.ok) return;
    this.emettre(resultat.etat, resultat.effets);
    this.poursuivre(partie);
  }

  /** SCORES → TERMINEE, automatique. Le compteur du groupe est incrémenté ici. */
  private poursuivre(partie: Partie): void {
    const cloture = partie.cloturerSiNecessaire();
    if (!cloture.ok || cloture.effets.length === 0) return;
    this.journaliser(partie, {
      joueur_id: null,
      type_commande: TRANSITION_SYSTEME.cloturePartie,
      charge: {},
      id_correlation: null,
      accepte: true,
      code_erreur: null,
    });
    this.depot.definirPartiesTerminees(
      cloture.etat.groupe.id,
      cloture.etat.groupe.parties_terminees,
    );
    this.emettre(cloture.etat, cloture.effets);
  }

  /** Arrivée d'un joueur : pseudo et état de connexion sont publics. */
  annoncerArrivee(partie: Partie, joueurId: string): void {
    this.emettre(partie.etat, [{ type: 'joueur_rejoint', joueur_id: joueurId }]);
  }

  /** Envoie l'état projeté COMPLET au seul joueur authentifié (RG-73, CA-42). */
  envoyerEtatComplet(partie: Partie, joueurId: string): void {
    this.emettre(partie.etat, [
      { type: 'etat_complet_prive', destinataire_joueur_id: joueurId },
    ]);
  }

  /**
   * Connexion ou déconnexion d'un joueur. L'état de connexion est public
   * (matrice_visibilite) ; la partie continue, le joueur n'est jamais éliminé
   * (RG-46) et ses actions non soumises valent 0 (RG-32).
   *
   * C'est ICI que l'état change, et non dans la couche temps réel : celle-ci
   * CONSTATE un socket ouvert ou fermé, elle ne décide pas de l'état du jeu.
   * La règle de couches de l'ARCHI l'impose — le transport ne touche le moteur
   * que par la projection — et la porte verifier:couches le vérifie.
   */
  signalerPresence(partie: Partie, joueurId: string, connecte: boolean): EtatSession {
    const etat = definirConnexion(partie.etat, joueurId, connecte);
    partie.definirEtat(etat);
    this.depot.synchroniser(etat);
    this.emettre(etat, [
      { type: connecte ? 'joueur_reconnecte' : 'joueur_quitte', joueur_id: joueurId },
    ]);
    return etat;
  }

  private rendreCompte(resultat: Resultat): ResultatTraitement {
    if (resultat.ok) return { accepte: true, code_erreur: null, message: null };
    const erreur = resultat.erreur as { code: CodeErreur; message: string };
    return { accepte: false, code_erreur: erreur.code, message: erreur.message };
  }
}
