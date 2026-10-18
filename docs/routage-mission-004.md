# Mission 004 — deux correspondances et référentiel SNCF PRR

Statut : moteur développé sur la branche `feat/004-two-changes-official-mct`. La validation avant fusion utilise les vrais flux SNCF, Trenitalia, Eurostar, FlixBus et BlaBlaCar Bus.

## Nouveau parcours

Transbora propose maintenant trois modes : trajets directs uniquement, jusqu'à 1 changement, ou **jusqu'à 2 changements** (par défaut). Chaque itinéraire affiche les 2 ou 3 segments, les compagnies et gares/arrêts exacts, les heures en heure de Paris, les deux durées d'attente et leur marge minimale.

Le classement pénalise légèrement les correspondances supplémentaires, les marges très limitées et les changements entre arrêts proches mais dont le chemin piéton n'est pas vérifié. Le plus rapide n'est donc pas automatiquement le plus haut classé.

## Règles de construction

1. Les 3 services figurent effectivement dans le calendrier GTFS de la date choisie et respectent les interdictions de montée/descente.
2. Deux segments consécutifs ne sont jamais pris sur le même trajet (éviter les faux changements).
3. Les changements sont permis uniquement à la même station GTFS, ou à des arrêts géolocalisés à moins de 100 m pour **deux fournisseurs différents** ; ces derniers restent explicitement « itinéraire piéton non vérifié ».
4. Pour chaque changement, on applique la marge prudente (30 à 120 minutes selon le mode/réglage) et le minimum GTFS générique lorsque présent. Les transferts interdits par GTFS sont supprimés.
5. Attente de 4 heures maximum par changement ; aucun temps d'acheminement terrestre entre gares éloignées n'est inventé.
6. Horaires GTFS UTC / Europe/Paris / Europe/Brussels sont convertis en instants comparables, puis affichés dans une même horloge de référence Europe/Paris. Les horaires locaux hors France doivent être confirmés auprès du transporteur.
7. Les correspondances doivent être considérées comme **théoriques**, pas comme billets directs garantis.

## Référentiel SNCF officiel

Source : [Temps de correspondance minimaux entre opérateurs SNCF Voyageurs](https://ressources.data.sncf.com/explore/dataset/temps-correspondance-minimaux/) sous licence ODbL.

ZIP quotidien : `https://eu.ftp.opendatasoft.com/sncf/prr/temps_correspondance/INFOTRAINS_Export_IDH.zip`.

- `Export_TRAIN_CONNECTION_TIMES.csv` : **165 règles de couples de trains** lors de l'essai du 18 octobre 2026 ; lecture réelle, validation du schéma, périodes d'application et identifiants UIC des gares (correspondance du code UIC à 7 chiffres uniquement à partir d'un `StopArea:OCE<code à 8 chiffres>` vérifié).
- `MIN_DELAY = -1` : correspondance de ce couple interdite pendant la période concernée.
- Valeur positive : le temps minimal officiel identifié ne peut pas être sous-passé (le moteur conserve la marge de prudence si elle est supérieure).
- `Export_CONNECTION_TIMES.csv` : environ **227 615 enregistrements** génériques avec modes, RICS, types de trains, contraintes de gares. **Non appliqués** pour l'instant, car ils ne peuvent être fusionnés naïvement avec les codes GTFS sans correspondance de schéma documentée et validée. Les appliquer par le seul nom de gare ou présumer des catégories opérateurs risquerait d'introduire de fausses permissions/interdictions.
- `Export_STATIONS.csv` : référentiel officiel UIC, pas une preuve d'équivalence piétonne entre gares.

Le téléchargement est intégré au workflow GitHub Actions. En cas d'indisponibilité du ZIP, le site affiche « source officielle indisponible », applique les marges prudentes et ne prétend pas avoir validé les règles.

**Attention :** les données SNCF PRR concernent notamment les conditions d'éligibilité au billet direct. Une correspondance qui respecte le temps indiqué n'est pas une preuve de billet direct, ni une garantie de protection en cas de retard. Les billets, les contrôles, la flexibilité et l'accessibilité doivent être vérifiés par l'opérateur.

## Limites de recherche

Le routeur construit un service intermédiaire entre les ensembles de stations atteignables à l'aller et à l'arrivée. Il retient un maximum de 12 candidats temporels proches par extrémité, limite le nombre de combinaisons et la durée totale. C'est un **prototype borné**, et non un calculateur de tous les itinéraires possibles à l'échelle européenne. Une recherche « sans résultat » n'implique pas l'absence de solution sur les sites officiels.

Les marges par défaut sont des **heuristiques de sécurité** ; elles ne calculent pas une probabilité statistique de rater un train. Aucun prix, place disponible, perturbation temps réel, correspondance à pied entre gares éloignées ou garantie de billet unique.

## Vérifications

Les tests `tests/two-changes.test.mjs` et `tests/test_official_mct.py` vérifient les règles d'interdiction et les combinaisons à 3 segments. Le workflow PR compare la capacité du routeur à trouver un itinéraire réel **Brest → Strasbourg, le 25 novembre 2026** dans les vrais GTFS, puis journalise les temps de calcul.

Pour une mise en service avec Jeanne, il reste à vérifier quelques exemples directement sur les sites des transporteurs, notamment les points de correspondance et les périodes spéciales, puis à tester le formulaire et le copier-coller sur ordinateur/téléphone.
