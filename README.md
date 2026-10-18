# 🚆 Transbora

Projet indépendant destiné à **éviter de recopier des horaires de train** : chercher un trajet, sélectionner les horaires de départ et d'arrivée, puis copier directement une proposition.

## Où en sommes-nous ?

- ✅ Recherche documentée : voir [le choix technique](docs/choix-technique.md).
- ✅ Moteur de lecture du GTFS public SNCF dans `scripts/build_gtfs.py`.
- ✅ Recherche de trajets **directs**, filtrage par date et plage horaire : `site/engine.mjs`.
- ✅ Page de recherche et copie dans le presse-papiers : `site/index.html`, `site/app.mjs`.
- ✅ Tests unitaires Python/JavaScript dans `tests/`.
- ✅ Workflow quotidien GitHub Actions pour télécharger les horaires SNCF et publier le site.
- ⬜ Vérifier la première exécution GitHub Actions, les horaires avec un cas réel, et le site public.
- ⬜ Ajouter les correspondances après validation de l'usage.

## Activer la page web

Dans ce dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

Ensuite, consulter l'onglet **Actions** ; le workflow « Transbora - horaires SNCF et publication » doit réussir pour publier une page accessible. L'adresse attendue **après validation effective du déploiement** est :

https://ludodulac.github.io/Transbora/

Le site ne fonctionne pas si le téléchargement des données réelles a échoué : les heures ne sont jamais inventées.

## Exécuter les tests sans service payant

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
```

## Générer des données réelles localement

```bash
python scripts/build_gtfs.py --output site/data/trains.json
```

Les données du fichier ZIP GTFS SNCF sont celles du programme théorique, **pas** des disponibilités commerciales ou du temps réel. Les données sont publiées sous licence ODbL et conditions particulières ; l'attribution apparaît sur le site.

**Version 1 :** trains directs uniquement. Tarifs, réservations, correspondances, perturbations et billets non couverts. Vérifier les horaires auprès du transporteur avant achat.
