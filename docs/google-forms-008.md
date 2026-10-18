# Transbora — Google Forms dans un Google Drive personnel (mission 008)

La nouvelle page Événements privilégie les **Google Forms à choix unique**, lisibles sur téléphone. Elle conserve les fonctions Excel en option secondaire. Elle n'utilise **ni Supabase ni Cloudflare**, et aucun compte Google ou jeton privé n'est codé dans le dépôt.

## Installation initiale (une seule fois, sur ordinateur)

Un Google Sheet de test privé a déjà été préparé dans le dossier Google Drive « Transbora — prototype ». Il contient les onglets : **Propositions**, **Liens**, **Réponses**, **IndexQuestions** et **Mode d'emploi**.

1. Ouvrir le Google Sheet depuis son Drive.
2. Aller dans **Extensions → Apps Script**.
3. Remplacer le contenu du fichier **Code.gs** par le fichier [Code.gs](../integrations/google-forms/Code.gs) présent dans ce dépôt, puis enregistrer.
4. Revenir dans le Google Sheet et **actualiser** la page. Un menu **Transbora** doit apparaître à côté des menus Google habituels.
5. Lors de la première création de formulaires, Google demande d'**autoriser** le script à utiliser Forms, Sheets et Drive. Examiner et confirmer les autorisations nécessaires dans son propre compte. Sans cette action, **aucun formulaire réel n'est créé**.

**Attention :** l'outil ChatGPT connecté à Google Drive peut créer et modifier des Sheets, mais **il ne peut pas installer, exécuter ou autoriser un projet Google Apps Script**. Ne jamais annoncer que des formulaires ont été créés avant un test réel après l'étape 5.

## Utilisation à chaque événement

1. Depuis `https://ludodulac.github.io/Transbora/events.html`, renseigner l'événement, les participants et lancer la recherche.
2. À l'étape 4, choisir **Un lien pour tous** ou **Un lien par personne**, puis cliquer sur **Copier les propositions**.
3. Ouvrir le Google Sheet privé ; dans la feuille **Propositions**, sélectionner **A1** et **Coller**. Cela ajoute les trajets et leurs identifiants. Les lignes d'anciens événements éventuellement présentes sont ignorées grâce à l'ID de dossier unique.
4. Dans le menu de ce Sheet : **Transbora → Créer les formulaires**. La feuille **Liens** contient les URL destinées aux voyageurs et les URL d'édition (à garder privées). Les formulaires créés sont rangés dans le même dossier Drive que le Sheet.
5. Partager uniquement l'URL participant à chaque destinataire. En mode collectif, le formulaire contient les choix de tous les voyageurs et doit être envoyé **uniquement à l'organisateur**. En mode individuel, chacun ne voit que ses propres choix.
6. Quand les participants ont répondu, **Transbora → Actualiser les réponses** ajoute immédiatement les choix dans la feuille **Réponses**. Une synchronisation automatique **chaque heure** est installée lors de la première création de formulaires.

Le menu peut être relancé après une création interrompue : les formulaires déjà inscrits dans la feuille **Liens** ne sont pas recréés. Pour éviter les quotas Google, au plus **20 nouveaux formulaires individuels par exécution** ; relancer la commande pour continuer.

## Ce que contiennent les questionnaires

- Questions à **choix unique** (un aller et/ou un retour par personne, selon ce qui a été sélectionné dans l'événement).
- Heure de départ, heure d'arrivée, durée, nom des opérateurs, date et éventuelles gares intermédiaires.
- Une réponse **« Aucun de ces horaires »**, pour ne pas forcer un trajet qui ne convient pas.
- Aucun paiement, prix, réservation ou disponibilité de place annoncés ; ce sont des **propositions théoriques**.
- Google Forms créé avec **e-mails non collectés**, sauf si le propriétaire modifie ensuite les réglages manuellement.

## Sécurité et confidentialité

- Toutes les données personnelles restent dans le navigateur de l'organisateur jusqu'à ce qu'il colle volontairement les propositions dans **son Google Sheet privé**.
- Les fichiers et liens Google Forms sont privés à leur création ; les **liens de réponse**, que l'organisateur transmet, donnent accès au contenu du formulaire.
- Les liens individuels contiennent les noms et trajets de leur destinataire. Ne les publier nulle part ni les mélanger.
- Les URL d'édition sont conservées uniquement dans la feuille **Liens** du Sheet privé, et ne doivent jamais être envoyées aux participants.
- Ne jamais rendre public le Google Sheet contenant l'ensemble des voyageurs ni inclure son ID dans le code public.
- Sans application serveur ni sauvegarde de session dans Transbora, le site ne peut pas retrouver un brouillon d'événement perdu après fermeture. Les réponses restent cependant disponibles dans Google Drive.
- Le système est conçu pour des tests avec des voyageurs fictifs d'abord, puis de vrais participants après validation.
- Google Apps Script a des **quotas**, notamment sur le nombre de formulaires créés, les appels Drive et le temps d'exécution. La synchronisation est volontairement limitée à **un seul déclencheur horaire** pour tous les formulaires, plutôt que d'en installer un par voyageur.

## Limitations techniques actuelles

- La liaison avec Google Forms n'est **pas un appel direct du site web** : pour préserver le caractère privé du Drive et éviter d'exposer les autorisations sur GitHub Pages, le transfert volontaire des propositions se fait par **copier-coller**.
- Le menu Apps Script ne peut s'afficher et être utilisé depuis toutes les interfaces mobiles Google Sheets. L'**installation initiale et la création de formulaires doivent être effectuées sur ordinateur**. Les voyageurs peuvent répondre sur téléphone.
- Les réponses apparaissent dans le Google Sheet après synchronisation ; en l'absence de données ou si le script est en erreur, aucune réservation n'est déduite.
- Les limites des données GTFS Transbora (horaires théoriques et période de couverture) continuent de s'appliquer.

## Tests

- `tests/google-forms-export.test.mjs` valide les données transférées, y compris les dates, les trajets absents, les choix de sens et l'absence de formule injectée dans les colonnes.
- `tests/google-apps-script.test.mjs` simule Forms, Drive et les réponses Google afin de vérifier l'assemblage des questionnaires, les liens et la synchronisation.

**Les tests automatisés ne remplacent pas le premier test réel dans le compte Google.**
