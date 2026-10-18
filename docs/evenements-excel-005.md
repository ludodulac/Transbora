# Transbora — Mission 005 · Événements et Excel sans backend

## Objectif utilisateur

Jeanne prépare les déplacements d'un groupe pour un même événement : des voyageurs partent de villes différentes et reviennent parfois à des dates différentes. Elle doit pouvoir **importer une liste Excel**, lancer des recherches aller-retour d'un seul clic, produire **un Excel unique pour l'organisateur ou un Excel par participant**, puis **réimporter les fichiers cochés** pour préparer les réservations.

### Où cliquer

La page d'accueil `site/index.html` dirige vers `site/events.html`, qui présente quatre étapes et un menu d'aide accessible par un **hamburger en haut à droite**.

1. **Événement** : nom, destination, début et fin, dates d'aller et de retour et marges d'accès au lieu.
2. **Voyageurs** : ajouts manuels ou **Télécharger le modèle Excel**, puis **Importer un Excel**. Les colonnes requises sont `Prénom`, `Nom`, `Ville de départ`. Les dates `Date aller (AAAA-MM-JJ)` et `Date retour (AAAA-MM-JJ)` ainsi que les notes sont facultatives. Les dates individuelles remplacent les dates par défaut de l'événement.
3. **Trajets** : recherche par personne dans le moteur Transbora existant, regroupement des recherches équivalentes, contrôle de l'heure limite d'arrivée et de l'heure minimale de départ après la fin ; nombre de propositions réglable (2 à 5). Les résultats sont indicatifs et ne sont pas exhaustifs.
4. **Excel** : un seul classeur collectif `Accueil`, `Réservations`, `Allers`, `Retours`, `Aide`, ou un classeur personnalisé `Accueil`, `Mes choix`, `Aide` pour chaque participant. Les fichiers individuels peuvent être téléchargés séparément ou regroupés dans un **ZIP**. Sur les téléphones compatibles, un bouton **Partager** ouvre le menu de partage du système.

## Pourquoi X plutôt que des cases Excel natives

Les cases de formulaire historiques et les contrôles récents d'Excel ne sont pas également pris en charge par tous les lecteurs .xlsx. Pour une utilisation fiable sur ordinateur, Excel pour Android/iOS ou Google Sheets, la première colonne jaune **CHOIX X** reçoit simplement la lettre **X**. Les cellules disposent également d'une validation de saisie Excel, sans dépendre uniquement d'elle.

À la réception, Jeanne peut sélectionner plusieurs fichiers `.xlsx` et cliquer sur **Importer les Excel complétés** : Transbora lit les X, vérifie les codes participants et l'identité interne des propositions, et refuse une double sélection pour un même aller/retour. Elle télécharge ensuite **Suivi des réservations actualisé**.

## Contenu exact du modèle Excel

Feuille `Participants`, ligne d'en-têtes 5, lignes à renseigner à partir de la ligne 6. Une feuille `Exemple et aide` contient deux lignes fictives, qui **ne sont pas importées**. Une feuille `Aide` rappelle l'utilisation. L'outil accepte également des tableaux simples dont les intitulés équivalents figurent dans les 12 premières lignes, avec un maximum de **100 participants**.

Le modèle n'est pas stocké comme un binaire dans Git : il est **généré à la demande dans le navigateur par le code source versionné dans ce dépôt**, ce qui évite un fichier modèle obsolète. ExcelJS 4.4.0 et JSZip 3.10.1 sont chargés depuis des URL CDN avec versions figées, et sont également testés par npm dans GitHub Actions.

## Confidentialité et limites

- **Aucune donnée nominative n'est téléversée** vers GitHub ou un service de stockage pendant cette utilisation : le fichier .xlsx est lu en local par le navigateur. Attention, les scripts ExcelJS/JSZip sont chargés via CDN mais les classeurs ne sont pas envoyés à ces services.
- Aucun compte, aucune sauvegarde serveur, aucun e-mail envoyé automatiquement. Pour un fichier individuel, le navigateur peut utiliser la fonction native **Partager**, sinon il faut joindre le fichier téléchargé.
- **La session n'est pas conservée** si la page est actualisée ou fermée. Conserver les fichiers Excel exportés et terminer la consolidation avant de quitter ; la persistance d'événement nécessitera une phase ultérieure.
- La recherche des gares se fonde sur les noms d'arrêts ; des stations portant des noms similaires ne sont pas garanties proches du lieu précis de l'événement.
- **Prix, places, temps réel et billets indisponibles**. Les marges de correspondance sont prudentes mais ne garantissent pas de ne jamais rater un véhicule. Les dates hors calendrier de publication des transporteurs peuvent ne générer aucune proposition.
- Les dates/heures visibles dans les exports sont converties à l'horloge Europe/Paris : contrôler les horaires locaux pour les voyages internationaux.
- Une sélection reçue n'est **pas une réservation** ; Jeanne revalide toutes les conditions auprès du transporteur avant achat.
- Les réponses importées restent en mémoire pendant la session. Réimporter une seconde fois un fichier écrase les choix correspondants si ceux-ci ont changé.

## Tests

`tests/events.test.mjs` construit de vrais `.xlsx` stylisés avec **ExcelJS**, teste un remplissage puis une réimportation, vérifie les choix marqués X (un seul choix par sens), le fichier individuel et l'archive ZIP. Le workflow PR installe les versions figées utilisées par le navigateur et exécute la suite de tests.

**Statut** : prototype local uniquement, exploitable après succès GitHub Actions et vérification sur Excel Android, Excel PC et Google Sheets.
