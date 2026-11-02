# TRANSBORA — mission 048 — passage du tableau Jeanne au logiciel

## 1. Tableau du mois : réalisé
`site/organizer-monthly.mjs` calcule les déplacements pour tous les événements à partir des mêmes fiches de personnes, participations, propositions, choix et billets que les autres onglets.

Dans Accueil : filtrage mois et personne ; lignes par proposition de voyage réelle (direct ou avec correspondances), indicateurs **Chx = 1er / 2e choix, R = trajet mis en panier, E = achat réellement confirmé**, prix payé réellement renseigné ou « ? » quand inconnu, et ligne « À rechercher » pour un inscrit encore sans proposition.

Les alternatives restent visibles mais **ne sont jamais comptées comme un deuxième billet acheté**. Le total n'additionne que les billets réellement achetés avec un montant connu. Un achat sans montant est signalé séparément.

Actions sur une ligne : ouvrir son choix, préparer un panier / un achat / un classement ; elles utilisent les formulaires déjà existants et conservent l'événement et la participation.

## 2. Fiche individuelle mensuelle : réalisé
Sélectionner une personne : la vue mensuelle affiche ses voyages dans **tous** les événements concernés. Export XLSX individuel ou mensuel ; total en formule Excel `SUM` avec résultat connu, filtres, ligne d'en-têtes figée et coloration des vrais achats.

Bouton « Fiche PDF » et « PDF du mois » : fenêtre d'impression A4 paysage, où le navigateur propose « Enregistrer au format PDF ». Il s'agit d'une **impression PDF par le navigateur**, et non d'un téléchargement PDF direct.

Tous les exports utilisent le même moteur `monthLedger` pour ne pas diverger du tableau. Les valeurs textuelles sont échappées lors de l'impression. Un prix absent ne devient jamais « 0 € ».

## 3. Espace partagé : implémenté côté code, activation de production distincte
Le backend privé de `backend/workspace-core.mjs` utilise des comptes individuels, des invitations 48 h, des rôles manager/editor, une organisation unique et des sessions HttpOnly. Deux membres voient les mêmes enregistrements de leur organisation.

Nouveautés : bouton « Actualiser » après connexion, refus de modification des fiches obsolètes via `expectedUpdatedAt` (conflit HTTP 409), et intégration de la vraie recherche horaire dans la **même interface privée**, sans recopier le répertoire dans le stockage local du navigateur :

- L'événement et ses inscrits sont échangés en mémoire entre le tableau et le moteur via `postMessage` strictement de même origine.
- Les propositions horaires retournées sont validées côté serveur, rattachées à la participation de la bonne organisation, avec déduplication par empreinte ; tarifs et disponibilité restent inconnus.
- Les identifiants et mots de passe du compte privé ne sont pas transférés au moteur. Les données des personnes ne sont pas enregistrées dans le brouillon local en mode partagé.

**Limites impératives :** le backend privé refuse les sous-domaines Netlify de prévisualisation. Son utilisation réelle nécessite une publication approuvée sur le domaine principal et une organisation initialisée avec la clé secrète côté Netlify. La PR reste DRAFT et le site principal inchangé.

Les **réponses aux liens natifs des artistes** restent synchronisables dans le mode de démonstration locale, mais ne le sont **pas encore** dans le registre privé partagé. Cette limitation est signalée dans le logiciel ; aucune synchronisation trompeuse ni transfert de clé propriétaire.

## 4. Vérifications de bout en bout
- `tests/organizer-monthly-048.test.mjs` : plusieurs événements/mois, premier et second choix, statuts panier/achat/classement, prix manquants, XLSX réel lu par ExcelJS, HTML impression sécurisé.
- `tests/month-dashboard-ui-048.test.mjs` : deux spectacles, plusieurs artistes, filtre, fiche individuelle, choix et billet modifiables depuis le tableau.
- `tests/workspace-shared-048.test.mjs` : deux comptes distincts, invitation, même stockage, refus des modifications obsolètes, import sécurisé de vrais horaires sans prix inventé.
- `tests/shared-search-wizard-048.test.mjs` : transfert de fiches par messages de même origine sans écriture dans le stockage local.
- `tests/workspace-netlify-guard-042.test.mjs` : les prévisualisations ne peuvent pas accéder aux données privées de production.
- Toutes les autres suites historiques et flux transports sont conservés.

## Avant l'activation pour Jeanne
Vérifier visuellement sur PC et téléphone, effectuer un test avec deux véritables navigateurs connectés au compte sur production **après autorisation de publication**, vérifier que les comptes et invitations fonctionnent sur Netlify, puis compléter la remontée des réponses des artistes vers le stockage partagé. Ne pas mélanger les données fictives des démonstrations avec de vraies fiches d'artistes.
