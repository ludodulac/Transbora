/** Plan one event for many people. Work is entirely inside the browser; no PII uploads. */
import {searchFeed,normalizeStop} from './search-multi.mjs';
import {findConnections,officialIndex} from './connections.mjs';
import {findTwoChanges} from './connections-two.mjs';
import {parisInstant} from './time-zones.mjs';
import {queryKey,itineraryKey} from './events-model.mjs';
const MAX_ROUTES=3;
function sec(value){
  const [h,m]=String(value||'').split(':').map(Number);
  return h*3600+m*60;
}
export function eventBoundaries(event) {
  const start=parisInstant(event.startDate,sec(event.startTime));
  const end=parisInstant(event.endDate,sec(event.endTime));
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)throw new Error("L'événement doit se terminer après son début.");
  return {start:+start,end:+end};
}
export function rank(route,direction,eventDate,boundary){
  const changes=route.transfers||(route.transfer?[route.transfer]:[]);
  const elapsed=route.arrival-route.departure;
  const changePenalty=changes.length*25*60;
  const walkPenalty=changes.filter(c=>c.proximity!=='same_station').length*30*60;
  const tightPenalty=changes.filter(c=>c.waitingSeconds-c.minimumSeconds<15*60).length*20*60;
  const departureMs=+parisInstant(eventDate,route.departure);
  const arrivalMs=+parisInstant(eventDate,route.arrival);
  // Favor arriving around 2h before the event and returning soon after it ends,
  // but never discard safe journeys to force a perfect timing.
  const schedulePenalty=direction==='A'?
    Math.max(0,(boundary-arrivalMs-90*60000)/1000)*0.25 :
    Math.max(0,(departureMs-boundary-45*60000)/1000)*0.25;
  return elapsed+changePenalty+walkPenalty+tightPenalty+schedulePenalty;
}
export function pickItineraries(all,query,event,direction,{maximum=MAX_ROUTES}={}){
  const bounds=eventBoundaries(event);
  const eventTime=direction==='A' ? bounds.start-Number(event.arrivalMargin||90)*60000 :
    bounds.end+Number(event.departureMargin||45)*60000;
  const day=query.date,seen=new Set(),valid=[];
  for(const route of all){
    const dep=+parisInstant(day,route.departure),arr=+parisInstant(day,route.arrival);
    if(direction==='A'&&arr>eventTime)continue;
    if(direction==='R'&&dep<eventTime)continue;
    if(!Number.isFinite(dep)||!Number.isFinite(arr)||arr<=dep)continue;
    const key=itineraryKey(route);
    if(seen.has(key))continue;
    seen.add(key);
    valid.push({...route,key,date:day});
  }
  valid.sort((a,b)=>rank(a,direction,day,eventTime)-rank(b,direction,day,eventTime)||
    (a.changes||0)-(b.changes||0));
  return valid.slice(0,maximum);
}
export async function prepareFeeds(manifest,fetcher=fetch){
  const available=(manifest.sources||[]).filter(x=>x.status==='ok');
  if(!available.length)throw new Error('Aucun fichier horaire disponible.');
  const fetched=await Promise.all(available.map(async source=>{
    try{
      const response=await fetcher('./'+source.file);
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.trips)||!Array.isArray(data.stations)||!Array.isArray(data.services))throw new Error('Format invalide');
      return {source,data};
    }catch(error){return {source,error:error.message};}
  }));
  return {feeds:fetched.filter(x=>!x.error),issues:fetched.filter(x=>x.error).map(x=>x.source.label+' : '+x.error)};
}
export function allOptions(feeds,query,config,officialRules=new Map()){
  const chosen=feeds.filter(x=>config.mode==='all'||x.source.mode===config.mode);
  let list=[];
  for(const f of chosen){
    if(query.date<f.data.meta.first||query.date>f.data.meta.last)continue;
    list.push(...searchFeed(f.data,query,f.source));
  }
  if(config.connections!=='no'){
    list.push(...findConnections(chosen,query,{profile:config.buffer,officialRules,limit:100}));
    if(config.connections==='two')
      list.push(...findTwoChanges(chosen,query,{profile:config.buffer,officialRules,limit:90}));
  }
  return list;
}
export async function planEvent(event,participants,feeds,settings,officialRules=new Map(),progress=()=>{}){
  const boundaries=eventBoundaries(event);
  const cache=new Map(),plans=new Map(),issues=[];
  const max=Math.max(1,Math.min(5,Number(settings.maxOptions)||3));
  for(let i=0;i<participants.length;i++){
    const p=participants[i];
    const outwardDate=p.outwardDate||event.outwardDate||event.startDate;
    const returnDate=p.returnDate||event.returnDate||event.endDate;
    const directions=[
      {kind:'A',from:p.departure,to:event.destination,date:outwardDate},
      {kind:'R',from:event.destination,to:p.departure,date:returnDate}
    ];
    const entries={outwardDate,returnDate,outward:[],returning:[]};
    for(const queryDirection of directions){
      if(normalizeStop(queryDirection.from)===normalizeStop(queryDirection.to)){
        issues.push(p.first+' '+p.last+' : départ et arrivée identiques.');
        continue;
      }
      const query={from:queryDirection.from,to:queryDirection.to,date:queryDirection.date,
        earliest:'00:00',latest:'23:59'};
      const key=queryKey(query,settings);
      try{
        if(!cache.has(key))cache.set(key,allOptions(feeds,query,settings,officialRules));
        const candidates=pickItineraries(cache.get(key),query,event,queryDirection.kind,{maximum:max});
        if(queryDirection.kind==='A')entries.outward=candidates;
        else entries.returning=candidates;
      }catch(err){
        issues.push(p.first+' '+p.last+' / '+queryDirection.kind+' : '+err.message);
      }
    }
    plans.set(p.id,entries);
    progress(i+1,participants.length,p);
    // Keep the interface responsive even when reading large GTFS files.
    if(i%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {plans,issues};
}
