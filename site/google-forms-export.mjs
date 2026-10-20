/** Export a plan for the user's own private Google Sheet, without uploading data.
 * Paste the TSV into Propositions!A1, then run the bound Apps Script via
 * "Transbora → Créer les formulaires" in Google Sheets.
 */
import {displayName} from './events-model.mjs';
import {parisDate,parisTime} from './time-zones.mjs';
import {durationText} from './engine.mjs';
import {compactRiskLabel} from './risk-details.mjs';
import {shortServiceSummary} from './journey-display.mjs';

export const FORM_HEADERS=['Dossier ID','Événement','Mode','Voyageur ID','Prénom','Nom','Ville de départ','Sens','Option ID','Proposition','Date'];
export function cleanCell(input){
  let str=String(input??'').replace(/[\t\n\r\x00-\x1f]+/g,' ').trim().slice(0,450);
  // Spreadsheet formula injection: spreadsheets may interpret these prefixes
  // even when pasted as text.
  if(/^[=+\-@\uFF1D]/.test(str))str="'"+str;
  return str;
}
/** Compact, structured text shared by native links, organizer follow-up and Excel.
 * Priority: real boarding station + dropoff station + clocks before optional
 * GTFS labels. The backend caps this to 400 chars.
 */
export function optionLabel(route,date,ordinal){
  const legs=route.legs?.length?route.legs:[route],day=route.date||date;
  const from=legs[0]?.from||route.from||'',to=legs.at(-1)?.to||route.to||'';
  const transport=[...new Set(legs.map(l=>l.mode))].join('+')==='rail'?'🚆 Train':
    legs.every(l=>l.mode==='bus')?'🚌 Autocar':'🚆🚌 Train + autocar';
  const operator=[...new Set(legs.map(l=>l.provider).filter(Boolean))].join(' + ');
  const times=parisTime(day,route.departure)+' → '+parisTime(day,route.arrival);
  const dates=parisDate(day,route.departure)+' → '+parisDate(day,route.arrival);
  const changes=legs.length-1;
  const duration=durationText(route.arrival-route.departure);
  const core=[
    'Option '+ordinal,
    transport+(operator?' · '+operator:''),
    times+' · '+dates,
    'Départ : '+from,
    'Arrivée : '+to,
    duration+' · '+(changes===0?'Direct':changes+' correspondance'+(changes>1?'s':''))
  ];
  const transfers=route.transfers||(route.transfer?[route.transfer]:[]);
  const via=changes?'Via '+legs.slice(0,-1).map(l=>l.to).filter(Boolean).join(' / '):'';
  const wait=transfers.length?'Correspondance : '+transfers.map(t=>
    (t.station||t.departureStation||'arrêt')+' ('+Math.round(t.waitingSeconds/60)+' min)').join(', '):'';
  const mayNeedCityTransfer=legs.some(l=>l.mode==='bus'&&
    /a[ée]roport|airport|charles de gaulle|orly|gare routi[èe]re|bus station/i.test(l.from||''));
  const alert=mayNeedCityTransfer?
    '⚠ Accès à cet arrêt depuis le lieu de l’événement non vérifié':'';
  const risk=compactRiskLabel(route,day);
  const smallMargin=route.marginReduced?'⚠ Marge réduite : '+route.actualMarginMinutes+' min au lieu de '+
      route.requestedMarginMinutes+' min, accès lieu non vérifié':'';
  const summary=shortServiceSummary(route);
  const tail=[via,wait,alert,risk,smallMargin,summary].filter(Boolean);
  const essential=core.join(' | ');
  // If some international station names are very long, still reserve the
  // mandatory time / route information and truncate optional metadata first.
  if(essential.length>=390)return essential.slice(0,390);
  const budget=390-essential.length-3;
  return essential+(tail.length&&budget>0?' | '+tail.join(' | ').slice(0,budget):'');
}
export function buildFormsRows(event,participants,plans,mode,{batchId}={}){
  if(!['collectif','individuel'].includes(mode))throw new Error('Mode de formulaire non reconnu.');
  if(!participants?.length||!plans?.size)throw new Error('Effectuez une recherche pour les voyageurs.');
  const id=batchId || 'EV-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
  if(!/^[a-zA-Z0-9_-]{5,80}$/.test(id))throw new Error('Identifiant de dossier invalide.');
  const rows=[];
  for(const p of participants){
    const plan=plans.get(p.id);
    if(!plan)continue;
    for(const [dir,wanted,options,date] of [
      ['A',event.includeOutward!==false,plan.outward,plan.outwardDate],
      ['R',event.includeReturn!==false,plan.returning,plan.returnDate],
    ]){
      if(!wanted)continue;
      if(options?.length){
        options.forEach((route,index)=>{
          const optionId=route.key||route.id;
          if(!optionId)throw new Error('Une proposition ne possède pas de code.');
          rows.push([id,event.title,mode,p.id,p.first,p.last,p.departure,dir,
            optionId,optionLabel(route,route.date||date,index+1),route.date||date]);
        });
      }else{
        rows.push([id,event.title,mode,p.id,p.first,p.last,p.departure,dir,
          'NONE','Aucun horaire trouvé · contactez l’organisateur',date]);
      }
    }
  }
  if(!rows.length)throw new Error('Aucune proposition à transmettre.');
  return {id,rows,mode,participants:participants.length};
}
export function googleSheetTSV(result){
  return [FORM_HEADERS,...result.rows].map(row=>row.map(cleanCell).join('\t')).join('\n');
}
