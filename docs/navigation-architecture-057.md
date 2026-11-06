# TRANSBORA — mission 057 — une navigation compréhensible

## Décision d'architecture

Une seule porte d'entrée du logiciel organisateur : `/organisation.html`. La racine `/index.html` y renvoie. On ne présente plus sur l'accueil trois produits indépendants ni un « nouvel espace bêta » qui semble différent de Transbora.

La navigation principale emploie les mêmes noms que les titres des pages :
- Tableau de bord : vision du mois, ou un seul bouton « Créer un événement » lorsqu'il n'y a encore aucun événement.
- Événements : création et modification des dossiers ; recherche des trajets accessible depuis chaque dossier.
- Artistes : répertoire des personnes.
- Déplacements : besoins et trajets, choix et billets associés.
- Réponses : retours des artistes.
- Billets : suivi des réservations et achats.
- Autres outils (dépliable) : Budgets, Notes, Paramètres.

Lorsqu'on ouvre la recherche intégrée, son entrée « Recherche de trajets » devient visible et sélectionnée. Le bouton « Événements » ne reste plus faussement actif quand le contenu est « Recherche ».

## Pages techniques conservées, mais sorties de la navigation ordinaire

- `/events.html` : assistant de trajets et de liens. Utilisé en mode intégré par l'organisateur ; l'accès direct historique fonctionne encore. Menu réduit à retour au tableau, liens de suivi, recommencer. On conserve le brouillon et les liens existants.
- `/mes-evenements.html` : uniquement les **liens de suivi** déjà créés depuis le navigateur ; aucune prétention à représenter tous les événements du registre organisateur. Pas de deuxième bouton « Nouvel événement ».
- `/recherche.html` : ancienne recherche rapide indépendante ; elle reste fonctionnelle et propose un retour unique vers l'organisateur.
- `/choix.html`, `/suivi.html` : liens externes de sélection et de suivi. Ne jamais les rediriger vers l'organisateur, leurs droits sont différents.

## Données et prudence

Cette correction porte sur les chemins et l'interface ; elle ne supprime ni ne convertit les dossiers.
Les anciens liens de suivi stockés localement restent dans leur registre historique. Les fiches d'organisateurs sont dans la démonstration locale sur la prévisualisation, et dans l'espace privé d'équipe seulement une fois configuré sur le domaine canonique. Il n'existe pas de synchronisation magique entre les deux répertoires.
N'afficher aucun prix, achat ou disponibilité inventé. La branche est une prévisualisation DRAFT sans fusion automatique.

## Vérification

- `tests/navigation-architecture-057.test.mjs` : porte d'entrée, menu simplifié, titres concordants, accueil vide avec une seule action, ouverture directe du dossier et navigation des outils secondaires.
- `tests/unified-workspace-046.test.mjs` : ordre de navigation adapté au parcours événement d'abord.
- Prévisualisation Netlify : tests intégrés dans le build ; revue sur téléphone avant fusion.
