# Mission 013 — recherche réactive sur téléphone, reprise après actualisation

## Symptômes confirmés par inspection du code

La recherche de plusieurs voyageurs pouvait durer plusieurs minutes : le moteur parcourait **les jours du calendrier de circulation publiés**, pour chaque personne et chaque sens, en recalculant les propositions (y compris les correspondances) à chaque date. Ce calcul s'effectuait jusqu'ici sur le fil principal du navigateur : aucun indicateur par date et aucune possibilité d'annuler.

Si la page était actualisée, les dates, les voyageurs et l'étape en cours étaient en mémoire seulement et disparaissaient.

## Corrections

1. **Worker de recherche** : `site/search-worker.mjs` charge les horaires et lance `planEvent` en arrière-plan. La page Android reste interactive.
2. **Limite de calcul** : 18 s de recherche globale avec 6 s de calcul maximum par sens avant restitution de résultats **marqués comme partiels**, plus un garde-fou de 35 s en cas de calcul/chargement anormalement long. Il est désormais impossible de conclure qu'un train n'existe pas quand le budget a été atteint. Les recherches incomplètes peuvent être relancées avec « Train » ou « Directs » dans Réglages.
3. **Avancement visible** : nom du voyageur, aller ou retour et date actuellement examinée. Le bouton **Arrêter la recherche** libère immédiatement l'interface lorsqu'un Worker est disponible.
4. **Vérification des gares** avant de scanner les calendriers : une ville totalement absente des sources n'entraîne plus de recherche inutile sur des centaines de jours.
5. **Brouillon local** : la saisie des événements et des voyageurs, les réglages et l'étape en cours se sauvegardent dans `localStorage` ; ils sont restaurés après actualisation. Ce brouillon expire au bout de **7 jours**, ou peut être effacé dans ☰ → **Nouveau dossier**. Aucune identité personnelle n'est envoyée à un serveur pendant cette sauvegarde ; sur un appareil partagé, effacer le brouillon. Les itinéraires trouvés ne sont pas sauvegardés ; il faut relancer la recherche si la page a été rechargée en cours d'exécution.
6. **Prudence (?)** : notice courte décrivant les deux profils de correspondances. « Très prudente » prévoit plus de marge que « Équilibrée ». Les marges sont des précautions, pas des garanties.

## Tarifs : deuxième phase à développer

Le système actuel lit des données horaires **GTFS ouvertes** et n'a pas accès au tarif réellement achetable pour une date, un train et une personne. **Ne pas afficher un prix inventé.** Il faudra utiliser une source de distribution tarifaire autorisée, une API partenaire ou éventuellement, à titre informatif seulement, des **fourchettes tarifaires ouvertes** :

- SNCF Connect — programme Partenariat / Affiliation, avec flux de prix, API et widgets : https://www.sncf-connect.com/outils/partenaire-affiliation
- Portail open data SNCF — fourchettes de plein tarif TGV INOUI / OUIGO par origine et destination, pas de disponibilité de places ni de prix ferme de réservation : https://ressources.data.sncf.com/explore/dataset/tarifs-tgv-inoui-ouigo/

Pour le test actuel, la **rapidité et la fiabilité des horaires** passent avant cette seconde intégration.

## À vérifier sur l'appareil utilisateur

- Avec 2 à 4 voyageurs et les cinq fournisseurs, la page reste utilisable pendant le calcul, puis finit avant le garde-fou ou indique qu'il a dû arrêter une recherche exhaustive.
- Actualiser pendant la recherche retrouve le formulaire et les voyageurs **sur le même appareil et le même navigateur**. Les résultats ne sont pas restaurés et l'utilisateur relance le calcul s'il le souhaite.
- Un arrêt manuel stoppe le Worker et laisse intact le brouillon.
- L'explication de prudence est lisible au toucher via le point d'interrogation.
- Les suggestions restent soumises à la couverture réelle des horaires : une option absente de nos données ne signifie pas que le transporteur ne vend rien.

Ces tests manuels complètent les tests unitaires et d'intégration de GitHub Actions.
