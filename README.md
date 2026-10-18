# 🚆 Transbora — recherche multimodale de propositions de transport

Application indépendante pour gagner du temps lors de la préparation d'horaires à proposer : rechercher des trajets directs en train ou en autocar, en cocher plusieurs, **copier une proposition**.

## Compagnies prévues et état

| Fournisseur | Transport | Données |
|---|---|---|
| SNCF Voyageurs | Train (TGV, TER, Intercités) | GTFS officiel ; obligatoire pour publier le site |
| Trenitalia France | Train | GTFS du catalogue data.gouv.fr |
| Eurostar | Train | GTFS du catalogue data.gouv.fr |
| FlixBus | Autocar | GTFS du catalogue data.gouv.fr |
| BlaBlaCar Bus | Autocar | GTFS du catalogue data.gouv.fr |

**Important :** La présence du code ne garantit pas qu'un flux a été chargé. Les réussites/échecs et périodes d'horaires sont vérifiées dans GitHub Actions et affichées source par source sur le site.

## Ce que permet le prototype

1. Saisir deux noms de ville, de gare ou d'arrêt (ex. Lorient et Paris), une date, une plage horaire.
2. Filtrer trains, autocars ou tous.
3. Rechercher les **trajets directs ou jusqu'à **deux correspondances**** dans les horaires théoriques publics, avec les gares/arrêts exacts et les horaires en heure de Paris.
4. Sélectionner le nombre maximal de changements et la marge de sécurité ; puis cocher les horaires à transmettre, puis copier un texte professionnel indiquant compagnie, arrêts et heures.

Les correspondances utilisent des marges conservatrices et la proximité physique documentée des gares ; [voir les règles](docs/correspondances.md) et [la mission 004](docs/routage-mission-004.md). Pas de prix, de places disponibles, de réservation ni de perturbations en direct. La recherche par nom n'est pas un calculateur géographique d'itinéraires : bien contrôler les arrêts choisis. **Trajets internationaux : horaires affichés en heure de Paris, vérifier l'heure locale et les contrôles auprès du transporteur.**

## Publication sur GitHub Pages

Sur le dépôt GitHub, sous **Settings → Pages**, choisir **Source : GitHub Actions**.

Workflow : `.github/workflows/pages.yml` (push sur main, manuel, quotidien). Il lance les tests, télécharge les horaires et publie le site. Les données statiques sont générées dans l'artefact Pages et ne sont pas ajoutées dans Git.

Adresse attendue **après le succès de la publication** : https://ludodulac.github.io/Transbora/

Le workflow refuse une publication si le flux SNCF essentiel ne marche pas. L'échec d'un autre opérateur est explicitement indiqué sur la page.

## Vérifier le code

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
node --check site/app-multi.mjs
```

## Construire les données ouvertes

```bash
python scripts/build_sources.py --output site/data
python scripts/build_mct.py --output site/data/mct.json --allow-unavailable
```

Utilise le GTFS SNCF officiel et l'[API catalogue data.gouv.fr](https://www.data.gouv.fr/api/1/) pour retrouver les autres GTFS statiques. Pas de jeton ni de clé API payante. Les données ouvertes ont **des licences propres à chaque fournisseur**, indiquées dans [l'étude des transporteurs](docs/transporteurs-supplementaires.md).

## Fiabilité et garde-fous

- Horaires **théoriques**, susceptibles de changer, à vérifier avant réservation.
- Chaque source a sa propre plage de dates ; « aucun résultat » ne prouve pas qu'aucun train ou car n'existe.
- Ne jamais inventer les horaires, les places ou les prix.
- Aucune donnée client nominative n'est nécessaire au prototype.
- Le code et les données générées sont publiés en open source sous réserve des licences des jeux de données ; ne pas confondre la licence des données et celle du code.
