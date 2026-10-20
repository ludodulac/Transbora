# TRANSBORA — préparation des 9 améliorations (PR 031)

**Statut : branche de travail, sans fusion dans main ni publication Netlify.**
Une seule compagnie de spectacle ; objectif : garder le forfait gratuit et les données des événements existants.

## Corrections préparées
1. Lien des artistes : cartes segmentées et lisibles sur mobile.
2. Garess/arrêts : affichage prioritaire du point de montée, du point d'arrivée, des heures et des dates.
3. Tableau de suivi : détail lisible du trajet sélectionné.
4. Petites finitions : correction du message « aucun train » en mode autocar ; indicateur d'actualisation côté organisateur ; « Direct » au lieu de « 0 changement ».
5. Villes : suggestions de villes simples en premier (Paris, Brest, Rennes...) plutôt que les matches de gares dispersés, recherche réelle inchangée.
6. Chaque artiste peut personnaliser sa date et heure de présence (limite aller) et son moment de libération (limite retour).
7. Chaque artiste peut modifier sa ville habituelle ainsi que les villes de départ et d'arrivée de chaque sens. En laissant un champ vide, les paramètres communs sont conservés.
8. Autocars : conserver les arrêts distincts, mais reconnaître par leur identifiant **exact de trajet GTFS** les montées multiples sur le même autocar. Ne pas déduire que deux véhicules sont identiques à partir de leur seul nom commercial de ligne.
9. Aéroport/gare routière : avertissement explicite de trajet urbain **non vérifié**, visible dans les propositions envoyées.

## Données et garanties
- Les horaires des transporteurs restent théoriques ; pas de places, prix ou billets achetés.
- La règle de sécurité stricte s'applique à chaque voyageur, même avec des heures différentes ; la date du train n'est pas imposée par les horaires personnels.
- Les changements de ville et d'heure sont sauvegardés dans le brouillon **local** (7 jours). Seules les propositions calculées et leurs libellés sont envoyés au backend lors de la création des liens ; pas de modification du backend Netlify.
- Les anciennes étiquettes d'itinéraire demeurent affichables dans les dossiers déjà enregistrés.
- Les noms de gare proviennent du GTFS. Le temps réel de transfert entre salle et aéroport/gare routière n'est **pas** calculé.
- Les tests de la branche et les vérifications CI GitHub doivent être verts avant fusion ; ne pas fusionner ni déployer avant autorisation explicite.

## Vérifications humaines après publication unique
1. Créer un événement à Paris, deux voyageurs, ouvrir « Personnaliser horaires et villes » pour l'un ; vérifier les propositions distinctes.
2. Dans une recherche, saisir « Paris » et vérifier que la ville simple apparaît en premier.
3. Envoyer un lien de choix fictif et vérifier gros horaires, dates, gare de montée/arrivée et avertissements aéroport.
4. Enregistrer une réponse, vérifier son affichage structuré côté organisateur et le message d'actualisation.
5. En mode autocar, vérifier les trajets ayant plusieurs arrêts de montée, sans suppression d'alternatives.
6. Vérifier les cas Train uniquement et Train + autocar, ainsi que l'absence de dépassement de la marge de sécurité.
