# TRANSBORA 045 — synchronisation contrôlée des réponses des artistes

**Périmètre : démonstration locale uniquement, sur le même navigateur et le même domaine.**
Cette mission est empilée sur la liaison du moteur de recherche de la mission 044.

## Parcours

1. Ouvrir Organisation et, dans Événements, ajouter une personne à un événement.
2. Sur la fiche événement, lancer « Rechercher les trajets de cet événement ».
3. Compléter les vraies heures de présence (inconnues du tableau), lancer la recherche réelle GTFS/SNCF.
4. Passer à l'étape 4 et créer **des liens de choix Transbora** pour les artistes. Leur identifiant de proposition d'origine est associé localement à l'itinéraire recherché, sans copier les clés de propriétaire.
5. Utiliser le bouton de retour vers Organisation. Les itinéraires correspondants sont importés dans ce même navigateur, montants inconnus.
6. Faire répondre un artiste au moyen de son lien Transbora. Sa réponse est conservée **dans l'ancien suivi serveur**.
7. Dans l'onglet Événements d'Organisation, cliquer sur **« Récupérer les réponses des artistes »**. Le navigateur lit ponctuellement le dossier à l'aide de sa clé de suivi déjà enregistrée dans « Mes événements ». Il synchronise les choix nº1 et nº2 correspondants dans la démonstration.

## Garanties et limites

- Sans appui sur le bouton, les réponses ne sont **pas** actualisées : aucune synchronisation en arrière-plan.
- Un choix se rattache uniquement lorsque l'identifiant du voyageur ET l'identifiant de la proposition ET la clé de source de la recherche concordent. Aucune correspondance approximative par nom ou par horaire.
- Aucune réponse d'un autre événement n'est importée : titre, date, destination et liaisons doivent correspondre.
- Un choix local saisi manuellement ou un billet déjà déclaré acheté **n'est jamais écrasé** silencieusement. Les conflits sont affichés ; l'organisateur garde le contrôle.
- Les choix « aucun horaire » sont explicitement distingués de l'attente de réponse. Un choix de secours peut être suivi sans double facturation.
- Le statut « acheté » du suivi de l'ancien outil **n'est pas** traité comme un montant payé dans le nouveau budget. Les prix, disponibilités, tarifs liés aux cartes et réservations réelles restent inconnus.
- Les liens propriétaires et leurs clés **restent dans l'historique du suivi existant**. La table de correspondance locale ne garde que des identifiants internes et des clés de proposition ; le registre local ne garde que les sélections. Aucune API de l'espace privé n'est sollicitée en mode démonstration.
- Il faut utiliser le même navigateur ; un changement de sous-domaine ou un autre appareil ne retrouve pas automatiquement les correspondances.
- Cette fonction n'importe pas automatiquement des dossiers historiques sans association de recherche. Ne pas utiliser de données personnelles réelles dans l'atelier de démonstration.

## Validation

- Tests des réponses via la véritable API de choix existante dans tests/native-choices.test.mjs.
- Tests de la correspondance, de l'idempotence, des conflits et de la confidentialité dans tests/organizer-replies-045.test.mjs.
- Test DOM de la demande explicite de rafraîchissement dans tests/organizer-replies-ui-045.test.mjs.
- CI GitHub : tests hors ligne + validation des flux de transport.

## Évolutions après validation visuelle

- Montrer un récapitulatif explicite de chaque réponse sur les fiches événements sans changer les données de billet.
- Lors d'un futur passage au véritable espace collaboratif, prévoir une association et un contrôle d'accès serveur adaptés, sans réutiliser tel quel ce pont local.
