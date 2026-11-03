# TRANSBORA — Mission 051 : points d’interrogation explicatifs

## Utilisation

Des boutons ronds « ? » sont affichés à côté des titres et de nombreux champs :
- Accueil : déplacements du mois, filtres, Chx / R / E, fiche personnelle et budgets.
- Personnes : répertoire, départ habituel, coordonnées, cartes de réduction et préférences.
- Événements : spectacle, salle, enveloppe, participants.
- Recherche : choix de l’événement et quatre étapes du moteur intégré (dates/heures de présence, marges, transports, choix et liens).
- Trajets : horaires, premier/deuxième choix, panier, achat et montant réellement payé.
- Réponses, Billets, Budgets, Notes, Paramètres et équipe.

Un clic ou toucher ouvre une petite explication. Le bouton **×** ferme l’aide. La touche **Échap** ou un clic à l’extérieur ferment aussi la fenêtre. L’ouverture d’une aide ne soumet aucun formulaire et ne modifie aucune donnée.

Les textes n’inventent pas de prix ni de disponibilité, et précisent les limitations de la synchronisation privée.

## Désactiver ou supprimer facilement

**Une seule ligne** dans `site/context-help.mjs` :

```js
export const HELP_ENABLED = false;
```

Les aides disparaissent alors partout, sans toucher aux formulaires ou moteurs.

Pour **retirer définitivement cette fonctionnalité du code**, enlever uniquement cette même ligne de script dans les deux pages :

```html
<script type="module" src="./context-help.mjs"></script>
```

Fichiers dédiés (sans modifications du code métier) :
- `site/context-help.mjs` : activation, icônes, fenêtre d’explication, fermeture et accessibilité.
- `site/context-help.css` : style des boutons ronds et de la fenêtre mobile.
- `site/help-topics-organizer-main.mjs` : Accueil, Personnes, Événements et Recherche.
- `site/help-topics-organizer-travels.mjs` : choix, trajets et billets.
- `site/help-topics-organizer-extra.mjs` : réponses, budgets, notes, paramètres.
- `site/help-topics-wizard.mjs` : les quatre étapes de recherche.

Si l’on retire le script, aucun de ces fichiers n’est chargé. Ils peuvent donc être supprimés ensuite, sans autre changement.

## Contrôles

`tests/context-help-051.test.mjs` vérifie la présence des aides, les deux pages, l’ouverture/fermeture, la touche Échap, les champs non modifiés, les mises à jour de titres, l’absence de doublons et le mode désactivé.

Les tests existants sont conservés. La PR #45 reste en **DRAFT**, sans fusion ni modification du site principal.
