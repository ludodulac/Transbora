/** Plan one event for many people. Work is entirely inside the browser; no PII uploads. */
import {searchFeed,normalizeStop} from './search-multi.mjs';
import {findConnections,officialIndex} from './connections.mjs';
import {findTwoChanges} from './connections-two.mjs';
import {parisInstant,parisDate} from './time-zones.mjs';
import {queryKey,itineraryKey} from './events-model.mjs';
const MAX_ROUTES=3;
const DAY_MS=86400000;
const MAX_ADJACENT_DAYS=7;
// Calendar arithmetic in UTC avoids accidentally skipping/duplicating a date
// at Europe/Paris DST changes in March/October.
export function shiftDate(iso,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new Error('Date de voyage invalide');
  const base=Date.parse(iso+'T12:00:00Z');
  if(!Number.isFinite(base)||new Date(base).toISOString().slice(0,10)!==iso)
    throw new Error('Date de voyage invalide');
  return new Date(base+days*DAY_MS).toISOString().slice(0,10);
}
export function travelDates(event,p,kind){
  // Explicit dates from either the individual traveler or the event are exact:
  // never override a deliberate date with other calendar days.
  const outgoing=kind==='A';
  const explicit=p?.[outgoing?'outwardDate':'returnDate'] ||
    (outgoing?event.outwardDate:event.returnDate) || '';
  if(explicit)return [shiftDate(explicit,0)];
  const day=outgoing?event.startDate:event.endDate;
  const days=Math.max(0,Math.min(MAX_ADJACENT_DAYS,
    Number(outgoing?event.daysBefore:event.daysAfter) || 0));
  const dates=[];
  for(let d=outgoing?-days:0;d<=(outgoing?0:days);d++)
    dates.push(shiftDate(day,d));
  return dates;
}
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
  eventBoundaries(event);
  const cache=new Map(),plans=new Map(),issues=[];
  const max=Math.max(1,Math.min(5,Number(settings.maxOptions)||3));
  const haveCoverage=feeds.some(f=>f.data?.meta?.first&&f.data?.meta?.last);
  for(let i=0;i<participants.length;i++){
    const p=participants[i];
    const outwardDates=travelDates(event,p,'A'),returnDates=travelDates(event,p,'R');
    const entries={outwardDate:outwardDates.at(-1),returnDate:returnDates[0],
      outwardDates,returnDates,outward:[],returning:[]};
    const directions=[
      ...(event.includeOutward===false?[]:[{kind:'A',from:p.departure,to:event.destination,dates:outwardDates}]),
      ...(event.includeReturn===false?[]:[{kind:'R',from:event.destination,to:p.departure,dates:returnDates}])
    ];
    for(const dir of directions){
      if(normalizeStop(dir.from)===normalizeStop(dir.to)){
        issues.push(p.first+' '+p.last+' : départ et arrivée identiques.');
        continue;
      }
      const options=[];
      let anyCoveredDay=false;
      for(const date of dir.dates){
        const query={from:dir.from,to:dir.to,date,earliest:'00:00',latest:'23:59'};
        const key=queryKey(query,settings);
        if(feeds.some(f=>date>=f.data.meta.first&&date<=f.data.meta.last))anyCoveredDay=true;
        try{
          if(!cache.has(key))cache.set(key,allOptions(feeds,query,settings,officialRules));
          // Limit after collecting all requested days, never per date: prevents
          // Monday's first 3 options from hiding a better Sunday night train.
          options.push(...pickItineraries(cache.get(key),query,event,dir.kind,{maximum:150}));
        }catch(err){
          issues.push(p.first+' '+p.last+' / '+dir.kind+' le '+date+' : '+err.message);
        }
      }
      if(!anyCoveredDay && haveCoverage)
        issues.push(p.first+' '+p.last+' : horaires non publiés pour '+dir.kind+' du '+
          dir.dates[0]+' au '+dir.dates.at(-1)+'.');
      const boundary=dir.kind==='A'
        ? +parisInstant(event.startDate,sec(event.startTime))-Number(event.arrivalMargin??90)*60000
        : +parisInstant(event.endDate,sec(event.endTime))+Number(event.departureMargin??45)*60000;
      // All candidates have their own reference service date: compare true
      // instants, not displayed HH:mm strings, when ranking overnight routes.
      const dedup=new Set();
      const ranked=options.filter(j=>{
        const fingerprint=j.key;
        if(dedup.has(fingerprint))return false;
        dedup.add(fingerprint);return true;
      }).sort((a,b)=>rank(a,dir.kind,a.date,boundary)-rank(b,dir.kind,b.date,boundary)
        ||(a.changes||0)-(b.changes||0)
        ||(+parisInstant(a.date,a.departure))-(+parisInstant(b.date,b.departure)));
      // A same-day train should not hide every viable earlier-day/next-day
      // alternative when the result cap is small. Offer one per calendar
      // departure day first, then fill spare slots by global merit.
      const balanced=[],selected=new Set(),coveredDays=new Set();
      for(const journey of ranked){
        const day=parisDate(journey.date,journey.departure);
        if(coveredDays.has(day))continue;
        balanced.push(journey);selected.add(journey.key);coveredDays.add(day);
        if(balanced.length>=max)break;
      }
      if(balanced.length<max)for(const journey of ranked){
        if(selected.has(journey.key))continue;
        balanced.push(journey);selected.add(journey.key);
        if(balanced.length>=max)break;
      }
      balanced.sort((a,b)=>rank(a,dir.kind,a.date,boundary)-rank(b,dir.kind,b.date,boundary));
      if(dir.kind==='A')entries.outward=balanced;
      else entries.returning=balanced;
    }
    plans.set(p.id,entries);
    progress(i+1,participants.length,p);
    // Release main thread periodically for responsive Android UI.
    if(i%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {plans,issues};
}
