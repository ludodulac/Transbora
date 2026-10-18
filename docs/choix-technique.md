# Transbora — décision technique (18 octobre 2026)

**Objectif** : réduire la ressaisie des horaires de train dans les propositions à transmettre aux clients. Projet indépendant, exclusivement dans ce dépôt.

## Comparaison des sources officielles

| Source | Ce qu'elle fournit | Limites | Décision |
| --- | --- | --- | --- |
| [API SNCF / Navitia](https://numerique.sncf.com/faq/api/) | Itinéraires, correspondances, horaires théoriques et temps réel | Requêtes limitées à J-1 / J+23 ; clé/API avec inscription ; limite gratuite annoncée de 5 000 requêtes/jour (150 000/mois) | Option future pour les itinéraires courts et correspondances |
| [GTFS ouvert SNCF](https://transport.data.gouv.fr/datasets/horaires-sncf) | Horaires théoriques TER, TGV, Intercités, gares et dates de circulation | Données statiques, pas de prix ni réservation ; horizon annoncé ~151 jours ; changements possibles | **Retenu pour V1** |
| [Trainline partenaire](https://www.thetrainline.com/about-us/partnerships) | Offre professionnelle de distribution/achat via Global API | Accès et tarification contractuels non établis ; pas une API publique gratuite à supposer | Écarté de V1 |

Le fichier GTFS publié le 18/10/2026 couvrait du 17/10/2026 au **31/03/2027**. La période doit être lue dynamiquement à chaque génération et **ne garantit pas** que chaque train futur soit déjà publié.

## Comment ça fonctionne

- Un script Python récupère le ZIP officiel SNCF **sans clé API** puis lit `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt` et `calendar_dates.txt`.
- Il élimine les bus et prépare un JSON des circulations ferroviaires, avec heures, gares, règles d'embarquement, jours de circulation et exceptions.
- Une page web sur GitHub Pages lit ce JSON, présente les **trains directs seulement** et copie les trains cochés dans le presse-papiers.
- GitHub Actions reconstruit les données sur chaque push dans `main`, chaque jour et sur déclenchement manuel. Les données sont publiées dans l'artefact Pages, **pas stockées sur la branche**.

## Limites importantes

- **Pas de correspondances**, ni calcul de transfert ou marche entre différentes gares dans cette V1.
- Pas de prix, réservation, disponibilité, retards, annulations ou garantie d'exhaustivité de tous les opérateurs.
- L'horaire est un programme **théorique**, à confirmer sur les canaux du transporteur avant l'achat.
- La disponibilité d'une date dans le GTFS ne prouve pas que tous les trains y sont définitivement programmés.
- En cas d'échec de récupération, le site doit échouer explicitement, sans produire d'horaires fictifs.
- Source sous **licence ODbL et conditions particulières**, attribution affichée sur la page. Toute redistribution de bases dérivées doit respecter les obligations de cette licence : https://doc.transport.data.gouv.fr/le-point-d-acces-national/cadre-juridique/conditions-dutilisation-des-donnees/licence-odbl

## Activer GitHub Pages

1. Ouvrir **Settings → Pages** dans ce dépôt.
2. Sous « Build and deployment », choisir « Source : GitHub Actions ».
3. Ouvrir **Actions** et examiner le workflow « Transbora - horaires SNCF et publication » : vérifier que les tests et le téléchargement réel aboutissent avant de considérer l'application disponible.
4. Après déploiement confirmé, ouvrir la page publiée et vérifier un trajet direct avec une date figurant dans le flux.

## Critères du premier essai avec Jeanne

1. Rechercher un trajet réel, vérifier les gares et le jour de circulation.
2. Sélectionner 2 ou 3 horaires.
3. Utiliser « Copier la proposition » et coller dans son document habituel.
4. Comparer manuellement quelques horaires avec un service officiel.
5. Recueillir ce qui manque réellement (notamment les correspondances et les formats de documents).

**Statut : code prototype et tests ajoutés au dépôt. Aucun résultat réel ni déploiement ne doit être revendiqué avant la réussite du workflow GitHub et la vérification des horaires.**
