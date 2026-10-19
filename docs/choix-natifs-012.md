# Transbora — Mission 012 : liens de choix natifs, sans Google

## Le résultat pour les voyageurs

Les participants reçoivent un **lien Transbora** (personnel, ou collectif destiné à un organisateur). Ils voient leurs propositions d'aller et/ou de retour sur une page adaptée au téléphone, choisissent une option par trajet ou « Aucun de ces horaires », puis cliquent sur **Confirmer mes choix**.

- Aucun compte Google, GitHub ou Netlify.
- Aucune pièce jointe Excel à ouvrir ou renvoyer.
- Aucun utilisateur ne peut consulter les réponses d'un autre groupe avec un simple lien individuel.
- Le lien d'une personne contient un jeton opaque aléatoire, pas son nom ou ses données personnelles.
- Les horaires sont théoriques : **ce n'est pas une réservation**.

L'organisateur dispose d'un **lien de suivi distinct, secret**, qui affiche les réponses reçues, les noms et villes de départ, les choix, les liens à envoyer, un export CSV pour préparer les réservations et la possibilité de **supprimer le dossier et toutes les réponses**.

## Architecture du prototype (compte personnel de l'éditeur)

- Le **moteur d'itinéraires** et l'interface web sont réutilisés, sans toucher aux données GTFS.
- Le code reste dans `ludodulac/Transbora` sur GitHub.
- Le site complet et une API de création/réponses sont hébergés **ensemble sur Netlify** (`netlify.toml` et `netlify/functions/transbora-api.mjs`).
- Les petits enregistrements JSON vivent dans Netlify Blobs privés. Le serveur seul y accède, avec des liens distincts pour voyageurs et organisateurs.
- Seul l'éditeur qui crée des dossiers utilise le code privé `TRANSBORA_MASTER_KEY`, **stocké uniquement dans les variables secrètes de Netlify**. Jamais dans le dépôt public ni dans les liens voyageurs.
- Les tokens sont générés avec `crypto.randomBytes`; le lien du propriétaire utilise un jeton distinct vérifié par hachage. Les réponses sont remplacées par le dernier choix de la personne ; pas de modification des autres participants.
- La création impose 100 participants maximum et cinq options par sens. L'API refuse les choix non reconnus.
- Les liens expirent **45 jours après la fin de l'événement, au minimum 45 jours après création**. L'expiration empêche toute nouvelle réponse, mais **ne supprime pas automatiquement les fichiers stockés** : le bouton « Supprimer ce dossier » supprime explicitement les jetons, propositions et réponses.

**Important :** Netlify Blobs n'est pas un substitut à une base de données transactionnelle pour un service commercial multi-clients. Cette architecture est un **prototype mono-organisateur**, à faible volume, pour valider les parcours, pas une version SaaS prête à être vendue. Avant la commercialisation, prévoir comptes clients, authentification, limites d'accès par organisation, gestion RGPD durable et sauvegardes, éventuellement base de données multi-tenant.

## Une seule installation pour le propriétaire (aucune pour les voyageurs)

Un projet Netlify personnel a été créé : **transbora-ludo**. Le secret `TRANSBORA_MASTER_KEY` a déjà été configuré côté fonctions.

**Il reste à connecter le dépôt GitHub au site pour effectuer le premier déploiement**, ce que le connecteur disponible ici ne sait pas faire. Depuis le tableau Netlify du projet, chercher l'option de connexion à un dépôt Git ou de configuration de la publication continue, puis choisir :

- Dépôt : `ludodulac/Transbora`
- Branche : `main`
- Les réglages de build et de publication sont déjà décrits dans `netlify.toml` ; site statique `site/`, fonctions `netlify/functions/`. Le build récupère les horaires publics (selon disponibilité des flux).
- Le secret `TRANSBORA_MASTER_KEY` doit avoir accès au scope **Functions** (déjà configuré sur le site actuel).

Après déploiement effectif `ready`, visiter `https://transbora-ludo.netlify.app/events.html`. Le lien GitHub Pages reste utile pour voir l'ancienne recherche mais **ne dispose pas d'API de réponse** ; il ne peut pas enregistrer les choix natifs.

Dans la quatrième étape, l'éditeur saisit le **code organisateur privé**, puis clique « Créer le lien » ou « Créer les liens ». Les URL des voyageurs et du tableau de suivi sont immédiatement affichées. Ce code ne doit être saisi **que par l'éditeur**, jamais par les voyageurs.

Les voyageurs peuvent ouvrir leur lien, choisir et enregistrer leurs réponses sans inscription ni autorisation Google.

## Sécurité de la distribution

- Le lien organisateur est un **lien de capacité** : **toute personne qui le reçoit peut consulter les données du dossier ou le supprimer**. Ne le transmettez pas aux voyageurs et évitez de le publier.
- Le lien collectif affiche volontairement les voyageurs de l'événement entier ; le donner **uniquement à l'organisateur de confiance**.
- Les liens personnels donnent accès à une seule fiche.
- Les formulaires n'enregistrent ni prix, ni billet, ni détail de paiement.
- Une suppression demandée par l'organisateur révoque les liens et supprime les réponses du dossier.
- La disponibilité de place, l'achat du billet et la protection des correspondances nécessitent toujours un contrôle sur le site du transporteur.
- Netlify peut facturer ou limiter des opérations en cas de dépassement de quota du plan choisi ; aucun coût récurrent n'est garanti à long terme.

## Tests

`tests/native-choices.test.mjs` : création sécurisée, rejets d'accès non autorisés, jetons séparés, réponses personnalisées/collectives, validation des choix, expiration et révocation.

`tests/native-choices-ui.test.mjs` : interaction radio sur un navigateur simulé, confirmation et envoi des réponses.

`tests/events-wizard.test.mjs` : parcours mobile en quatre étapes et génération de liens côté organisateur.

Ces tests sont automatisés ; **un essai réel sur Netlify après premier déploiement est indispensable** avant d'utiliser les coordonnées de vraies personnes.
