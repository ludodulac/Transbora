/** Optional SNCF timetable comparison. All calls are same-origin; no token in JS.
 * This does not confirm prices, seats or bookings. A failed API call leaves GTFS intact.
 */
import {eventForPerson,travelBoundary,selectPracticalOutward,selectPracticalReturn,
  compareJourneys,RETURN_DEPARTURE_WINDOW_HOURS} from './event-planner.mjs';
import {parisInstant} from './time-zones.mjs';

const zone=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localInstant(value){
  const p=Object.fromEntries(zone.formatToParts(new Date(value))
    .filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
}
function naive(iso){
  if(!/^\d{8}T\d{6}$/.test(iso||''))return NaN;
  return Date.parse(iso.slice(0,4)+'-'+iso.slice(4,6)+'-'+iso.slice(6,8)+
    'T'+iso.slice(9,11)+':'+iso.slice(11,13)+':'+iso.slice(13,15)+'Z');
}
function sec(iso){return +iso.slice(9,11)*3600+ +iso.slice(11,13)*60+ +iso.slice(13,15);}
function date(iso){return iso.slice(0,4)+'-'+iso.slice(4,6)+'-'+iso.slice(6,8);}
function stopName(s){return String(s||'').toLocaleLowerCase('fr-FR')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  // The official API commonly appends the town in parentheses:
  // "Paris - Gare de Lyon - Hall 1 & 2 (Paris)" represents the same stop as
  // GTFS "Paris Gare de Lyon Hall 1 - 2", not a second independent train.
  .replace(/\s*\(([^)]*)\)/g,(match,inside,offset,full)=>{
    const context=(full.slice(0,offset).match(/[a-z0-9]+/g)||[]).join(' ');
    const detail=(inside.match(/[a-z0-9]+/g)||[]).join(' ');
    // Keep distinctions like "Mulhouse (bus station)" vs. the rail station.
    // Only remove a repeated city hint such as "(Paris)" or "(Mulhouse)".
    return detail&&(' '+context+' ').includes(' '+detail+' ')?' ':' '+detail+' ';
  })
  .replace(/^gare (de |du |d')?/,'').replace(/[^a-z0-9]+/g,' ').trim();}
function hash(value){
  let out=2166136261;
  for(const char of value)out=Math.imul(out^char.charCodeAt(0),16777619);
  return (out>>>0).toString(36);
}
export function officialJourney(raw,kind,personEvent,buffer='very_cautious'){
  if(!raw||!Array.isArray(raw.legs)||!raw.legs.length||raw.legs.length>3)return null;
  const start=naive(raw.departure),end=naive(raw.arrival);
  const elapsed=(end-start)/1000;
  if(!Number.isFinite(elapsed)||elapsed<=0||elapsed>48*3600)return null;
  const transfers=[];
  for(let i=1;i<raw.legs.length;i++){
    const previous=raw.legs[i-1],current=raw.legs[i];
    // A physical station change has no verified city-transfer duration:
    // don't put it in a principal safe recommendation.
    if(stopName(previous.to)!==stopName(current.from))return null;
    const waitingSeconds=(naive(current.departure)-naive(previous.arrival))/1000;
    const minimumSeconds=buffer==='very_cautious'?45*60:30*60;
    if(!Number.isFinite(waitingSeconds)||waitingSeconds<minimumSeconds)return null;
    transfers.push({station:previous.to,departureStation:current.from,
      waitingSeconds,minimumSeconds,proximity:'same_station'});
  }
  const from=raw.legs[0].from,to=raw.legs.at(-1).to;
  const depart=sec(raw.departure);
  const arrival=depart+elapsed;
  const travelDate=date(raw.departure);
  const boundary=travelBoundary(personEvent,kind);
  const actual=+parisInstant(travelDate,kind==='A'?arrival:depart);
  if(kind==='A'&&actual>boundary)return null;
  if(kind==='R'&&(actual<boundary||
    actual>boundary+RETURN_DEPARTURE_WINDOW_HOURS*3600000))return null;
  const legs=raw.legs.map((leg,i)=>({
    from:leg.from,to:leg.to,mode:'rail',provider:'SNCF (API officielle)',
    route:leg.route||'Train',number:'',line:leg.line||'',
    departure:sec(leg.departure)+(naive(leg.departure)-naive(raw.departure))/1000-
      (sec(leg.departure)-sec(raw.departure)),
    arrival:sec(leg.arrival)+(naive(leg.arrival)-naive(raw.departure))/1000-
      (sec(leg.arrival)-sec(raw.departure))
  }));
  const signature=raw.legs.map(l=>[l.from,l.to,l.departure,l.arrival,l.line].join('|')).join('/');
  const key='sncfapi-'+hash(raw.departure+'|'+raw.arrival+'|'+signature);
  return {key,id:key,date:travelDate,departure:depart,arrival,
    legs,transfers,changes:legs.length-1,from,to,mode:'rail',
    provider:'SNCF (API officielle)',route:legs[0].route,
    officialAlternative:true};
}
export async function fetchOfficialJourneys(event,person,kind,settings,onDiagnostic=()=>{}){
  if(settings.mode==='bus')return [];
  const personEvent=eventForPerson(event,person);
  const boundary=travelBoundary(personEvent,kind);
  const when=localInstant(boundary);
  const from=kind==='A'?(person.outwardOrigin||person.departure):
    (person.returnOrigin||event.destination);
  const to=kind==='A'?(person.outwardDestination||event.destination):
    (person.returnDestination||person.departure);
  if(!from||!to||from===to)return [];
  try{
    const response=await fetch('/api/sncf/journeys',{method:'POST',
      headers:{'content-type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({from,to,date:when.date,time:when.time,direction:kind}),
      signal:AbortSignal.timeout(16000)});
    if(!response.ok){
      onDiagnostic(response.status===422?'outside_coverage':'unavailable');
      return [];
    }
    const data=await response.json();
    const valid=(data.journeys||[]).map(raw=>officialJourney(raw,kind,personEvent,settings.buffer))
      .filter(Boolean);
    onDiagnostic('success');
    return valid;
  }catch{
    onDiagnostic('unavailable');
    return [];
  }
}
function signature(j){
  const legs=j.legs?.length?j.legs:[j];
  return [j.date,j.departure,j.arrival,stopName(legs[0]?.from),stopName(legs.at(-1)?.to),
    legs.map(x=>x.mode||j.mode||'').join(','), // never conflate coach vs train
    legs.slice(0,-1).map(x=>stopName(x.to)).join('|')].join('|');
}
export function mergeOfficialJourneys(current,additional,kind,event,person,maximum=5){
  if(!additional.length)return current;
  const eventPerson=eventForPerson(event,person),boundary=travelBoundary(eventPerson,kind);
  const unique=new Map();
  // Keep the official version first if the same clock/stations/changes coincide.
  for(const route of [...additional,...current]){
    const identity=signature(route);
    if(!unique.has(identity))unique.set(identity,route);
  }
  const candidates=[...unique.values()];
  const count=Math.max(1,Math.min(5,maximum));
  return kind==='R'?selectPracticalReturn(candidates,{deadline:boundary,maximum:count}):
    selectPracticalOutward(candidates,{deadline:boundary,eventDate:eventPerson.startDate,maximum:count});
}
