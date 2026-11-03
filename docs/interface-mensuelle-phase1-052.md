# TRANSBORA — 052 / phase 1 : interface mensuelle et détails contextuels

Cette phase ne modifie pas le moteur de recherche, les données privées, les
budgets, les fichiers PDF ni les règles de réservation. Elle ne fusionne pas la
PR et ne publie pas le site principal.

## Accueil mensuel (ordinateur et téléphone)

- Le mois sélectionné est lisible et les boutons ‹ / › permettent de naviguer,
  y compris entre décembre et janvier, sans réinitialiser les données.
  La sélection directe du mois reste disponible.
- Le filtre Artiste fonctionne toujours, avec accès à la fiche mensuelle.
- Le tableau principal regroupe tous les événements du mois :
  date, personne, événement, trajet, statut, prix payé et actions.
- Les statuts sont directement identifiables : à rechercher, proposé,
  choix numéro 1 ou 2, panier, acheté, billet classé. Les prix inconnus
  sont explicitement inconnus, jamais inventés.
- Un clic sur une ligne du tableau ouvre un panneau d'informations sur
  l'artiste, le spectacle, le trajet, ses horaires et le billet, **sans changer
  d'onglet**. Quand la fenêtre est étroite, le panneau s'ouvre en surimpression
  avec un bouton de retour, sans perdre le filtre/mois. Échap le referme.
- Sur téléphone (largeur 770 px et moins), **aucun tableau large à faire
  défiler horizontalement** : les trajets sont présentés par cartes et les
  détails s'ouvrent plein écran. Les boutons ont une surface tactile suffisante.
- Les téléchargements PDF, l'impression, la fiche individuelle et les
  budgets restent accessibles.

## Limites délibérées (pour éviter les régressions)

- Les boutons « Choix » et « Billet » continuent pour l'instant d'ouvrir les
  formulaires existants dans Trajets. Leur intégration au panneau contextuel
  sera traitée dans les phases suivantes, sans changer leur logique métier.
- Aucun nouveau mécanisme d'import de réponses d'artistes ou de données
  en partage n'a été ajouté : la synchronisation des liens natifs vers
  l'espace privé reste un travail séparé.
- La prévisualisation Netlify utilise son mode de démonstration local.
  Aucune modification du site de production sans autorisation explicite.

## Vérifications

- Tests de navigation mensuelle avec franchissement d'année.
- Plusieurs événements et artistes dans un même mois, achats réels,
  dossier sans proposition, prix réellement payé.
- Détails sur ordinateur, retour clavier et clic, cartes de téléphone.
- Actions Choix/Billet inchangées, filtre artiste, budgets et téléchargements
  PDF toujours présents.
- Les tests existants 048–051 restent exécutés dans la CI.
