# TRANSBORA 044 — pont de démonstration « Organisation ↔ Recherche »

## Parcours vérifiable

1. Sur /organisation.html, l'espace de démonstration s'ouvre immédiatement (exemples fictifs, sauvegardés dans ce navigateur seulement).
2. Dans Événements, choisir une fiche avec au moins un participant inscrit puis « Rechercher les trajets de cet événement ».
3. La page /events.html?from_organizer=1 reprend le titre, la destination, la date, les personnes et leurs gares habituelles. Les mentions de carte de réduction et préférences sont informatives, sans aucun calcul de tarif.
4. L'heure de début et l'heure de fin sont vides : l'organisateur doit renseigner lui-même les moments de présence. Les dates sont préremplies mais peuvent nécessiter un ajustement de fin.
5. Exécuter la recherche réelle GTFS/SNCF habituelle, puis cliquer sur « Envoyer ces trajets au tableau organisateur » en étape 3.
6. Le tableau local s'ouvre sur Déplacements avec les trajets réellement trouvés, les correspondances, les dates de passage à minuit, et un montant inconnu. Un second transfert identique n'ajoute pas de doublon.

## Limites intentionnelles

- Le transfert passe exclusivement par le stockage local du même navigateur et domaine, jamais par l'espace privé sur serveur. L'espace authentifié n'importe pas ces transferts.
- L'ancien moteur d'envoi de liens aux artistes et la collecte de leurs choix restent dans Mes événements / Suivi. Les résultats reçus par des liens natifs ne sont pas automatiquement réinjectés dans ce tableau.
- Le tableau de démo conserve les sélections nº 1/nº 2 et le suivi des achats saisis manuellement. Il n'achète, ni ne réserve de billets.
- Les données horaires sont indicatives ; prix commerciaux, disponibilités et droits aux réductions sont inconnus. Aucun prix n'est dérivé des cartes déclarées.
- Aucune donnée de contact, jeton d'invitation ou clé privée n'est transporté par le pont. Ne pas utiliser de vraies données personnelles dans la démonstration.
- Le passage de l'espace local au véritable registre partagé demandera un chantier distinct avec autorisation serveur, correspondance des fiches et protections des clés de suivi.

## Tests

- node --test tests/organizer-bridge-044.test.mjs
- node --test tests/organizer-bridge-ui-044.test.mjs
- node --test tests/organizer-bridge-wizard-044.test.mjs
- CI générale : .github/workflows/tests.yml.

La version précédente du moteur de recherche et les dossiers déjà créés restent inchangés.
