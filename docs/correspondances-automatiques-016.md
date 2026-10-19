# Mission 016 — correspondances automatiques et code organisateur mémorisé

## Un seul code organisateur pour l'installation

L'instance Netlify personnelle **possède déjà un code organisateur fixe**, créé lors de sa configuration et conservé dans une variable secrète du serveur. Le code n'est pas inscrit dans le dépôt GitHub ni envoyé aux voyageurs.

Pour activer l'application sur **un navigateur personnel**, le propriétaire le saisit **une seule fois**, lors du premier événement dont les liens sont créés avec succès. Transbora mémorise alors ce code uniquement dans le stockage local de ce navigateur. Il est réutilisé automatiquement après rechargement de page et lors des prochains événements ; le champ n'apparaît plus. Le propriétaire peut utiliser **« Oublier ce code »** à tout moment, par exemple sur un appareil partagé.

Cela évite de devoir redemander le code pour chaque événement. Cette approche ne nécessite aucun compte Google ni aucune authentification des voyageurs. Elle **ne stocke pas le code dans le brouillon de l'événement** ni dans les URL envoyées aux participants.

**Attention à la sécurité :** enregistrer un secret durable dans le navigateur présente un risque sur un appareil partagé ou si le site est compromis (scripts malveillants). Pour une version commercialisée avec plusieurs clients, il faudra une authentification par session sécurisée et comptes individuels, et non un code global commun. Un nombre « illimité » d'utilisations n'est pas garanti par le plan Netlify : des quotas techniques et commerciaux continuent de s'appliquer.

## Recherche automatique des correspondances

L'organisateur ne choisit plus manuellement le nombre de changements. Transbora tente, **pour chaque personne et chaque sens de déplacement** :

1. **Trajets directs (0 changement)**, qui sont privilégiés.
2. **1 correspondance** si aucune proposition directe compatible n'a été trouvée.
3. **2 correspondances** si aucune proposition avec 1 changement n'a été trouvée.

Les trois niveaux utilisent le calendrier de circulation GTFS, les marges de sécurité (« Prudence »), les gares et les heures imposées par l'événement. Les trajets d'un même niveau sont classés selon l'heure pertinente : dernier arrivant admissible à l'aller, premier départ admissible au retour. Les correspondances non validées ou trop courtes sont exclues.

Pour ne pas immobiliser un téléphone indéfiniment, le moteur applique des budgets de temps par niveau. **Une recherche interrompue est signalée comme partielle** : le résultat peut être utile mais la priorité des directs n'est alors pas garantie de manière exhaustive. Le moteur actuel sait calculer au maximum **2 correspondances** : une recherche à 3 ou plus demanderait un moteur d'itinéraires supplémentaire ou une source de routage externe. Le logiciel n'invente jamais de trajet.

Ce comportement est automatique sur l'interface Événements. Les anciens appels de programmation portant les réglages `no`, `yes` ou `two` continuent de fonctionner pour les tests et les composants historiques. Aucun besoin de modifier les fichiers Excel existants.

## Vérifications

- `tests/auto-transfers.test.mjs` : préférence des trajets directs, puis trajets à une et deux correspondances quand nécessaires, sans réglage utilisateur.
- `tests/owner-code.test.mjs` : mémorisation du code une seule fois, persistance sur navigateur et possibilité de l'effacer, jamais de secret dans GitHub.
- Les autres tests de recherche, correspondances et parcours mobile doivent rester réussis.

**Ne jamais annoncer de trajets à plus de deux correspondances sans les avoir réellement implémentés et validés.**
