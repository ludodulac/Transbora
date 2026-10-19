# Mission 024 — achats effectués par l'organisateur

**Règle du produit : l'organisateur achète tous les billets.** Les artistes
ne font que choisir des propositions ; leur interface le précise sans bouton
d'achat ni lien de réservation.

Après les réponses, l'organisateur peut marquer indépendamment l'aller et le
retour comme « billet acheté ». Le statut privé est stocké côté Netlify Blobs,
au niveau voyageur / direction / option effectivement choisie et inclus dans
le fichier CSV du suivi. Il ne s'agit **pas** d'une réservation automatique.

L'API `set_booking` exige le secret privé du dossier. Un billet ne peut être
marqué acheté que si le voyageur a choisi une proposition existante. Un changement
de choix de l'artiste après achat ne détruit **jamais** l'indication du billet :
le tableau de suivi signale le conflit et exige de retirer explicitement
la mention précédente avant de valider un achat différent.

Le bouton « annuler le statut billet acheté » ne fait qu'effacer l'indicateur
dans Transbora : **il n'annule ou ne rembourse aucun billet chez le transporteur**.
La suppression du dossier supprime également ces états privés.

Les prix, places, tarifs et billets restent externes : aucune disponibilité
commerciale n'est prétendue ni vérifiée par les flux GTFS.
