# 🚆 Transbora — recherche multimodale de propositions de transport

> **Version 044 — Démonstration reliée :** depuis le [tableau organisateur](https://transbora-ludo.netlify.app/organisation.html), lancez une recherche sur un événement et renvoyez les horaires réellement trouvés dans son suivi. Cartes de réduction informatives ; prix et places inconnus. Le transfert reste local au navigateur et ne synchronise ni le registre privé ni les réponses natives des artistes. [Mode d'emploi et limites](docs/liaison-organisation-recherche-044.md).

> **Version 045 — Réponses des artistes :** après création des liens depuis cette recherche liée, retour au tableau organisateur et bouton « Récupérer les réponses des artistes » (actualisation manuelle sur le même appareil). Les choix nº1/nº2 peuvent être repris sans modifier les dépenses ou les billets. [Fonctionnement et limites](docs/liaison-reponses-045.md).

> **Version 046 — Un seul espace de travail :** le [tableau organisateur](https://transbora-ludo.netlify.app/organisation.html) possède désormais un menu latéral sur ordinateur et un hamburger sur téléphone. Le moteur de recherche existant s'ouvre dans l'onglet Recherche, reprend les personnes déjà enregistrées et réintègre automatiquement les trajets à l'événement sans ressaisie. Les versions Deploy Preview utilisent un stockage navigateur distinct : sauvegarde/import JSON dans Paramètres. [Parcours, limites et réglage des logos Netlify](docs/interface-unifiee-046.md).

> **Version 048–049 — Tableau mensuel Jeanne + fiches intégrées :** l’onglet Accueil présente la grille mensuelle Chx/R/E, avec accès direct à la mise à jour des choix et billets. Les fiches individuelles et les tableaux restent consultables et modifiables **dans TRANSBORA, sans export Excel ni fichier à réimporter**. Deux téléchargements PDF facultatifs sont proposés : l'ensemble du mois (tous les artistes) ou la fiche d'un seul artiste. L'impression est possible séparément. Le même module fonctionne sur les données locales et les données de l’espace partagé privé. La recherche sécurisée est reliée aux enregistrements de l’organisation sans données privées écrites dans le stockage local. **Prévisualisation : démonstration locale uniquement ; accès réel partagé sur production après validation.** [Détails de la mission 048](docs/jeanne-workflows-048.md).

> **Version 054 — Réponses d'artistes synchronisées :** dans l'espace organisateur privé, les propositions de trains sont envoyées par lien collectif ou individuel. Chaque artiste confirme son **choix nº 1** et éventuellement un **choix nº 2**. Leurs réponses sont enregistrées dans les dossiers Jeanne dès la soumission, puis contrôlées automatiquement lors de l'ouverture, au retour sur la page et toutes les 30 secondes si l'application est visible. Une préférence ne constitue jamais un achat de billet. Les saisies manuelles et billets déjà achetés sont protégés contre l'écrasement. **Code et tests validés en prévisualisation ; PR DRAFT, sans mise en production.** [Mode d'emploi, limites, sécurité](docs/synchronisation-reponses-artistes-054.md).

> **Version 053 — Interface simplifiée :** recherche globale toujours visible en haut, moteur de trains accessible depuis chaque événement, listes-first pour Personnes et Événements, trajets gérés depuis une liste et un seul panneau contextuel (modification, choix, billet), tableau mensuel moins chargé. La prévisualisation démarre sans personnes ni trajets fictifs et retire les anciens exemples connus sans supprimer les fiches réellement créées à part. **PR en DRAFT : le site principal reste inchangé.** [Détails](docs/reorganisation-interface-053.md).

> **Version 052 — Interface mensuelle (phase 1) :** accueil centré sur un mois avec flèches précédent/suivant, suivi compact de tous les artistes et événements, panneau de détails à droite sur grand écran, et cartes tactiles avec détails plein écran sur téléphone. Le tableau conserve l'accès aux choix, achats, budgets et PDF sans modifier le stockage des données. **Seule la prévisualisation est modifiée.** [Fonctions et limites de cette phase](docs/interface-mensuelle-phase1-052.md).

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

## ⏰ Horaires d'événement comme moments de présence (mission 010)

À l'étape Événement, le **début** indique le moment où les voyageurs doivent être **sur place** (par exemple à leur hôtel la veille), et la **fin** le moment où ils sont **libres de repartir**. Quand le début est modifié, la fin reprend automatiquement la même date et la même heure ; l'utilisateur ajuste ensuite la fin.

Dans **Options**, choisir uniquement **Aller/Retour** et les temps d'accès à la gare/au lieu : **30 min, 1 h, 1 h 30 ou 2 h** pour chaque sens.

Transbora recherche en priorité **le dernier train qui arrive assez tôt** pour l'aller, puis les arrivées précédentes ; et **le premier train qui part assez tard** pour le retour, puis les départs suivants. Il remonte ou avance dans les jours réellement couverts par les transporteurs **sans limite arbitraire de deux jours**, en indiquant les dates exactes des trains de nuit.

Pour un voyageur importé depuis Excel, une date de déplacement explicitement renseignée reste une restriction volontaire à ce jour.

**Détails et limites :** [règles de recherche par heure de présence](docs/presence-heure-010.md).

## Déploiement de test Netlify

La version avec enregistrement des choix se teste sur **https://transbora-ludo.netlify.app/events.html**. GitHub Pages ne permet pas l'enregistrement des réponses. Le déploiement Netlify utilise `main` et la fonction `/api/transbora`. Le code organisateur est une variable secrète Netlify, **jamais stockée dans GitHub**. Les voyageurs n'ont aucun compte à créer.

## 🚆 Liens de choix Transbora natifs (mission 012) — parcours recommandé

**Aucun formulaire Google à configurer pour les clients ni pour les voyageurs.** Transbora propose directement une page mobile personnelle ou collective de sélection des trajets : le participant ouvre son lien, choisit un aller et/ou un retour, confirme. L'organisateur retrouve les réponses dans son **tableau Transbora privé** (et peut exporter un suivi CSV).

Le code du prototype est hébergé sur GitHub ; pour recevoir les choix il faut le **serveur Netlify** configuré dans ce dépôt (`netlify.toml`, `netlify/functions/`). Le projet personnel Netlify **transbora-ludo** a été créé et son code organisateur stocké de manière privée ; le **premier déploiement et la connexion GitHub → Netlify restent à effectuer par le propriétaire**. GitHub Pages seul ne permet pas l'enregistrement des réponses.

Les participants n'ont **aucun compte à créer**. L'éditeur seul utilise un code maître privé lors de la création des liens (prévention des abus sur le prototype). **Les liens visiteurs expirent après l'événement** et sont révocables depuis le suivi.

Le choix par Google Forms décrit ci-dessous est **historique** et n'est plus l'interface principale.

**Documentation :** [Installation, fonctionnement, sécurité et limites](docs/choix-natifs-012.md).

## Historique — Google Forms (missions 008–011, non recommandé)

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
