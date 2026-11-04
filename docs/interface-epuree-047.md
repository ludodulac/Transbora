# TRANSBORA — finition d'interface 047

## Modifications
- Suppression du surtitre « Organisation · aperçu », du « TABLEAU DE BORD » au-dessus du contenu, de la raison sociale fictive « Atelier de démonstration », de la phrase « Événements, personnes, billets et notes au même endroit » et du bandeau de démonstration.
- Simplification des libellés, des boutons et des textes explicatifs répétés dans les onglets Personnes, Événements, Recherche, Trajets, Réponses, Billets, Budgets, Notes et Paramètres.
- Le contexte et les avertissements sont montrés seulement lorsque nécessaires. L'information essentielle (prix/places/achats et données locales) figure dans un seul petit paragraphe en bas de l'espace de travail.
- Le moteur de recherche lié à un événement conserve ses fonctionnalités, mais ses écrans et l'étape d'envoi des liens ont moins de descriptions.
- Les formulaires, imports, listes et ID restent inchangés ; les suppressions portent sur l'habillage et le texte, pas sur les données.

## Cartes et abonnements
Dans la fiche Personnes, le champ libre est remplacé par un sélecteur déroulant de cartes **à choix multiples**, avec « Autre carte » pour les offres régionales et les anciens libellés.

Offres référencées le 2 novembre 2026, à partir des listes officielles :
- SNCF : Carte Avantage Jeune, Adulte, Senior ; Carte Liberté ; Carte Familles Nombreuses ; MAX JEUNE, MAX SENIOR, MAX ACTIF, MAX ACTIF+ ; pass TGV INOUI.
  Source : https://www.sncf-connect.com/catalogue/cartes-et-abonnements et https://www.sncf-connect.com/aide/l-offre-pour-les-enfants-et-les-familles
- TER BreizhGo : abonnements hebdomadaire, mensuel, annuel et droit « BreizhGo Solidaire ».
  Sources : https://www.ter.sncf.com/bretagne/tarifs-cartes/cartes-reduction-ter-sncf et https://www.ter.sncf.com/bretagne/abonnements/tous-les-abonnements/abonnements-ter/abonnement-mensuel-ter

**Important :** la liste sert à déclarer les cartes détenues, elle ne vérifie ni l'éligibilité ni la validité de la carte, et ne calcule aucun tarif en direct. Les profils existants enregistrés sous forme de texte restent modifiables sans perte dans « Autre carte ».

## Contrôles
- `tests/reduction-cards-047.test.mjs` : catalogue, conservation des fiches existantes, ajout de plusieurs cartes, édition de la personne, libellés de navigation.
- La CI complète des missions 044–047 doit réussir avant publication.
- PR 45 conserve son état DRAFT. Le site principal reste inchangé.
