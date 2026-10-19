/** Transbora-owned links. No Google account / spreadsheet for travelers. */
import {optionLabel} from './google-forms-export.mjs';
export const API='/api/transbora';

export function buildChoicePeople(event,participants,plans){
  const people=[];
  for(const p of participants){
    const plan=plans.get(p.id);
    if(!plan)throw new Error('Il manque les propositions de '+p.first+'.');
    const options={A:[],R:[]};
    for(const [dir,enabled,list,date] of [
      ['A',event.includeOutward!==false,plan.outward,plan.outwardDate],
      ['R',event.includeReturn!==false,plan.returning,plan.returnDate]
    ]){
      if(!enabled)continue;
      const ids=new Set();
      for(let i=0;i<list.length;i++){
        const j=list[i],id=String(j.key||j.id);
        if(!id||ids.has(id))continue;
        ids.add(id);
        options[dir].push({id,label:optionLabel(j,j.date||date,i+1)});
      }
    }
    people.push({id:p.id,first:p.first,last:p.last,departure:p.departure,options});
  }
  return people;
}
export async function api(action,payload={},admin=''){
  let response;
  try{
    response=await fetch(API,{method:'POST',headers:{
      'content-type':'application/json',...(admin?{'x-transbora-admin':admin}:{})
    },body:JSON.stringify({action,...payload}),cache:'no-store'});
  }catch{
    throw new Error('Connexion au service de choix indisponible. Le site doit être hébergé avec sa fonction Transbora.');
  }
  if(!response.ok){
    let error;
    try{error=(await response.json()).error;}catch{}
    throw new Error(error||'Service de choix indisponible ('+response.status+').');
  }
  return response.json();
}
export function choiceUrl(token){
  return new URL('./choix.html#t='+encodeURIComponent(token),location.href).href;
}
export function statusUrl(eventId,ownerKey){
  return new URL('./suivi.html#event='+encodeURIComponent(eventId)+'&key='+encodeURIComponent(ownerKey),location.href).href;
}
export function textLinks(links,mode){
  return links.map(x=>mode==='group'?
    'Organisateur : '+choiceUrl(x.token):
    x.label+' : '+choiceUrl(x.token)).join('\n');
}
