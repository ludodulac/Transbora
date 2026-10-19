# Mission 023 — comparaison multimodale honnête

## Défaut corrigé
Auparavant, « Train + autocar » arrêtait la recherche dès qu'un trajet direct
de n'importe quel opérateur était découvert. Trois autocars directs de 9 h 25
pouvaient masquer un train plus court avec correspondance, alors que « Train »
seul le trouvait. Le classement des retours mettait aussi systématiquement la
proximité de l'heure de départ devant la durée.

## Nouvelle règle
Pour les événements en mode automatique « Train + autocar », chercher :
- les itinéraires ferroviaires seuls, directs puis jusqu'à deux correspondances ;
- les itinéraires autocars seuls, avec la même logique ;
- les itinéraires combinés, y compris les correspondances entre opérateurs.

Dédupliquer les propositions et classer par un compromis explicite :
écart à la limite horaire de l'événement, durée totale, changements, marges
courtes et changements de gare. Un trajet en train un peu plus tardif peut
ainsi battre un car nettement plus lent.

La frontière de sécurité choisie par l'organisateur reste **stricte** :
ni arrivée après la marge à l'aller, ni départ avant la marge au retour.
Le changement d'une heure demandée à 45 minutes effectives, avec avertissement,
fera l'objet d'une mission distincte, pour ne pas présenter silencieusement des
trajets insuffisamment prudents. Le temps d'accès à une adresse précise n'est
pas estimé automatiquement dans cette mission.

## Limites conservées
La recherche demeure limitée aux périodes GTFS publiées, à au plus deux
correspondances, aux règles d'interconnexion existantes et aux limites
combinatoires du calculateur. Trois recherches partielles par mode peuvent
accroître le temps de calcul ; la recherche reste dans un Worker.
Pas de garantie d'exhaustivité, de place disponible, de prix ou de perturbation
en direct. Ne pas inventer de résultats commerciaux.

## Tests
`tests/multimodal-comparison.test.mjs` vérifie la régression 9 h 25,
la conservation des trains à une correspondance, l'exclusion des autocars
en mode train seul, la marge stricte et le classement tenant compte de la durée.
