# Transbora — Mission 003 : calcul des correspondances prudentes

## Principe

Une correspondance consiste à enchaîner des **segments de trajets qui circulent réellement à la date demandée** : arrivée du premier véhicule, transfert physique, puis départ du second véhicule. Le logiciel recherche des itinéraires directs et des itinéraires comportant **une seule correspondance**.

## Conditions de validité vérifiées par le programme

- Les deux trajets circulent à la date de service sélectionnée, y compris les exceptions `calendar_dates.txt` et les trains après minuit (heures GTFS supérieures à 24:00).
- On peut **descendre** au point de changement du premier véhicule et **monter** dans le second selon les attributs GTFS `drop_off_type` et `pickup_type`.
- Ce sont deux trajets distincts : on ne compte pas artificiellement comme une correspondance deux étapes du même train.
- Le transfert a lieu dans la même station du même fichier, ou entre deux fournisseurs si des coordonnées officielles situent les arrêts à **moins de 100 mètres** et qu'ils utilisent le même fuseau GTFS connu.
- Pour deux arrêts géographiquement proches, le trajet piéton **n'est pas vérifié** : le logiciel l'indique explicitement. Deux gares éloignées portant le même nom de ville ne sont **pas** interchangeables.
- Un transfert interdit par le `transfer_type=3` générique du fichier GTFS est exclu. Si un `min_transfer_time` est communiqué, la marge retenue ne peut pas être inférieure à cette valeur.
- Les attentes de plus de 4 heures sont exclues des correspondances habituelles ; elles pourraient faire l'objet d'une recherche « longue escale » distincte.
- Une correspondance est présentée comme **horaire théorique**, jamais garantie, et n'implique aucun billet direct/protection automatique en cas de retard.

## Marges de sécurité proposées

| Situation | Mode prudent (par défaut) | Mode très prudent |
| --- | --- | --- |
| Train → train, même fournisseur/gare | 30 minutes | 45 minutes |
| Train → train, compagnies différentes | 40 minutes | 60 minutes |
| Inclut un autocar | 60 minutes | 90 minutes |
| Prendre un Eurostar, par prudence sur les formalités | 90 minutes | 120 minutes |

Ces marges sont **des choix conservateurs du prototype**, pas des normes universelles, des recommandations officielles pour toutes les gares ou une garantie de correspondance. Eurostar a des heures d'arrivée conseillées qui varient selon l'itinéraire et la classe : https://www.eurostar.com/fr-fr/voyage/en-route/enregistrement

Les règles particulières de chaque gare et le **référentiel SNCF de temps minimaux entre opérateurs**, différent des règles GTFS, devront être intégrés avant une déclaration de fiabilité professionnelle : https://data.sncf.com/explore/dataset/temps-correspondance-minimaux/

## Critères de classement

Les itinéraires sont classés par **durée totale du trajet**, en privilégiant les directs à durée égale. La proposition copiée comprend les deux segments, les opérateurs, les arrêts exacts, la durée de l'attente et la marge de sécurité.

## Limites actuelles

- Pas de deux correspondances ou davantage.
- Pas de trajet piéton calculé, de métro urbain ni de transfert entre gares éloignées (ex. Paris Montparnasse → Paris Gare de Lyon).
- Les fuseaux sont contrôlés pour un rapprochement **inter-fournisseurs**. Les horaires transfrontaliers affichés restent à vérifier dans l'heure locale de chaque gare ; la conversion détaillée des heures de chaque arrêt n'est pas développée.
- Pas de garantie commerciale, de gestion d'un billet direct, de prix, de place disponible, de retard ou d'annulation en temps réel.
- La proximité géographique seule n'est pas une preuve d'un chemin praticable. Vérifier l'accessibilité, les contrôles et les temps de marche réels avec le transporteur.
- Le classement ne tient pas compte des historiques de retards ni des jours d'affluence.

## Exécution et validation

Les tests sont regroupés dans `tests/connections.test.mjs` et `tests/test_build_connections.py`. Le workflow GitHub Actions effectue également une recherche de correspondances sur les **vraies données** de SNCF, Trenitalia, Eurostar, FlixBus et BlaBlaCar Bus.

**Statut** : moteur à une correspondance implémenté, à vérifier en production après le succès des tests et du déploiement GitHub Pages.
