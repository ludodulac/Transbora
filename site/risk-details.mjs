/** Exact facts from timetable legs; precautions are visibly INTERNAL estimates.
 * No route across Paris is computed, so NEVER claim a transfer is feasible.
 */
import {parisDate,parisTime} from './time-zones.mjs';

const minutes=seconds=>Math.floor(seconds/60);
const train=leg=>[leg?.provider,leg?.number?'n° '+leg.number:''].filter(Boolean).join(' ');
export function riskDetails(route,date){
  if(!route?.riskAlternative)return [];
  const legs=route.legs||[],transfers=route.transfers||(route.transfer?[route.transfer]:[]);
  const day=route.date||date;
  return transfers.flatMap((transfer,index)=>{
    if(transfer.riskType!=='paris_interstation')return [];
    const first=legs[index],second=legs[index+1];
    if(!first||!second)return [];
    const wait=minutes(transfer.waitingSeconds),caution=minutes(transfer.minimumSeconds);
    const shortage=caution-wait;
    const arrive=parisTime(day,first.arrival),depart=parisTime(day,second.departure);
    return [{
      type:'paris_interstation',
      shortTitle:'⚠ Changement de gare à Paris — correspondance à risque',
      compact:'⚠ RISQUE : '+transfer.station+' ('+arrive+') → '+
        transfer.departureStation+' ('+depart+') ; '+wait+
        ' min pour changer de gare (seuil interne '+caution+' min, non officiel). '+
        'Transfert réel non vérifié ; risque de manquer le train suivant. Vérifier avant achat.',
      lines:[
        'Premier train : '+train(first)+' ; arrivée à '+transfer.station+
          ' le '+parisDate(day,first.arrival)+' à '+arrive+'.',
        'Deuxième train : '+train(second)+' ; départ de '+transfer.departureStation+
          ' le '+parisDate(day,second.departure)+' à '+depart+'.',
        'Temps disponible entre les trains : '+wait+' min. Seuil de prudence TRANSBORA : '+
          caution+' min (indicatif, non officiel).'+
          (shortage>0?' Il manque '+shortage+' min par rapport à ce seuil.':''),
        'Risque : changement de gare, trajet urbain et marche à effectuer ; retard du premier train '+
          'ou transfert plus long que prévu pouvant faire manquer le suivant.',
        'Durée réelle du transfert, accès aux quais, transport local et garanties de correspondance '+
          'NON vérifiés. L’organisateur doit examiner le parcours et les conditions des billets avant tout achat.'
      ]
    }];
  });
}
export function compactRiskLabel(route,date){
  return riskDetails(route,date).map(d=>d.compact).join(' · ');
}
