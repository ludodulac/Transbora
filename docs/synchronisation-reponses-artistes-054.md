# TRANSBORA — Mission 054 : choix des artistes automatiquement visibles par Jeanne

## Usage fonctionnel

1. Jeanne ouvre un **événement existant** dans TRANSBORA, avec ses artistes inscrits.
2. Elle recherche les horaires depuis ce même événement. Les propositions sont enregistrées dans le dossier organisateur.
3. Elle crée un lien collectif ou des liens individuels. Le lien comprend des horaires par sens (aller et retour).
4. Chaque artiste marque obligatoirement son **choix nº 1**, et peut marquer un **choix nº 2** différent, puis confirme.
5. Dès qu'un choix est envoyé, il est répercuté dans l'espace privé de l'organisatrice, dans **Réponses**, dans le dossier du voyageur et dans le suivi du mois.
6. Si cette mise à jour instantanée échoue, le tableau organisateur effectue une réconciliation en l'ouvrant, en affichant Réponses, au retour sur la page et toutes les 30 secondes tant qu'elle reste visible.

Le classement nº 3 n'est **pas** implémenté : la sélection actuelle est « nº 1 » et « nº 2 (facultatif) ».

## Réalisation

- Le moteur de recherche existant conserve les vraies propositions d'horaires et les associe au bon événement et au bon artiste.
- L'écran de partage de l'assistant de recherche, dans le mode privé, permet désormais réellement d'accéder à l'étape 4 et de créer les liens du groupe ou individuels.
- L'iframe de recherche transmet les informations de liaison uniquement au parent sur **la même origine**. Le parent transmet directement au service authentifié.
- Ce service associe le dossier de réponses natif à l'événement de Jeanne après vérification de l'identité du dossier, des personnes, des options et de la clé privée de propriétaire du lien.
- La clé de propriétaire est conservée **uniquement dans le stockage privé du serveur**, jamais dans les listes JSON, les sauvegardes organisateur ou la réponse renvoyée au navigateur.
- Les choix nº 1 et nº 2 sont mis à jour dans l'enregistrement privé `choice`, avec `origin: native`. Aucune réservation de train, dépense ou paiement n'est créé par une préférence.
- Le moteur public appelle le synchroniseur après chaque véritable soumission d'artiste. Cette notification n'est exécutée sur le stockage privé **que pour le site principal** : aucun déploiement de prévisualisation ne peut y écrire.
- La synchronisation est idempotente : un nouveau contrôle ne crée pas plusieurs choix identiques.
- Les choix modifiés manuellement dans le tableau ou accompagnés d'un billet déjà payé ne sont pas écrasés silencieusement ; un conflit est signalé.
- La prévisualisation locale utilise ses anciens liens de propriétaire présents dans le navigateur et récupère aussi les réponses à l'ouverture/automatiquement, sans exposer les identifiants privés d'équipe.

## Vérifications

- Tests d'intégration serveur : `tests/organizer-native-auto-sync-054.test.mjs`.
- Scénarios couverts : lien authentique, rejet de proposition forgée, refus avant enregistrement des horaires, soumission nº1/nº2, ordre inversé, pas d'achat artificiel, non-divulgation de la clé, idempotence, préservation d'un choix manuel, réparation d'une notification manquée.
- Régressions : `tests/organizer-replies-045.test.mjs`, `tests/workspace-shared-048.test.mjs`, `tests/organizer-ui-simplification-053.test.mjs`.
- Prévisualisation Netlify : le build bloque si les tests spécifiés échouent.

## État de publication

La PR #45 reste **DRAFT**. Le site public principal n'est pas modifié. L'espace privé ne s'active que sur l'hôte canonique et sous connexion authentifiée, après configuration sécurisée et autorisation de publication. La fonction « direct depuis le téléphone de l'artiste vers le tableau partagé » ne doit pas être annoncée comme *déployée en production* tant que cette étape et un essai sur deux appareils ne sont pas passés.

Les choix d'artistes sont indépendants de l'achat réel des billets. Les horaires restent indicatifs, sans prix ni places garanties.