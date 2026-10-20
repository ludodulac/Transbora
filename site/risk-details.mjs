/** Exact facts from timetable legs; precautions are visibly INTERNAL estimates.
 * No route across Paris is computed, so NEVER claim a transfer is feasible.
 */
import {parisDate,parisTime} from './time-zones.mjs';

import {serviceDescription} from './journey-display.mjs';
const minutes=seconds=>Math.floor(seconds/60);
export function riskDetails(route,date){
  if(!route?.riskAlternative)return [];
  const legs=route.legs||[],transfers=route.transfers||(route.transfer?[route.transfer]:[]);
  const day=route.date||date;
  return transfers.flatMap((transfer,index)=>{
    if(transfer.riskType!=='paris_interstation')return [];
    const first=legs[index],second=legs[index+1];
    if(!first||!second)return [];
    const wait=minutes(transfer.waitingSeconds),caution=minutes(transfer.minimumSeconds);
    const shortage=caution-wait,veryTight=shortage>0;
    const arrive=parisTime(day,first.arrival),depart=parisTime(day,second.departure);
    const arriveStation=transfer.station,departStation=transfer.departureStation;
    const severity=veryTight?'high':'unverified';
    return [{
      type:'paris_interstation',severity,
      shortTitle:veryTight?
        '🔴 Correspondance très serrée — changement de gare à Paris':
        '🟠 Changement de gare à Paris — transfert non vérifié',
      compact:(veryTight?'⚠ RISQUE ÉLEVÉ : ':'⚠ TRANSFERT NON VÉRIFIÉ : ')+
        arriveStation+' '+arrive+' → '+departStation+' '+depart+
        ' ; '+wait+' min, seuil indicatif '+caution+' min'+
        (veryTight?', manque '+shortage+' min':'')+
        '. Risque de manquer le train suivant. Vérifier le transfert avant achat.',
      lines:[
        'Premier train : '+serviceDescription(first)+' ; arrivée à '+arriveStation+
          ' le '+parisDate(day,first.arrival)+' à '+arrive+'.',
        'Deuxième train : '+serviceDescription(second)+' ; départ de '+departStation+
          ' le '+parisDate(day,second.departure)+' à '+depart+'.',
        'Temps disponible entre les trains : '+wait+' min. Seuil de prudence TRANSBORA : '+
          caution+' min (indicatif, non officiel). '+
          (veryTight?'Il manque '+shortage+' min par rapport à ce seuil.':
            'Marge supérieure de '+(-shortage)+' min au seuil indicatif ; cela ne garantit pas le transfert.'),
        veryTight?
          'Risque élevé : le changement de gare et un éventuel retard peuvent faire manquer le second train.':
          'Risque à vérifier : le changement de gare impose un trajet urbain ; un retard ou un transfert long peut faire manquer le second train.',
        'Durée réelle du transfert, accès aux quais, transport local et garanties de correspondance '+
          'NON vérifiés. L’organisateur doit examiner le parcours et les conditions des billets avant tout achat.'
      ]
    }];
  });
}
export function compactRiskLabel(route,date){
  return riskDetails(route,date).map(d=>d.compact).join(' · ');
}
