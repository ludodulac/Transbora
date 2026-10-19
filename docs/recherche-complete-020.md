# Mission 020 — recherche achevée naturellement

## Le problème

Les messages « Recherche partielle », « niveau directs exploré partiellement » et « niveau 1 correspondance exploré partiellement » venaient principalement de **coupures artificielles que Transbora imposait** : 6 secondes par sens de déplacement, 18 secondes globales, puis arrêt forcé du moteur au bout de 35 secondes. Cela ne signifie pas que la SNCF n'a plus d'horaires, mais seulement que le logiciel s'arrêtait avant la fin.

## Fonctionnement corrigé

La recherche s'exécute dans un **Web Worker**, hors du fil principal du navigateur, et **ne comporte plus de limite de temps de 6, 18 ou 35 secondes**.

Pour chaque personne et chaque sens, elle progresse automatiquement :
1. **Directs** ; puis
2. **1 correspondance**, seulement si aucun itinéraire direct compatible n'existe ; puis
3. **2 correspondances**, seulement si aucune liaison avec une correspondance n'est retenue.

À chaque niveau, elle parcourt les **dates de service publiées**, à partir de la présence à l'événement (aller) ou de l'heure de sortie (retour). Elle se termine naturellement quand elle a trouvé suffisamment de propositions valides **et** peut exclure que les jours restants fournissent de meilleures propositions, ou quand elle a épuisé la période d'horaires publiée. Elle continue à respecter les dates de voyage explicitement choisies dans Excel.

Pour ne pas calculer des centaines de jours inutilement, un **audit topologique du réseau** précède les niveaux direct et 1 correspondance : si aucun train GTFS ne peut théoriquement connecter les arrêts dans cet ordre, le logiciel passe aussitôt au niveau suivant. Il s'agit d'une condition nécessaire, jamais d'une affirmation de service disponible.

Le moteur affiche le voyageur, le sens de circulation, le niveau de changements et la date en cours. **« Arrêter la recherche » reste disponible** ; dans ce cas l'arrêt est volontaire, pas une erreur. L'application sauvegarde toujours les informations du brouillon lors d'une actualisation.

## Limites réelles

- Il ne s'agit **pas** d'une garantie d'exhaustivité mondiale : l'algorithme recherche dans les seuls flux GTFS publiés et seulement jusqu'à deux correspondances.
- La recherche à deux changements impose toujours des protections internes contre les combinaisons excessives ; elle peut donc manquer certaines variantes, même après un achèvement normal. Un calcul plus robuste sera nécessaire si l'on veut garantir une recherche exhaustive.
- Le traitement complet peut prendre plus longtemps que 35 secondes si le réseau est complexe, mais **ne s'interrompt plus uniquement à cause du chronomètre**. Le navigateur reste utilisable.
- Une réelle erreur (flux absent, format incorrect, Worker indisponible) doit toujours être expliquée, plutôt que dissimulée.

## Vérification

- `tests/complete-search.test.mjs` vérifie que plusieurs minutes simulées ne provoquent aucune interruption par défaut et que les seuils de 6/18/35 secondes sont absents de l'interface.
- `tests/route-topology.test.mjs` teste la connectivité directe, une correspondance, deux correspondances et le cas de deux transporteurs partageant une gare.
- Les tests existants de trajets de nuit, d'autocomplétion de villes, de correspondances, de partage des liens et de résultats partiels **uniquement lorsqu'un budget est explicitement demandé en test** doivent réussir.

Les horaires doivent toujours être vérifiés auprès des transporteurs avant réservation.
