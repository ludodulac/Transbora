# TRANSBORA — interface unifiée (mission 046)

## Ce qui est effectivement relié

- **Une seule porte d'entrée :** `/organisation.html`. Menu latéral sur ordinateur, menu hamburger sur mobile.
- Les onglets Personnes, Événements, Recherche, Trajets, Réponses, Billets, Budgets, Notes et Paramètres travaillent sur les **mêmes données de la démonstration locale**.
- Dans Événements, le bouton « Rechercher les trajets de cet événement » ouvre **le moteur existant dans l'onglet Recherche à droite**, sans quitter l'espace de travail.
- Le moteur reprend toutes les personnes inscrites dans l'événement, leurs gares, cartes et préférences. Une recherche par nom permet de sélectionner une **autre personne déjà enregistrée**, en l'inscrivant à l'événement avant la recherche, sans modifier sa fiche.
- Les heures de présence réelles doivent être renseignées. Le nom, la destination et la date initiale de l'événement sont verrouillés dans le moteur pour ne pas dédoubler le dossier.
- Dès que la recherche retourne des itinéraires, ils sont ajoutés à l'événement automatiquement dans le tableau local ; aucun copier-coller entre pages. On peut changer d'onglet puis revenir à la recherche sans perdre le formulaire et les résultats.
- La création des liens voyageurs utilise le système de choix natif existant. Les réponses nº 1 et nº 2 sont actualisables depuis Réponses ou Événements. Les statuts d'achat, tarifs et places ne sont pas devinés.

## Persistance : limitation des sous-domaines de prévisualisation

Le stockage des personnes se trouve dans le navigateur, **par origine de site**. `deploy-preview-44--transbora-ludo.netlify.app` et `deploy-preview-45--transbora-ludo.netlify.app` ne partagent pas le même stockage, même s'il s'agit du même logiciel.

Pour déplacer les personnes déjà enregistrées dans une ancienne démo :

1. Ouvrir **l'ancienne adresse** dans le même navigateur, aller dans Équipe/Paramètres et utiliser « Télécharger une sauvegarde privée ».
2. Ouvrir la **nouvelle démonstration**, aller dans Paramètres, choisir « Importer une sauvegarde TRANSBORA », sélectionner le JSON puis confirmer.
3. Vérifier les personnes et événements restaurés. L'import **remplace** le contenu local de la démonstration actuelle ; il ne récupère pas des données impossibles à lire sur un autre domaine sans sauvegarde.

La sauvegarde est validée et n'importe pas de clés propriétaires ou champs secrets étrangers. La fonction n'est pas disponible dans l'espace partagé sécurisé.

## Logo Netlify

Deux surcouches Netlify différentes peuvent afficher une petite icône en bas :

- **Netlify Drawer** (prévisualisations) : pour la masquer dans le navigateur, ajouter `?ntl-drawer-state=hidden` à l'adresse de prévisualisation. Pour la supprimer de toutes les prévisualisations, choisir **Project configuration > Developer settings > Continuous deployment > Collaboration tools > Configure**, puis désactiver Netlify Drawer dans l'interface Netlify.
- **Powered by Netlify badge** (projet) : choisir **Project configuration > General > Powered by Netlify badge**, désactiver et enregistrer.

Ces deux surcouches sont **injectées par Netlify**. Elles ne sont pas dans le code HTML de TRANSBORA. Le connecteur Netlify actuel ne dispose pas de l'action permettant de modifier ces réglages. Une règle CSS générique les masquant artificiellement n'est pas une solution fiable.

## Contrôles avant publication

- CI hors ligne / données transports.
- Tests DOM de navigation mobile/ordinateur, recherche intégrée et participation réelle aux événements.
- Vérifier sur un appareil le parcours complet : personne → événement → trajets → liens → réponses → billets → budget.
- **La PR est en brouillon : aucune fusion ni publication de production.**
