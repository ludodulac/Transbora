# Transbora 🚆

Outil indépendant de recherche et de préparation de propositions d'horaires de train.

## Objectif

Réduire le temps passé à rechercher des trains, recopier leurs horaires et préparer plusieurs propositions pour un client.

## Parcours de la version 1

1. Saisir une gare de départ et d'arrivée, une date et éventuellement une plage horaire.
2. Lancer la recherche d'itinéraires ferroviaires.
3. Voir des résultats structurés : départ, arrivée, durée, nombre de correspondances, opérateur ou type de train si disponible.
4. Sélectionner les trajets pertinents.
5. Copier un texte clair et prêt à coller dans le document ou l'e-mail habituel.

## Critères de réussite

- Les résultats correspondent à des **horaires réels et sourcés**, jamais à des horaires inventés.
- L'interface distingue clairement horaires prévus, éventuelles informations temps réel et données manquantes.
- Les correspondances et les jours de circulation ne sont pas masqués.
- Une proposition copiée contient au minimum la date, les gares, les horaires et les correspondances.
- L'outil signale clairement si aucune donnée exploitable n'est disponible.
- Pas de prix, de disponibilité de places ni de réservation annoncés sans source qui fournit effectivement ces données.

## Étapes techniques

- [ ] Vérifier les sources de données ferroviaires autorisées (API SNCF/NAVITIA, données ouvertes ou autre), leur couverture géographique, les dates disponibles, les conditions d'accès et leur actualisation.
- [ ] Construire un adaptateur de données et des tests vérifiant les résultats.
- [ ] Créer l'interface de recherche et de sélection.
- [ ] Ajouter « Copier la proposition ».
- [ ] Vérifier les parcours réels avec des trajets représentatifs.
- [ ] Envisager ensuite PDF, liens de choix et autres améliorations uniquement si nécessaire.

## Hébergement et confidentialité

Le code est hébergé sur GitHub. GitHub Pages peut servir l'interface statique, mais **ne protège pas une clé API insérée dans le navigateur**. Les secrets devront être conservés côté serveur ou dans les secrets d'une automatisation GitHub, jamais dans le dépôt ni dans les fichiers publics. Aucune donnée personnelle de clients n'est nécessaire pour la première version.

## État

Cadrage initial. **Aucune connexion à une source d'horaires n'est encore opérationnelle.**
