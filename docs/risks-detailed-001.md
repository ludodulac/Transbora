# TRANSBORA — 001 : alternatives avec correspondance à risque (préparation)

Statut : **proposition sur branche, non publiée**. Déploiement en production interdit sans validation.

## Contexte réel de test

- Brest → Lyon Part-Dieu, mardi 3 novembre 2026, arrivée exigée au plus tard à 18 h.
- Trainline a montré une alternative à 11 h 15 → 18 h 00 :
  - OUIGO 7612, Brest 11 h 15 → **Paris Montparnasse 15 h 00**.
  - **52 minutes de changement de gare**.
  - TGV INOUI 6621, **Paris Gare de Lyon 15 h 52** → Lyon Part-Dieu 18 h 00.
- Une telle option présente un risque important. La durée réelle de traversée de Paris
  **n'a pas été mesurée ni garantie**. Les trajets des deux trains restent soumis aux horaires publiés.

## Ce que prépare cette première version

1. **Case décochée par défaut** à l'étape « Trajets » :
   « Afficher aussi des correspondances à risque avec changement de gare ».
2. Les propositions normales (directs, puis correspondances conformes aux règles)
   restent **inchangées et prioritaires**.
3. Si la case est cochée, rechercher **au maximum deux alternatives en supplément**
   pour chaque sens de voyage. Afficher une rubrique rouge séparée.
4. Pour chaque alternative, afficher les **faits exacts présents dans les données** :
   numéros de trains lorsqu'ils existent, gares distinctes, heures d'arrivée et
   de départ, durée totale entre trains.
5. Indiquer explicitement : **risque de manquer le train suivant**, transfert
   entre gares non calculé ni vérifié, retard possible, marche et transport urbain
   nécessaires ; validation manuelle impérative avant achat.
6. Reprendre l'avertissement dans les liens de choix des artistes et les fichiers Excel.

## Garde-fous techniques

- Première liste autorisée **exclusivement** : Paris Montparnasse ↔ Paris Gare de Lyon,
  avec un train pour chaque segment. Pas d'inférence par distance géographique.
- Une seule correspondance à risque, les deux segments en train ; ni autocar,
  ni transferts inconnus entre gares, ni deux correspondances risquées.
- Une option à moins de **30 minutes** entre les deux trains est toujours exclue.
- Seuil de prudence **interne et indicatif** : 90 min en mode Très prudente,
  75 min en mode Équilibrée. **Il ne représente ni une durée de trajet mesurée,
  ni une règle officielle SNCF, ni une faisabilité garantie.**
- L'arrivée à l'événement et la marge gare/lieu demandée restent obligatoires.
- Uniquement jour de l'événement à l'aller ; jour de fin et lendemain au retour.
  La couverture est volontairement partielle, jamais présentée comme exhaustive.
- Disponibilité commerciale, billet, retard et garantie de correspondance restent
  **non vérifiés** ; ne jamais présenter ces itinéraires comme sûrs.
- Un organisateur reste responsable de vérifier le temps réaliste du transfert,
  les horaires, la disponibilité, l'achat et les conditions des billets.

## Tests prévus

Tests automatiques : déclenchement uniquement avec consentement, défaut strict,
risques contextualisés, gares non autorisées exclues, correspondances impossibles
(\u003c30 min) exclues. Examen humain des résultats avant activation en production.

## Hors périmètre / améliorations futures

- Ajouter d'autres gares uniquement avec itinéraires et durées de transfert vérifiés.
- Avertissements pour d'autres risques (réservation non vérifiée, perturbations
  temps réel, horaires GTFS périmés) dans une mission distincte.
- Reclasser les trains du jour même et afficher les numéros des trains dans
  toutes les propositions : améliorations distinctes déjà identifiées.
