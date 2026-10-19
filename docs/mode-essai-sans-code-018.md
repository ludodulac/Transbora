# Transbora 018 — prototype sans code organisateur

La demande est volontaire : pendant les essais, **aucun mot de passe, code d'activation ni compte** n'est demandé pour créer les liens des voyageurs. L'interface saute directement aux deux boutons :
- **Créer le lien du groupe** ;
- **Créer les liens personnels**.

Après création, les URL de choix apparaissent et le lien de **suivi privé** reste accessible. Chaque voyageur sélectionne ses trajets depuis son propre lien. Le lien de suivi de l'organisateur est une capacité confidentielle distincte : quelqu'un qui le reçoit peut voir les données et supprimer le dossier. Il ne doit pas être partagé avec les voyageurs.

## Activer le mode essai (côté éditeur, une fois)

Le serveur Netlify lit la variable d'environnement `TRANSBORA_DEMO_OPEN=enabled` (scope Functions). Elle a été ajoutée au site Netlify personnel `transbora-ludo` ; la publication de la branche principale l'utilise.

Si cette variable est absente ou différente, **le serveur refuse une création sans code**, indépendamment de la présence d'un champ dans l'interface. Le propriétaire de l'hébergement peut désactiver ce mode sans modifier le navigateur.

Protection temporaire :
- seuls les POST déclarant l'**origine du même site** sont admis dans le mode sans code ;
- limitation de débit Netlify Functions conservée ;
- les noms et réponses restent dans les magasins privés du serveur ;
- accès au suivi et suppression conservés derrière un jeton secret par dossier ;
- aucun code Netlify, clé serveur, identifiant Google, mot de passe ou token d'accès n'est diffusé dans le dépôt.
  
⚠️ **L'origine et la limitation de débit ne remplacent pas une authentification** : n'importe quel visiteur du site public peut créer des dossiers d'essai. Ne pas utiliser ce mode pour un service commercial, un multi-compte ou des données confidentielles. Avant commercialisation, mettre en place une authentification sécurisée côté serveur.

L'ancien code mémorisé dans `localStorage` est effacé automatiquement à la prochaine ouverture de l'application ; les brouillons et liens de suivi existants ne sont pas effacés.

## Tests

`tests/demo-code-free.test.mjs` vérifie sur un serveur simulé le parcours complet création → lien individuel → choix du voyageur → suivi, le refus d'un mauvais jeton et celui des créations hors origine ou sans drapeau de démonstration.

`tests/events-wizard.test.mjs` vérifie que l'étape 4 ne comporte plus de champ d'activation et que les liens sont visibles et actionnables après création.

L'essai réel doit se faire sur `https://transbora-ludo.netlify.app/events.html`, **pas sur GitHub Pages**, car les formulaires nécessitent l'API Netlify.
