# TRANSBORA — audit manuel des six essais (20 octobre 2026)

Cette note conserve les résultats fournis par l'organisateur et les décisions prises.
**Les horaires théoriques et la disponibilité commerciale sont deux sujets distincts.**
Aucun prix ni siège disponible n'est garanti par le moteur GTFS.

| Essai | Parcours et événement | Observation | Validation |
|---|---|---|---|
| 1 | Nantes → Paris, 29 oct., 20h (marge 2h) | 5 propositions dans la limite de 18h, deux trains différents à 15h04 → 17h22. | 5 horaires retrouvés sur Trainline ; les deux trains ont des numéros différents (12472 / 8922). |
| 2 | Rennes → Lille, 30 oct., 19h (marge 1h30) | Deux directs le 30, puis des directs des 29/28. | Deux directs confirmés ; Trainline indique également des correspondances le 30, dont la prudence reste à valider. |
| 3 | Bordeaux → Nantes, 27 oct., 18h30 (marge 1h) | Deux directs le 27, puis des directs le 26. | Deux directs confirmés ; Trainline propose d'autres correspondances le 27. |
| 4 | Brest → Lyon, 3 nov., 20h (marge 2h) | 9h06 → 16h30 via Rennes confirmé ; 7h20 → 16h30 et une option via Laval non confirmés. | Trainline : 9h06 → Rennes 11h29, Rennes 12h31 → Lyon 16h30 (62 min de correspondance). |
| 5 | Brest → Lyon, 3 nov., 20h, « risque » coché | 5 trajets ordinaires et 2 changements de gare Paris Montparnasse → Paris Gare de Lyon. | Option 11h15 → 18h avec seulement 52 min entre les gares ; autre option avec 157 min. Transfert urbain non vérifié. |
| 6 | Paris → Nantes, retour après le spectacle du 30 oct., fin 23h (marge 1h) | Les 5 départs proposés ont lieu le samedi 31 oct. à partir de 7h12. | Respect du départ au plus tôt à minuit ; **horaires non recoupés sur Trainline**. |

## Corrections réalisées dans la PR #27
- Afficher le **vrai numéro de train lorsqu'il est présent dans la source GTFS**. S'il manque, indiquer « numéro non renseigné », sans créer de numéro factice.
- Conserver des propositions aux **heures identiques** si elles représentent des trajets différents ; afficher une note de vérification plutôt que supprimer sans preuve.
- Quand la recherche automatique comporte des **arrivées la veille**, consulter aussi les correspondances **réellement compatibles avec la marge** le jour même, sans autoriser de transfert trop court. Conserver les jours explicites.
- Distinguer une correspondance très serrée à Paris (52 min pour 90 min de seuil interne) d'une correspondance plus longue (157 min) **toujours non vérifiée**.

## Ce qui reste hors périmètre
- Disponibilités de sièges et prix temps réel.
- Durée réelle du métro/taxi/transfert entre gares de Paris.
- Vérification SNCF/Trainline de tous les itinéraires affichés.
- Confirmation du trajet 7h20 → 16h30 et de la variante via Laval.
- Comparaison tenant compte de l'emplacement réel de la salle et du coût d'hôtel.

La PR #27 doit réussir les tests automatiques avant publication.
