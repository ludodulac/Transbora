/**
 * Transbora safe one-change itinerary finder.
 * Timetables are planned, not live; no missed-connection guarantee.
 * Generic GTFS transfer rules are applied when provided.
 */
import {matchesStop, normalizeStop} from './search-multi.mjs';
import {isoDateAtDay,shiftToParis} from './time-zones.mjs';

const DAY = 86400;
const MAX_WAIT = 4 * 3600;  // do not recommend an overnight station wait as a normal transfer
const GEO_LIMIT_METERS = 100;  // geographic proximity is NOT a validated walking path

function dayNum(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const t=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===value
    ? Math.floor(t/(DAY*1000)) : NaN;
}
function maskRuns(mask, day) {
  if (day < 0 || !mask) return false;
  const bytes=atob(mask);
  return Math.floor(day/8)<bytes.length &&
    Boolean(bytes.charCodeAt(Math.floor(day/8)) & (1 << (day%8)));
}
function distance(a,b) {
  if (![a?.[2],a?.[3],b?.[2],b?.[3]].every(Number.isFinite)) return Infinity;
  const rad=Math.PI/180, la1=a[2]*rad,la2=b[2]*rad;
  const dl=(b[3]-a[3])*rad, df=(b[2]-a[2])*rad;
  const h=Math.sin(df/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dl/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
const transferId=(providerId,index)=>providerId+':'+index;
function geoCell(station) {
  if (![station?.[2],station?.[3]].every(Number.isFinite)) return null;
  return [Math.floor(station[2]*1000),Math.floor(station[3]*1000)];
}
function coordKey(x,y) {return x+','+y;}

function margin(first,second,profile) {
  const calm = profile === 'very_cautious';
  let minutes = calm ? 45 : 30; // two trains at same station, deliberately prudent baseline
  if (first.source.id!==second.source.id) minutes=Math.max(minutes,calm?60:40);
  if (first.source.mode==='bus' || second.source.mode==='bus')
    minutes=Math.max(minutes,calm?90:60);
  // Eurostar may require security/passport checks before London routes.
  // Without route-specific border data, always apply a high precautionary buffer.
  if (second.source.id==='eurostar') minutes=Math.max(minutes,calm?120:90);
  return minutes*60;
}
function transferRule(feed,from,to) {
  if (feed.source.id !== from.source.id || feed.source.id !== to.source.id) return null;
  return feed.rules.get(from.index+':'+to.index) || null;
}
function compatible(first, second) {
  if (first.source.id===second.source.id && first.index===second.index)
    return {sameStation:true,distanceMeters:0};
  if (first.source.id===second.source.id) return null; // do not infer intra-feed walking paths
  if (!first.zone || !second.zone) return null; // timezones have been normalized to one clock
  const metres=distance(first.station,second.station);
  if (metres>GEO_LIMIT_METERS) return null;
  return {sameStation:false,distanceMeters:Math.round(metres)};
}
function leg(feed,tripIndex,trip,serviceDay,fromIndex,toIndex,clockShift) {
  const start=trip[4][fromIndex],end=trip[4][toIndex];
  const dep=start[2]+clockShift;
  const arr=end[1]+clockShift;
  if (arr<=dep || arr-dep>DAY*2) return null;
  const beginStop=feed.data.stations[start[0]],endStop=feed.data.stations[end[0]];
  return {id:feed.source.id+':'+tripIndex+':'+serviceDay+':'+fromIndex+':'+toIndex,
    tripKey:feed.source.id+':'+tripIndex+':'+serviceDay,
    departure:dep, arrival:arr,
    from:beginStop[1],to:endStop[1],
    fromIndex:start[0],toIndex:end[0],
    provider:feed.source.label,providerId:feed.source.id,mode:feed.source.mode,
    route:trip[1]||'',number:trip[3]||'',headsign:trip[2]||''};
}

function enumerate(feed,params,earliest,latest,day) {
  const first=dayNum(feed.data.meta.first),last=dayNum(feed.data.meta.last);
  const initial=[],final=[];
  const origin=new Set(), destination=new Set();
  feed.data.stations.forEach((entry,i)=>{
    if (matchesStop(entry[1],params.from)) origin.add(i);
    if (matchesStop(entry[1],params.to)) destination.add(i);
  });
  if (!origin.size && !destination.size) return {initial,final};
  // First leg departs on the selected date; the second can depart the next day.
  for(let serviceDay=day-1;serviceDay<=day+1;serviceDay++){
    if(serviceDay<first||serviceDay>last) continue;
    const clockShift=shiftToParis(params.date,isoDateAtDay(serviceDay),feed.data.meta.timezone||'Europe/Paris');
    for(let index=0;index<feed.data.trips.length;index++){
      const trip=feed.data.trips[index];
      if(!maskRuns(feed.data.services[trip[0]],serviceDay-first))continue;
      const stops=trip[4];
      const starts=[],ends=[];
      for(let i=0;i<stops.length;i++){
        const at=stops[i];
        if(origin.has(at[0]) && at[3]===1){
          const departure=at[2]+clockShift;
          if(departure>=earliest && departure<=latest)starts.push(i);
        }
        if(destination.has(at[0]) && at[4]===1){
          const arrival=at[1]+clockShift;
          if(arrival>earliest && arrival<=latest+DAY*2)ends.push(i);
        }
      }
      for(const i of starts){
        for(let j=i+1;j<stops.length;j++){
          if(stops[j][4]!==1 || destination.has(stops[j][0]) || origin.has(stops[j][0]))continue;
          const l=leg(feed,index,trip,serviceDay,i,j,clockShift);
          if(l)initial.push(l);
        }
      }
      for(const j of ends){
        for(let i=0;i<j;i++){
          if(stops[i][3]!==1 || origin.has(stops[i][0]) || destination.has(stops[i][0]))continue;
          const l=leg(feed,index,trip,serviceDay,i,j,clockShift);
          if(l && l.departure>=earliest && l.departure<=latest+MAX_WAIT+DAY)
            final.push(l);
        }
      }
    }
  }
  return {initial,final};
}
function stationRecord(feed,index) {
  return {source:feed.source,zone:feed.data.meta.timezone,index,
    station:feed.data.stations[index]};
}

export function findConnections(feeds, params, opts={}) {
  const requested=dayNum(params.date);
  if (!Number.isFinite(requested) || normalizeStop(params.from)===normalizeStop(params.to))return [];
  const start=Number((params.earliest||'00:00').split(':')[0])*3600+
              Number((params.earliest||'00:00').split(':')[1])*60;
  const end=Number((params.latest||'23:59').split(':')[0])*3600+
            Number((params.latest||'23:59').split(':')[1])*60+59;
  if (!Number.isFinite(start)||!Number.isFinite(end)||start>end)return [];
  const context=new Map();
  const firstLegs=[],lastLegs=[];
  for(const item of feeds){
    const rules=new Map();
    for(const [from,to,kind,seconds] of item.data.transfers||[])
      rules.set(from+':'+to,[kind,seconds]);
    const feed={...item,rules};
    context.set(feed.source.id,feed);
    const pairs=enumerate(feed,params,start,end,requested);
    firstLegs.push(...pairs.initial);
    lastLegs.push(...pairs.final);
  }
  if(!firstLegs.length||!lastLegs.length)return [];

  const stationLegs=new Map(), spatial=new Map(),lastStopCache=new Map();
  for(const l of lastLegs){
    const k=transferId(l.providerId,l.fromIndex);
    if(!stationLegs.has(k))stationLegs.set(k,[]);
    stationLegs.get(k).push(l);
  }
  for(const [key, legs] of stationLegs){
    legs.sort((a,b)=>a.departure-b.departure);
    const l=legs[0], record=stationRecord(context.get(l.providerId),l.fromIndex);
    lastStopCache.set(key,record);
    const cell=geoCell(record.station);
    if(cell){
      const key=coordKey(cell[0],cell[1]);
      if(!spatial.has(key))spatial.set(key,[]);
      spatial.get(key).push(transferId(l.providerId,l.fromIndex));
    }
  }
  const outputs=new Map();
  for(const first of firstLegs){
    const originFeed=context.get(first.providerId);
    const arrival=stationRecord(originFeed,first.toIndex);
    const candidates=new Set([transferId(first.providerId,first.toIndex)]);
    const cell=geoCell(arrival.station);
    if(cell)for(let x=cell[0]-2;x<=cell[0]+2;x++){
      for(let y=cell[1]-2;y<=cell[1]+2;y++){
        for(const key of spatial.get(coordKey(x,y))||[])candidates.add(key);
      }
    }
    for(const key of candidates){
      const secondStation=lastStopCache.get(key);
      if(!secondStation)continue;
      const proximity=compatible(arrival,secondStation);
      if(!proximity)continue;
      const secondFeed=context.get(secondStation.source.id);
      const rule=transferRule(originFeed,arrival,secondStation);
      if(rule?.[0]===3)continue; // explicitly forbidden GTFS transfer
      for(const second of stationLegs.get(key)||[]){
        if(second.tripKey===first.tripKey)continue;
        const minSec=Math.max(margin(arrival,secondStation,opts.profile),rule?.[1]||0);
        const wait=second.departure-first.arrival;
        if(wait<minSec)continue;
        if(wait>MAX_WAIT)break;
        if(second.arrival<=first.arrival)continue;
        const elapsed=second.arrival-first.departure;
        if(elapsed > DAY*2)continue;
        const risk=wait-minSec<15*60?'marge limitée':'marge confortable';
        const transfer={station:first.to,departureStation:second.from,
          waitingSeconds:wait,minimumSeconds:minSec,
          proximity:proximity.sameStation?'same_station':'nearby_unverified',
          metres:proximity.distanceMeters, risk};
        const id=first.id+'+'+second.id;
        outputs.set(id,{id,departure:first.departure,arrival:second.arrival,
          from:first.from,to:second.to,legs:[first,second],
          transfer,changes:1,mode:first.mode===second.mode?first.mode:'mixed',
          score:elapsed+(wait>90*60?(wait-90*60)/3:0)+(proximity.sameStation?0:15*60)});
      }
    }
  }
  // Prefer shorter total travel times, then earlier arrival. Do not claim guaranteed connections.
  return [...outputs.values()].sort((a,b)=>a.score-b.score||a.arrival-b.arrival).slice(0,opts.limit||120);
}
