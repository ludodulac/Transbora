/** Mission 051 — aide du suivi des voyages. */
export const ORGANIZER_HELP_TRAVELS=[
['#panel-travels > h2','Trajets','Retrouvez les horaires proposés et ajoutez au besoin un trajet manuel. Aucune réservation n’est effectuée ici.'],
['#option-form [name="participationId"]','Voyageur et spectacle','Choisissez la personne inscrite au spectacle concerné.'],
['#option-form [name="direction"]','Aller ou retour','L’aller mène au spectacle ; le retour est le trajet après l’événement.'],
['#option-form [name="travelDate"]','Date du voyage','Indiquez la date exacte du train, même si le spectacle a lieu un autre jour.'],
['#option-form [name="from"]','Origine','Ville ou gare de départ de ce trajet.'],
['#option-form [name="to"]','Destination','Ville ou gare d’arrivée de ce trajet.'],
['#option-form [name="departure"]','Heure de départ','Vérifiez l’horaire prévu auprès du transporteur.'],
['#option-form [name="arrival"]','Heure d’arrivée','Tenez compte du temps nécessaire pour rejoindre la salle.'],
['#option-form [name="estimatedEuros"]','Prix prévu','Ne saisissez une estimation que si elle est connue.'],
['#panel-travels h3:nth-of-type(1)','Choix des horaires','Enregistrez le trajet préféré et si besoin un deuxième choix. Choisir un horaire ne signifie pas acheter un billet.'],
['#choice-form [name="firstOptionId"]','Choix numéro 1','Le trajet préféré pour ce voyageur et ce sens de déplacement.'],
['#choice-form [name="backupOptionId"]','Choix numéro 2','Une possibilité de secours, facultative.'],
['#panel-travels h3:nth-of-type(2)','Suivi de l’achat','Après une opération chez le transporteur, indiquez ici l’état réel du billet.'],
['#booking-form [name="optionId"]','Trajet concerné','Choisissez la proposition dont vous suivez l’achat.'],
['#booking-form [name="stage"]','État du billet','Proposé : non réservé. Panier : sélectionné chez le vendeur. Acheté : payé. Classé : référence conservée.'],
['#booking-form [name="paidEuros"]','Montant payé','Prix réellement payé. Un montant inconnu doit rester vide et sera signalé dans le budget.'],
['#booking-form [name="receiptReference"]','Référence du dossier','Renseignez où le billet ou son justificatif est classé.']
];