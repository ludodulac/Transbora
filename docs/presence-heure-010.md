# Mission 010 — rechercher par horaire de présence, pas par jour de train

## Logique retenue

**Début de l'événement** = moment où la personne doit être présente au lieu indiqué. Cela peut être un rendez-vous à l'hôtel la veille : Transbora ne cherche pas à déduire le programme réel de l'événement.

**Fin de l'événement** = moment à partir duquel la personne est libre de quitter le lieu.

Quand l'utilisateur fixe ou modifie la date ou l'heure du début, la fin reprend **immédiatement la même date et la même heure**. L'utilisateur modifie ensuite la fin selon le besoin. La validation exige que le moment final soit ultérieur au début.

### Marges (dans Options)

- **Temps d'accès** : 30, 60, 90 ou 120 minutes entre l'arrivée en gare et la présence requise au lieu.
- **Temps retour** : 30, 60, 90 ou 120 minutes pour quitter le lieu et rejoindre la gare avant le retour.
- Cases **Aller**, **Retour** indépendantes.
- **Pas de réglage « jours avant/après »**. La sélection se fonde sur les horaires des transports.

### Classement

- **Aller** : repérer l'heure limite « présence requise moins temps d'accès » ; proposer **d'abord le trajet dont le train arrive le plus tard sans dépasser cette heure**. Proposer ensuite les arrivées précédentes. À égalité, préférer moins de correspondances, une meilleure marge de sécurité et une durée plus raisonnable.
- **Retour** : repérer l'heure « fin de présence plus temps retour » ; proposer **d'abord le trajet dont le train part le plus tôt après cette heure**, puis les départs suivants, mêmes critères à égalité.
- Les départs peuvent tomber la veille, plusieurs jours avant ou après. Les recherches parcourent **progressivement les dates réellement publiées dans les horaires GTFS**, sans plafond choisi arbitrairement de 2, 3 ou 7 jours.
- Les itinéraires franchissant minuit conservent leurs dates réelles. Les données GTFS peuvent avoir des heures >24 h : le dernier jour de publication peut encore contenir un train partant le jour civil suivant.
- La recherche s'arrête dès que la liste est suffisamment complète pour le classement temporel, en conservant une marge pour les trajets longs venant d'une date antérieure. S'il n'existe pas de train dans la plage publiée, le logiciel n'en invente aucun.

### Cas particuliers

Les dates explicitement renseignées par personne dans le **modèle d'import Excel** sont encore acceptées pour des exceptions : elles restreignent la recherche au jour demandé. Il n'y a plus de date de voyage à remplir dans l'interface d'événement.

Le **lieu** saisi dans Transbora est interprété comme la destination ferroviaire/autocar. Le temps d'accès au véritable lieu de rendez-vous reste un paramètre choisi par l'organisateur. Il n'existe pas de calcul de géolocalisation ou de marche jusqu'à l'adresse de l'hôtel.

Les trajets sont des horaires théoriques dépendant des périodes publiées, sans garantie de prix, de place disponible ou de billet unique. Le contrôle des correspondances reste nécessaire avant réservation.

## Régression

Tests sur les nuits, changements de jour/mois/heure, événements à 23 h, classement fondé sur l'heure limite, absence de plafond de jours, saisie synchronisée des deux dates/heures et export vers Google Forms. Les tests GitHub Actions et les premières manipulations mobiles restent les critères d'acceptation.
