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
3. Rechercher les **trajets directs ou jusqu'à deux correspondances** dans les horaires théoriques publics, avec les gares/arrêts exacts et les horaires en heure de Paris.
4. Choisir le nombre maximal de changements et la marge de sécurité, cocher les horaires, puis copier un texte professionnel indiquant compagnie, arrêts et heures.

Les correspondances utilisent des marges conservatrices et la proximité physique documentée des gares ; [voir les règles](docs/correspondances.md) et [la mission 004](docs/routage-mission-004.md). Pas de prix, de places disponibles, de réservation ni de perturbations en direct. La recherche par nom n'est pas un calculateur géographique d'itinéraires : bien contrôler les arrêts choisis. **Trajets internationaux : horaires affichés en heure de Paris, vérifier l'heure locale et les contrôles auprès du transporteur.**

## ⭐ Sélection des trajets par Google Forms (mission 008)

Transbora peut préparer une **page de choix Google Forms lisible sur téléphone** : un lien par voyageur ou un lien collectif pour l'organisateur. Les réponses arrivent dans **un Google Sheet privé** dans le Drive du propriétaire, sans Supabase, Cloudflare, base publique ni paiement.

Dans l'assistant **[Événements](https://ludodulac.github.io/Transbora/events.html)**, après la recherche, l'étape 4 **« Choix des horaires »** permet de copier les propositions. Il faut ensuite les coller dans l'onglet **Propositions**, cellule **A1**, du tableau privé, puis cliquer sur **Transbora → Créer les formulaires** dans le menu du tableur.

**Installation initiale nécessaire :** associer [Code.gs](integrations/google-forms/Code.gs) au Google Sheet via **Extensions → Apps Script** et autoriser les services Google dans son propre compte. Cette opération ne peut pas être réalisée automatiquement par le connecteur Drive de ChatGPT : **tant qu'elle n'a pas été effectuée, les boutons ne créent pas réellement de formulaire**. Aucune clé Google n'est enregistrée dans GitHub.

Les liens à partager sont dans l'onglet **Liens**. Les réponses sont synchronisées dans **Réponses** à la demande depuis le menu, ou automatiquement chaque heure. Voir le [mode d'emploi complet](docs/google-forms-008.md).

Les exports Excel de la mission 005 restent en option secondaire (import de participants et export de réservation). Les choix des voyageurs passent désormais de préférence par des **boutons radio Google Forms**, sans tableur à remplir.

## ✨ Nouveau : événements & Excel (mission 005)

Ouvrez **[la page Événements](https://ludodulac.github.io/Transbora/events.html)** : créez un événement, ajoutez les personnes manuellement ou à partir du **modèle Excel téléchargeable**, recherchez tous les allers-retours puis exportez :

- **Un Excel pour un organisateur** avec toutes les options, et une feuille « Réservations ».
- **Un Excel personnalisé par participant** ou un seul ZIP contenant tous les fichiers individuels.
- **Un suivi des réservations actualisé** après réimport des Excel complétés.

Les cases de choix sont représentées par une **cellule jaune où saisir X**, plus robuste dans les différents lecteurs mobiles que les contrôles de formulaire anciens. Le **menu hamburger en haut à droite** explique toute la procédure.

Le modèle .xlsx est **généré depuis le code versionné dans GitHub** : aucune installation requise, et pas de serveur d'enregistrement des données personnelles. L'application tourne dans le navigateur ; **aucune sauvegarde automatique du brouillon**.

Documentation : [Événements / Excel / réponses](docs/evenements-excel-005.md).

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
