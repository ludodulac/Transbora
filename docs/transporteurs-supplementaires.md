# Transbora — Extension des transporteurs (étude du 18 octobre 2026)

## Décision

**Conserver les sources ouvertes pour les horaires théoriques** au lieu d'acheter immédiatement l'accès à un agrégateur privé. Le moteur multimodal a été implémenté dans la PR #1. Les cinq téléchargements GTFS ont été **vérifiés lors du workflow GitHub du 18 octobre 2026**. La recherche reste limitée aux trajets directs et la page publique doit être validée après déploiement.

| Fournisseur | Type | Source publique vérifiée | Couverture annoncée au 18/10/2026 |
| --- | --- | --- | --- |
| SNCF Voyageurs (TGV, TER, Intercités ; vérifier les produits OUIGO dans le fichier réel) | Train | https://transport.data.gouv.fr/datasets/horaires-sncf | Au 31/03/2027 (à contrôler après chaque publication) |
| Trenitalia France | Train | https://transport.data.gouv.fr/datasets/horaires-des-trains-trenitalia-france | Au 11/12/2026 |
| Eurostar | Train | https://transport.data.gouv.fr/datasets/eurostar-gtfs-plan-de-transport-et-temps-reel | Jusqu'à environ 90 jours |
| FlixBus (libellé du dataset : FlixBus et FlixTrain, mais contenu rail non présumé) | Autocar | https://transport.data.gouv.fr/datasets/flixbus-horaires-theoriques-du-reseau-europeen-1 | Au 11/04/2027 (publication du 12/10/2026) |
| BlaBlaCar Bus | Autocar | https://transport.data.gouv.fr/datasets/blablacar-bus-horaires-theoriques-et-temps-reel-du-reseau-europeen | Au 06/01/2027 (publication du 17/10/2026) |

Les données ouvertes ne comprennent **pas les prix, l'inventaire de places, ni la possibilité de réserver**. Les périodes de couverture sont propres à chaque source et peuvent évoluer. Le fait qu'une période soit couverte ne garantit pas la présence de toutes les circulations futures.

## Stratégie d'intégration progressive

1. **Vérifier la V1 SNCF** : téléchargement GitHub Actions, publication Pages, itinéraire réel comparé à une recherche officielle.
2. Étendre le module de préparation aux données **Trenitalia et Eurostar** ; afficher systématiquement un nom de transporteur, et une date de mise à jour par source.
3. Ajouter des sources **FlixBus et BlaBlaCar Bus** et un filtre « train / autocar / tous », en distinguant clairement les gares ferroviaires des gares routières.
4. Étudier les correspondances (dans un même transporteur, puis entre transporteurs) avec une marge paramétrable et les **contraintes géographiques** : deux lieux portant le même nom ne sont pas nécessairement interchangeables ; ne pas déduire les temps de transfert de la simple égalité des noms.
5. Tester tous les formats réels avant d'annoncer une couverture multimodale. Ne pas présenter « aucune proposition trouvée » comme preuve qu'aucun train ou car n'existe.

## Exigences de réalisation

- Chaque producteur a son adaptateur GTFS isolé ; aucune URL réseau non vérifiée n'est ajoutée au code de production.
- Sauvegarder les métadonnées de provenance, l'horizon, la date de mise à jour et la licence.
- Conserver l'origine du train/car dans chaque proposition copiée.
- Une source défaillante ne doit pas faire apparaître ses horaires comme s'ils provenaient d'une autre.
- Contrôler les conditions de réutilisation : SNCF, FlixBus, BlaBlaCar Bus : **ODbL et conditions particulières** ; Trenitalia France et Eurostar : **Licence Ouverte 2.0** selon le portail au 18/10/2026.
- Ne pas aspirer les sites de vente de billets pour remplacer une API sans autorisation.
- Aucune information de prix, de disponibilité ou temps réel ne sera générée sans source adaptée et validée.
- Avant d'utiliser en clientèle, valider le parcours réel et la justesse des résultats.

## Statut

**Implémentation réalisée dans la PR #1 et les cinq sources GTFS téléchargées avec succès pendant l'essai GitHub Actions du 18/10/2026.** La validité des résultats doit encore être confrontée à des horaires des transporteurs dans le navigateur après publication. Les correspondances, les prix et les horaires transfrontaliers en heure locale ne sont pas encore validés.
