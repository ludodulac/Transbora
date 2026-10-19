# Transbora 018 — prototype sans code organisateur

La demande est volontaire : pendant les essais, **aucun mot de passe, code d'activation ni compte** n'est demandé pour créer les liens des voyageurs. L'interface saute directement aux deux boutons :
- **Créer le lien du groupe** ;
- **Créer les liens personnels**.

Après création, les URL de choix apparaissent et le lien de **suivi privé** reste accessible. Chaque voyageur sélectionne ses trajets depuis son propre lien. Le lien de suivi de l'organisateur est une capacité confidentielle distincte : quelqu'un qui le reçoit peut voir les données et supprimer le dossier. Il ne doit pas être partagé avec les voyageurs.

## Pourquoi le bouton affichait « Création non autorisée »

La précédente publication dépendait de `TRANSBORA_DEMO_OPEN=enabled`. Le code de la page avait bien été supprimé, mais cette variable n'était pas effectivement présente dans la configuration visible par la fonction Netlify. **Le serveur refusait donc systématiquement la création avec le statut HTTP 403**.

**Correction 019 :** sur cette instance de test seulement, l'autorisation de créer un dossier sans code est activée **directement dans la fonction Netlify publiée**, sans aucun paramétrage utilisateur ni drapeau absent. Elle reste encadrée par la vérification d'origine et la limitation de débit. Le suivi des réponses reste accessible uniquement avec son lien privé.

⚠️ Lors du passage à un logiciel commercial, cette option devra être remplacée par de véritables comptes organisateurs. N'importe quel visiteur du site public peut pour l'instant créer des dossiers d'essai.

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
