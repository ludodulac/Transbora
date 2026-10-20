// Direct scheduled journeys (no transfers, prices, seat availability or live data).
// Search is based on stop names, not geographical interchangeability.
import {durationText} from './engine.mjs';
import {shiftToParis,isoDateAtDay,parisTime,parisDate} from './time-zones.mjs';
const DAY=86400;

export function normalizeStop(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').trim();
}
export function matchesStop(name, value) {
  const stop=normalizeStop(name), query=normalizeStop(value);
  if(query.length<3) return false;
  // "Paris Gare de Lyon" is a Paris station, never the city of Lyon.
  // Otherwise a search for Lyon erroneously considers it a destination stop
  // and rejects valid connections DEPARTING from Paris Gare de Lyon.
  if(query==='lyon'&&stop.startsWith('paris gare de lyon'))return false;
  return stop===query || stop.startsWith(query+' ') || stop.includes(' '+query+' ') ||
         stop.endsWith(' '+query);
}
// These indexes are built once per GTFS file rather than once per
// searched calendar day. The weak key avoids retaining old timetables.
const stopLookupCache=new WeakMap();
export function stationIndexes(data,stopName){
  let queries=stopLookupCache.get(data);
  if(!queries){queries=new Map();stopLookupCache.set(data,queries);}
  const key=normalizeStop(stopName);
  if(!queries.has(key)){
    const found=new Set();
    data.stations.forEach((row,i)=>{if(matchesStop(row[1],key))found.add(i);});
    queries.set(key,found);
  }
  return queries.get(key);
}
const decodedMasks=new Map();
function maskData(value){
  let bytes=decodedMasks.get(value);
  if(bytes===undefined){
    bytes=atob(value||'');
    if(decodedMasks.size>4000)decodedMasks.clear();
    decodedMasks.set(value,bytes);
  }
  return bytes;
}
function dateDay(value) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value))return NaN;
  const t=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===value ? Math.floor(t/86400000):NaN;
}
function runOn(encoded, index) {
  if(index<0)return false;
  const bytes=maskData(encoded);
  const b=Math.floor(index/8);
  return b<bytes.length && Boolean(bytes.charCodeAt(b)&(1 << (index%8)));
}
export function searchFeed(data, params, source) {
  const day=dateDay(params.date);
  const first=dateDay(data.meta.first),last=dateDay(data.meta.last);
  // The final published GTFS service day may include trips after 24:00.
  if(!Number.isFinite(day) || day<first || day>last+1)return [];
  const origins=stationIndexes(data,params.from);
  const targets=stationIndexes(data,params.to);
  if(!origins.size || !targets.size)return [];
  const toSeconds=s=>{const [h,m]=s.split(':').map(Number);return h*3600+m*60;};
  const start=toSeconds(params.earliest||'00:00'), end=toSeconds(params.latest||'23:59')+59;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return [];
  const output=[];
  for(let serviceDay=Math.max(first,day-1);serviceDay<=Math.min(day,last);serviceDay++){
    const clockShift=shiftToParis(params.date,isoDateAtDay(serviceDay),data.meta.timezone||'Europe/Paris');
    for(let t=0;t<data.trips.length;t++){
      const trip=data.trips[t];
      if(!runOn(data.services[trip[0]],serviceDay-first))continue;
      const stops=trip[4];
      for(let i=0;i<stops.length-1;i++){
        const from=stops[i];
        if(!origins.has(from[0])||from[3]!==1)continue;
        const departure=from[2]+clockShift;
        if(departure<start||departure>end)continue;
        for(let j=i+1;j<stops.length;j++){
          const to=stops[j];
          if(!targets.has(to[0])||to[4]!==1||to[1]<from[2])continue;
          output.push({
            id:source.id+':'+t+':'+serviceDay+':'+i+':'+j,
            departure,arrival:to[1]+clockShift,
            from:data.stations[from[0]][1],to:data.stations[to[0]][1],
            provider:source.label,providerId:source.id,mode:source.mode,
            route:trip[1]||'',number:trip[3]||'',headsign:trip[2]||''
          });
          break;
        }
      }
    }
  }
  return output.sort((a,b)=>a.departure-b.departure||a.arrival-b.arrival);
}
export function proposalText(journeys, params) {
  const lines=['PROPOSITION D’HORAIRES — TRANSBORA',
    params.from+' → '+params.to,
    'Date de départ : '+parisDate(params.date),''];
  for(let i=0;i<journeys.length;i++){
    const j=journeys[i];
    const legs=j.legs?.length>=2?j.legs:[j];
    const dateSuffix=parisDate(params.date,j.arrival)!==parisDate(params.date,j.departure)?' ('+parisDate(params.date,j.arrival)+')':'';
    lines.push((i+1)+'. '+parisDate(params.date,j.departure)+' '+parisTime(params.date,j.departure)
      +' — '+parisTime(params.date,j.arrival)+dateSuffix+' | '+durationText(j.arrival-j.departure)
      +' | '+(legs.length===1?'Direct':(legs.length-1)+' correspondance(s)'));
    for(const [index,leg] of legs.entries()){
      const departureSuffix=parisDate(params.date,leg.departure)!==parisDate(params.date)?' ('+parisDate(params.date,leg.departure)+')':'';
      const arrivalSuffix=parisDate(params.date,leg.arrival)!==parisDate(params.date)?' ('+parisDate(params.date,leg.arrival)+')':'';
      lines.push('   '+(index+1)+') '+(leg.mode==='bus'?'Autocar':'Train')
        +' '+leg.provider+(leg.number?' n° '+leg.number:'')
        +' : '+leg.from+' '+parisTime(params.date,leg.departure)+departureSuffix
        +' → '+leg.to+' '+parisTime(params.date,leg.arrival)+arrivalSuffix);
    }
    for(const [changeIndex,change] of (j.transfers|| (j.transfer?[j.transfer]:[])).entries()){
      lines.push('   Changement '+(changeIndex+1)+' à '+change.station
        +(change.station!==change.departureStation?' → '+change.departureStation:'')
        +' : '+durationText(change.waitingSeconds)+' disponibles'
        +' (marge de prudence retenue '+durationText(change.minimumSeconds)+').'
        +(change.source?.includes('SNCF')?' Règle SNCF spécifique vérifiée.':''));
      if(change.proximity==='nearby_unverified')
        lines.push('   ATTENTION : arrêts proches géographiquement, trajet piéton non vérifié.');
    }
    lines.push('');
  }
  lines.push('Horaires théoriques indicatifs. Ni réservation, ni garantie de correspondance, ni protection automatique en cas de retard.',
    'Vérifier les horaires, billets, règles de correspondance, quais et contrôles auprès des transporteurs : les marges sont des précautions, pas des garanties.',
    'Horaires affichés en heure de Paris. Pour les trajets internationaux, vérifier les heures locales auprès des compagnies.');
  return lines.join('\n');
}
