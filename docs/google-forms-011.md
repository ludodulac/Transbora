# Mission 011 — Export Google fonctionnel, gares visibles et création des formulaires en un clic

## Pourquoi l'ancienne version ouvrait le mauvais écran

Le bouton « Ouvrir Google Sheets » pointait par défaut vers `drive.google.com/drive/u/0/my-drive`, c'est-à-dire **la racine de Drive**, car le site public ne connaît pas automatiquement quel tableau privé utiliser. Copier un tableau dans le presse-papier **ne crée pas un Google Sheet** et **ne déclenche pas** la création des Google Forms.

**Correction** : le lien doit être configuré une fois dans le navigateur. Sans configuration, l'application affiche maintenant « Configurer Google » au lieu de quitter Transbora vers la racine de Drive. Le lien du fichier personnel reste exclusivement dans le stockage local du navigateur, **pas dans GitHub**.

## Deux modes au choix

### A. Création directe (recommandée après installation sur ordinateur)

Cette méthode supprime les trois manipulations de copier-coller à chaque événement.

1. Dans votre [Google Sheet Transbora privé](https://drive.google.com/drive/u/0/my-drive), ouvrez **Extensions → Apps Script** (de préférence sur ordinateur).
2. Remplacez le contenu du projet **Code.gs** par le fichier [Code.gs de Transbora](../integrations/google-forms/Code.gs). Enregistrez.
3. Revenez au Google Sheet et actualisez. Dans le menu **Transbora → Vérifier les feuilles**, vérifiez la présence des onglets ; cette étape associe votre identifiant de tableau au script.
4. Dans l'éditeur Apps Script, **Déployer → Nouveau déploiement → Application Web**.
5. Configurer **Exécuter en tant que : Moi**, **Qui a accès : Moi uniquement**. ⚠️ Ne choisissez **jamais** « Tout le monde » : cette application permet de créer des fichiers dans votre Drive.
6. Confirmer les autorisations Google, puis copier l'**URL d'application Web** se terminant par `/exec`.
7. Dans Transbora, étape 4 → **Configurer Google**, coller **l'URL du Google Sheet privé** et **l'URL de l'application Web privée**. Cliquer **Enregistrer**.

**Utilisation ensuite :** choisir « Un lien pour tous » ou « Un lien par personne » puis cliquer « Créer les formulaires ↗ ». Le navigateur effectue un **POST HTML direct** vers l'application Web Google, sans envoyer d'identifiants d'accès ni utiliser de base tierce ; un nouvel onglet (Google) doit afficher les liens prêts à partager. Les Google Forms et les réponses restent dans le Google Drive du propriétaire.

Google peut demander une connexion si le navigateur n'utilise pas le bon compte. Certaines configurations de navigateur peuvent empêcher l'authentification du POST intersite : si cela arrive, utilisez le mode B ci-dessous. **La création réelle reste à tester après autorisation Google** ; les tests automatisés de dépôt simulent ce fonctionnement.

La création est idempotente dans une session : plusieurs clics avec le même dossier ne doivent pas générer des doublons. Le nombre de formulaires créés à la fois est limité à 20 pour respecter les quotas Apps Script. Si l'événement compte plus de 20 voyageurs, le clic suivant reprend les restants (même identifiant de dossier tant que l'événement n'a pas été modifié).

### B. Sans installation de l'application Web (secours)

1. Enregistrer seulement le lien du Google Sheet privé dans **Configurer Google**.
2. Sélectionner l'un des modes de partage, puis ouvrir **Sans connexion automatique → Copier les propositions**.
3. Le bouton **Ouvrir mon tableau Google Sheets** ouvre désormais **le vrai fichier configuré**, pas la racine de Drive.
4. Dans la feuille **Propositions**, coller en **A1**, puis dans le menu de Google Sheets **Transbora → Créer les formulaires**. Ce menu nécessite que le projet Apps Script soit installé et autorisé par le propriétaire.

Le mode B conserve le parcours précédent et sa limitation sur mobile : l'édition de Google Sheets et l'accès au menu personnalisé Apps Script sont plus simples sur ordinateur.

## Ville ou gare spécifique ?

**Ville seule** (exemple « Paris ») : le moteur sélectionne, **dans chaque source de données chargée**, les gares et arrêts dont le nom contient le mot complet « Paris » (ou commence par lui), puis recherche les trajets compatibles. Cela couvre potentiellement plusieurs gares, selon les données disponibles. Il **ne sait pas associer toutes les gares à une ville administrative**, ni connaître l'adresse réelle de l'événement.

**Gare précise** (exemple « Paris Gare de Lyon », si ce libellé apparaît dans les données) : réduit la recherche au nom sélectionné. Les suggestions de gares sont fournies par les sources GTFS chargées ; toutes les gares ne sont pas nécessairement disponibles.

**Nouveau dans les résultats :** Transbora affiche le nom effectif de la gare/arrêt de départ et d'arrivée et le point de correspondance lorsqu'il existe, afin de vérifier la pertinence. Une destination « Paris » ne garantit pas que le train arrive à la gare la plus proche du lieu de rendez-vous. Les marges avant/après restent choisies par l'organisateur, pas calculées en fonction de l'adresse exacte.

## Sécurité / publication

- Le repo GitHub public **ne contient aucune URL Google privée**, aucun jeton OAuth, aucune identité de voyageur.
- Le site GitHub Pages n'a pas accès directement au Drive. Le propriétaire installe la connexion sur son compte via une application Web **Moi uniquement**, après avoir contrôlé les autorisations Google.
- Si l'application Web est publiée par erreur en mode « Tout le monde », **retirer immédiatement ce déploiement** ; les formulaires appartiennent au compte qui exécute le script.
- Les liens **répondant** aux formulaires peuvent être transmis à chaque participant ; les liens d'édition ne doivent pas être partagés.
- Transbora ne réserve pas de billet : les choix restent des propositions d'horaires théoriques.

## Tests

Les tests Node/jsdom vérifient le renvoi vers la configuration plutôt que vers la racine Drive, l'enregistrement d'une URL privée de tableau, l'envoi réel d'un formulaire HTML vers une URL Apps Script test, ainsi que le contenu des lignes et les gares affichées. Les tests mock du moteur Apps Script couvrent la création, les liens, les données incorrectes et la prévention des doublons.

**À faire sur le compte réel :** déployer l'application Web privée, autoriser le script, envoyer deux voyageurs fictifs depuis Transbora, vérifier les formulaires et les réponses dans Google Sheets.
