# Mission 009 — voyages avant et après l'événement, y compris la nuit

**Problème corrigé** : l'assistant recherchait seulement la date de début pour l'aller et la date de fin pour le retour. Après un spectacle terminant à 23 h, il pouvait afficher « Aucun trajet » au lieu de proposer le train du lendemain. De même, il pouvait ignorer un trajet commençant la veille pour arriver avant le spectacle.

## Nouveau comportement

- **Aller**, sans date précise : recherche le jour de début de l'événement **et, par défaut, les deux jours précédents**.
- **Retour**, sans date précise : recherche le jour de fin de l'événement **et, par défaut, les deux jours suivants**.
- **Options → Jours avant / Jours après** : choisir 0, 1, 2, 3 ou 7 jours selon le besoin.
- **Options → Aller précis / Retour précis** : si une date est explicitement indiquée, le logiciel ne cherche que ce jour-là. Les dates individuelles éventuellement importées via le modèle Excel ont également priorité sur la plage générale.
- Les contrôles d'horaires utilisent de véritables **instants calendaires** avec les changements de jour et d'heure Europe/Paris : un retour le 30 à 07 h est admissible pour un événement terminé le 29 à 23 h ; un train partant le 28 à 23 h et arrivant le 29 tôt le matin est admissible pour le début du 29 à 14 h.
- Les trajets vers le lieu doivent toujours arriver avant le début moins la marge sélectionnée. Les retours doivent partir après la fin plus la marge sélectionnée.
- Les propositions sont classées par durée, correspondances et proximité temporelle ; au moins une proposition par date de départ distincte est conservée dans la limite du nombre de propositions choisi, si des itinéraires existent.
- **La date réelle de départ et celle d'arrivée figurent à l'écran, dans les formulaires Google et les Excel de secours**, même lorsqu'un train franchit minuit.
- Une date extérieure à la période couverte par les horaires publics ne provoque pas l'invention de trains. Un avertissement distingue les données non publiées d'un trajet introuvable.

## Limites

Les horaires GTFS disponibles, leurs dates de circulation, la qualité des correspondances et le nombre d'options restent limités par les fournisseurs. Le moteur n'explore pas tous les déplacements possibles entre gares éloignées (les transferts à pied ou en métro entre différentes gares ne sont pas inventés).

La plage de recherche avant/après concerne les **dates de départ possibles** et n'est pas une garantie de trajet intégral si une compagnie ne publie pas son horaire. Les marges et les correspondances doivent être vérifiées lors de la réservation.

Les tests automatisés couvrent départ la veille / arrivée après minuit, spectacle finissant à 23 h / retour le lendemain, plages adjacentes de plusieurs jours, dates explicites, changement de mois et d'heure, export Google Sheets et Excel.
