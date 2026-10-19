/** Export a plan for the user's own private Google Sheet, without uploading data.
 * Paste the TSV into Propositions!A1, then run the bound Apps Script via
 * "Transbora → Créer les formulaires" in Google Sheets.
 */
import {displayName} from './events-model.mjs';
import {parisDate,parisTime} from './time-zones.mjs';
import {durationText} from './engine.mjs';

export const FORM_HEADERS=['Dossier ID','Événement','Mode','Voyageur ID','Prénom','Nom','Ville de départ','Sens','Option ID','Proposition','Date'];
export function cleanCell(input){
  let str=String(input??'').replace(/[\t\n\r\x00-\x1f]+/g,' ').trim().slice(0,450);
  // Spreadsheet formula injection: spreadsheets may interpret these prefixes
  // even when pasted as text.
  if(/^[=+\-@\uFF1D]/.test(str))str="'"+str;
  return str;
}
export function optionLabel(route,date,ordinal){
  const legs=route.legs?.length?route.legs:[route];
  const day=route.date||date;
  // Show BOTH calendar dates: an overnight trip must never look like a same-day trip.
  const head=parisDate(day,route.departure)+' '+parisTime(day,route.departure)+
    ' → '+parisDate(day,route.arrival)+' '+parisTime(day,route.arrival);
  const providers=[...new Set(legs.map(x=>x.provider).filter(Boolean))].join(' + ');
  const changes=legs.length-1;
  const intermediary=changes ? ' · via '+legs.slice(0,-1).map(x=>x.to).join(' / ') : '';
  return [
    ordinal+'. '+head+' · '+durationText(route.arrival-route.departure),
    providers,
    changes+' changement(s)'+intermediary,
    route.marginReduced?'⚠ Marge réduite : '+route.actualMarginMinutes+
      ' min au lieu de '+route.requestedMarginMinutes+
      ' min · Validation gare/lieu par l’organisateur requise':''
  ].filter(Boolean).join(' · ').slice(0,390);
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
