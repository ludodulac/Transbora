/** Plan one event for many people. Work is entirely inside the browser; no PII uploads. */
import {searchFeed,normalizeStop} from './search-multi.mjs';
import {findConnections,officialIndex} from './connections.mjs';
import {findTwoChanges} from './connections-two.mjs';
import {parisInstant,parisDate} from './time-zones.mjs';
import {queryKey,itineraryKey} from './events-model.mjs';
const MAX_ROUTES=3;
const DAY_MS=86400000;
// Calendar shifts avoid local DST hazards: dates are dates, not 24-hour local clocks.
export function shiftDate(iso,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new Error('Date de voyage invalide');
  const base=Date.parse(iso+'T12:00:00Z');
  if(!Number.isFinite(base)||new Date(base).toISOString().slice(0,10)!==iso)
    throw new Error('Date de voyage invalide');
  return new Date(base+days*DAY_MS).toISOString().slice(0,10);
}
/** The event is a PRESENCE boundary, not a prescribed travel date.
 * The search discovers dates progressively from the published timetables.
 * Individual Excel dates, when provided deliberately, remain strict overrides.
 */
export function travelDates(event,p,kind){
  const outbound=kind==='A';
  const forced=p?.[outbound?'outwardDate':'returnDate']||
    (outbound?event.outwardDate:event.returnDate)||'';
  return forced?[shiftDate(forced,0)]:[];
}
function absTime(route){
  return +parisInstant(route.date,route.departure);
}
export function travelBoundary(event,kind){
  const limits=eventBoundaries(event);
  const margin=Number(kind==='A'?event.arrivalMargin:event.departureMargin);
  const minutes=Number.isFinite(margin)?margin:60;
  return (kind==='A'?limits.start-minutes*60000:limits.end+minutes*60000);
}
function tiePenalty(route){
  const transfers=route.transfers||(route.transfer?[route.transfer]:[]);
  const changes=transfers.length;
  const short=transfers.filter(t=>t.waitingSeconds-t.minimumSeconds<15*60).length;
  const walk=transfers.filter(t=>t.proximity!=='same_station').length;
  return changes*1800+short*900+walk*1800+(route.arrival-route.departure)*0.05;
}
/** Primary criterion is closeness to the PRESENCE/departure boundary.
 * Allers: latest station arrival <= boundary; retours: earliest
 * station departure >= boundary. Change count & journey length break ties.
 */
export function compareJourneys(a,b,kind,boundary){
  const time=j=>+parisInstant(j.date,kind==='A'?j.arrival:j.departure);
  const gapA=Math.abs(time(a)-boundary),gapB=Math.abs(time(b)-boundary);
  return gapA-gapB||tiePenalty(a)-tiePenalty(b)
    ||(a.changes||0)-(b.changes||0)
    ||absTime(a)-absTime(b);
}
function publishedRange(feeds,config){
  const selected=feeds.filter(f=>config.mode==='all'||f.source.mode===config.mode);
  const min=selected.map(f=>f.data.meta?.first).filter(Boolean).sort()[0];
  const max=selected.map(f=>f.data.meta?.last).filter(Boolean).sort().at(-1);
  return {selected,min,max};
}
function maximumPathSeconds(feeds,config){
  const {selected}=publishedRange(feeds,config);
  let longest=0;
  for(const feed of selected)for(const trip of feed.data.trips){
    const stops=trip[4]||[];
    if(stops.length<2)continue;
    const duration=stops.at(-1)[1]-stops[0][2];
    if(Number.isFinite(duration))longest=Math.max(longest,duration);
  }
  const changes=config.connections==='two'?2:config.connections==='no'?0:1;
  // GTFS changes allow up to four hours' wait per interchange.
  return Math.max(86400,(changes+1)*longest+changes*14400);
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
  const date=route.date||eventDate;
  const time=+parisInstant(date,direction==='A'?route.arrival:route.departure);
  return Math.abs(boundary-time);
}
export function pickItineraries(all,query,event,direction,{maximum=MAX_ROUTES}={}){
  const deadline=travelBoundary(event,direction),day=query.date,seen=new Set(),valid=[];
  for(const route of all){
    const departure=+parisInstant(day,route.departure);
    const arrival=+parisInstant(day,route.arrival);
    if(!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<=departure)continue;
    if(direction==='A'&&arrival>deadline)continue;
    if(direction==='R'&&departure<deadline)continue;
    const key=itineraryKey(route);
    if(seen.has(key))continue;
    seen.add(key);
    valid.push({...route,key,date:day});
  }
  valid.sort((a,b)=>compareJourneys(a,b,direction,deadline));
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
    if(query.date<f.data.meta.first||query.date>shiftDate(f.data.meta.last,1))continue;
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
  const coverage=publishedRange(feeds,settings);
  const maxPath=maximumPathSeconds(feeds,settings);
  async function searchDirection(queryData,p,kind){
    const explicit=travelDates(event,p,kind);
    const {min,max:publishedEnd}=coverage;
    if(!min||!publishedEnd)return {choices:[],searched:[],covered:false};
    const deadline=travelBoundary(event,kind);
    const boundaryDay=kind==='A'?event.startDate:event.endDate;
    const finalClockDay=shiftDate(publishedEnd,1);
    const starting=kind==='A'?
      [boundaryDay,finalClockDay].sort()[0]:
      [boundaryDay,min].sort().at(-1);
    const ending=kind==='A'?min:finalClockDay;
    let current=explicit.length?explicit[0]:starting;
    if(explicit.length===0 && (kind==='A'?current<ending:current>ending))
      return {choices:[],searched:[],covered:false};
    let covered=false;
    const searched=[],found=new Map();
    while(explicit.length?(searched.length<1):(kind==='A'?current>=ending:current<=ending)){
      const date=current;
      searched.push(date);
      const query={...queryData,date,earliest:'00:00',latest:'23:59'};
      const k=queryKey(query,settings);
      covered ||=coverage.selected.some(f=>date>=f.data.meta.first&&date<=shiftDate(f.data.meta.last,1));
      try{
        if(!cache.has(k))cache.set(k,allOptions(feeds,query,settings,officialRules));
        for(const route of pickItineraries(cache.get(k),query,event,kind,{maximum:200})){
          if(!found.has(route.key))found.set(route.key,route);
        }
      }catch(error){
        issues.push(p.first+' '+p.last+' / '+kind+' le '+date+' : '+error.message);
      }
      const best=[...found.values()].sort((a,b)=>compareJourneys(a,b,kind,deadline));
      if(!explicit.length&&best.length>=max){
        if(kind==='R')break; // later dates cannot depart before earlier dates.
        // A train departing BEFORE this date might still arrive very close
        // to the deadline if it crosses midnight (or several days).
        // Stop only when such a departure cannot beat our last candidate.
        const previous=shiftDate(date,-1);
        const latestOlderArrival=+parisInstant(previous,86400)+maxPath*1000;
        const selectedArrival=+parisInstant(best[max-1].date,best[max-1].arrival);
        if(latestOlderArrival<selectedArrival)break;
      }
      if(explicit.length)break;
      current=shiftDate(current,kind==='A'?-1:1);
      // Yield between timetable days so mobile UIs can repaint.
      if(searched.length%2===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {choices:[...found.values()].sort((a,b)=>compareJourneys(a,b,kind,deadline)).slice(0,max),
      searched,covered};
  }
  for(let i=0;i<participants.length;i++){
    const p=participants[i];
    const entries={outwardDate:event.startDate,returnDate:event.endDate,
      outwardDates:[],returnDates:[],outward:[],returning:[]};
    for(const kind of ['A','R']){
      if(kind==='A'&&event.includeOutward===false)continue;
      if(kind==='R'&&event.includeReturn===false)continue;
      const from=kind==='A'?p.departure:event.destination;
      const to=kind==='A'?event.destination:p.departure;
      if(normalizeStop(from)===normalizeStop(to)){
        issues.push(p.first+' '+p.last+' : départ et arrivée identiques.');
        continue;
      }
      const {choices,searched,covered}=await searchDirection({from,to},p,kind);
      if(kind==='A'){entries.outward=choices;entries.outwardDates=searched;entries.outwardDate=searched[0]||event.startDate;}
      else{entries.returning=choices;entries.returnDates=searched;entries.returnDate=searched[0]||event.endDate;}
      if(!covered)issues.push(p.first+' '+p.last+' : aucun horaire publié pour '+(kind==='A'?'l’aller':'le retour')+
        ' autour de l’heure demandée.');
    }
    plans.set(p.id,entries);
    progress(i+1,participants.length,p);
    if(i%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {plans,issues};
}
