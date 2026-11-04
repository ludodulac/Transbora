# TRANSBORA — mission 053 : simplifier l'interface

Objectif : réduire le défilement sur ordinateur. Les rubriques montrent d'abord les données existantes ; les formulaires s'ouvrent seulement à la demande. Le menu latéral est conservé.

## Recherche générale
Un petit champ de recherche reste visible dans l'en-tête pour retrouver personnes, événements, trajets et billets associés, ainsi que notes, depuis n'importe quelle rubrique. Cliquer sur un résultat ouvre son dossier. La recherche d'horaires de train ne figure plus comme rubrique indépendante du menu : elle se lance depuis chaque événement et reste techniquement le même moteur de transports.

## Personnes et événements
Personnes : liste alphabétique et filtre ; « Aucune personne enregistrée » si vide ; bouton + Ajouter une personne ; clic sur une fiche pour ouvrir son formulaire dans un panneau.

Événements : liste de spectacles ; bouton d'ajout ; clic pour ouvrir le dossier et la liste des participants ; bouton Trouver les trajets pour la recherche de train de ce spectacle.

## Accueil
Un seul mois affiché, flèches précédent/suivant, et un sélecteur calendrier facultatif. Trois indicateurs principaux : trajets, billets achetés, dépenses réelles. Les alertes de données manquantes restent. Un clic sur une ligne ouvre les détails et les actions, sans boutons répétés sur chaque ligne. Les PDF et impressions sont accessibles dans « Documents PDF ».

## Trajets
Liste filtrable par événement et artiste, affichée avant tout formulaire. Cliquer sur une ligne ouvre un panneau à droite : détail, modifier, choisir, suivre le billet. Un seul formulaire apparaît à la fois. Sur ordinateur, la liste et le panneau défilent intérieurement si nécessaires ; le reste de la page reste visible. Sur mobile, le panneau occupe l'écran.

Attention : pour protéger les itinéraires à plusieurs correspondances, leur modification structurelle n'est pas proposée dans le formulaire simplifié à un tronçon. Leurs choix et achats restent gérables.

## Nettoyage des données fictives
La prévisualisation ne crée plus de Sophie ou Michel d'exemple, de festival fictif ni de trajets fictifs. Lors de son ouverture, elle retire uniquement les anciennes références fictives connues et leurs enregistrements dépendants. Les fiches créées indépendamment par l'utilisateur sont conservées. Le bouton « Effacer les données locales » demande confirmation et ne touche jamais au registre privé du site de production.

## Limites
- PR #45 en DRAFT, non fusionnée ; site principal non modifié.
- Données de démonstration enregistrées dans ce navigateur, sauvegarde JSON dans Paramètres.
- Espace privé collaboratif à activer et vérifier séparément.
- Retour automatique des réponses natives développé dans la mission 054 et validé en prévisualisation, à activer sur le site principal après validation : voir synchronisation-reponses-artistes-054.md.
- Recherche d'horaires indicatifs sans garantie de tarifs ou de disponibilité.

Tests ajoutés : tests/organizer-ui-simplification-053.test.mjs.