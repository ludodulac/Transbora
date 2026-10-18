/** Bounded, date-aware, two-change timetable search.
 * Enumerates a middle scheduled service between first- and last-leg station sets.
 * Withhold unsupported interchange locations; never assume a same-name station.
 * Some results may be missed by per-boarding pruning; no exhaustiveness claim.
 */
import {
  dayNum, maskRuns, distance, geoCell, coordKey, compatible,
  enumerate, stationRecord, leg, assessTransfer, MAX_WAIT
} from './connections.mjs';
import {shiftToParis,isoDateAtDay} from './time-zones.mjs';
import {normalizeStop} from './search-multi.mjs';

const DAY=86400;
const EARLIEST_CANDIDATES=12;
const MAX_COMBINATIONS=250000;

const key=(provider,index)=>provider+':'+index;
function firstLastIndexes(feeds,params,start,end,date){
  const context=new Map(),first=new Map(),last=new Map();
  for(const source of feeds){
    const rules=new Map((source.data.transfers||[]).map(([a,b,k,v])=>[a+':'+b,[k,v]]));
    const f={...source,rules};
    context.set(f.source.id,f);
    const pairs=enumerate(f,params,start,end,date);
    for(const ride of pairs.initial){
      const k=key(ride.providerId,ride.toIndex);
      if(!first.has(k))first.set(k,[]);
      first.get(k).push(ride);
    }
    for(const ride of pairs.final){
      const k=key(ride.providerId,ride.fromIndex);
      if(!last.has(k))last.set(k,[]);
      last.get(k).push(ride);
    }
  }
  for(const array of first.values())array.sort((a,b)=>b.arrival-a.arrival);
  for(const array of last.values())array.sort((a,b)=>a.departure-b.departure);
  return {context,first,last};
}
function mapNeighbors(context, group) {
  const all=new Map(), grid=new Map();
  for(const k of group.keys()){
    const split=k.lastIndexOf(':'),source=k.slice(0,split),i=Number(k.slice(split+1));
    const f=context.get(source);
    if(!f)continue;
    const station=stationRecord(f,i);
    all.set(k,station);
    const cell=geoCell(station.station);
    if(cell) {
      const c=coordKey(cell[0],cell[1]);
      if(!grid.has(c))grid.set(c,[]);
      grid.get(c).push(k);
    }
  }
  return {all,grid,group,cache:new Map()};
}
function nearby(look,context,providerId,index) {
  const k=key(providerId,index);
  if(look.cache.has(k))return look.cache.get(k);
  const f=context.get(providerId);
  const self=stationRecord(f,index);
  const candidates=new Set([k]);
  const cell=geoCell(self.station);
  if(cell) for(let x=cell[0]-2;x<=cell[0]+2;x++)for(let y=cell[1]-2;y<=cell[1]+2;y++){
    for(const match of look.grid.get(coordKey(x,y))||[])candidates.add(match);
  }
  const result=[];
  for(const other of candidates){
    const station=look.all.get(other);
    if(!station)continue;
    // validate arrival-to-boarding position (or the reverse for the last leg)
    const ahead=look===context.__firstLookup;
    if(ahead?compatible(station,self):compatible(self,station))result.push(other);
  }
  look.cache.set(k,result);
  return result;
}
function shortlistFirst(firstKeys,lookup,dep) {
  const options=[];
  for(const k of firstKeys)for(const leg of lookup.group.get(k)||[]){
    const wait=dep-leg.arrival;
    if(wait>0 && wait<=MAX_WAIT)options.push(leg);
  }
  // Latest arriving trains are the most competitive on total journey time;
  // keep some variety of departures, rather than combinatorial cartesian product.
  return options.sort((a,b)=>b.arrival-a.arrival).slice(0,EARLIEST_CANDIDATES);
}
function shortlistLast(lastKeys,lookup,arr) {
  const options=[];
  for(const k of lastKeys)for(const leg of lookup.group.get(k)||[]){
    const wait=leg.departure-arr;
    if(wait>0 && wait<=MAX_WAIT)options.push(leg);
  }
  return options.sort((a,b)=>a.departure-b.departure).slice(0,EARLIEST_CANDIDATES);
}
function sortRank(j) {
  return j.arrival-j.departure+2*15*60+
    (j.transfers.some(t=>t.proximity!=='same_station')?20*60:0);
}
export function findTwoChanges(feeds,params,opts={}) {
  const date=dayNum(params.date);
  if(!Number.isFinite(date)||normalizeStop(params.from)===normalizeStop(params.to))return [];
  const parse=s=>{const [h,m]=(s||'').split(':').map(Number);return h*3600+m*60;};
  const start=parse(params.earliest||'00:00'),end=parse(params.latest||'23:59')+59;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return [];
  const {context,first,last}=firstLastIndexes(feeds,params,start,end,date);
  if(!first.size||!last.size)return [];
  const aLook=mapNeighbors(context,first),bLook=mapNeighbors(context,last);
  context.__firstLookup=aLook;
  const found=new Map();
  let combos=0,aborted=false;
  outer:for(const f of context.values()){
    const firstDate=dayNum(f.data.meta.first),lastDate=dayNum(f.data.meta.last);
    for(let serviceDay=Math.max(firstDate,date-1);serviceDay<=Math.min(lastDate,date+1);serviceDay++){
      const shift=shiftToParis(params.date,isoDateAtDay(serviceDay),f.data.meta.timezone||'Europe/Paris');
      for(let tripIndex=0;tripIndex<f.data.trips.length;tripIndex++){
        const trip=f.data.trips[tripIndex],stops=trip[4];
        if(!maskRuns(f.data.services[trip[0]],serviceDay-firstDate))continue;
        const incoming=[],outgoing=[];
        for(let i=0;i<stops.length;i++){
          const stop=stops[i],t=stop[3] ? stop[2]+shift : -Infinity;
          if(stop[3] && t>=start && t<=end+DAY &&
             nearby(aLook,context,f.source.id,stop[0]).length)incoming.push(i);
          if(stop[4] && stop[1]+shift>=start && stop[1]+shift<=end+DAY*2 &&
             nearby(bLook,context,f.source.id,stop[0]).length)outgoing.push(i);
        }
        if(!incoming.length||!outgoing.length)continue;
        for(const i of incoming){
          const from=stops[i];
          const previous=shortlistFirst(
            nearby(aLook,context,f.source.id,from[0]),aLook,from[2]+shift);
          if(!previous.length)continue;
          for(const j of outgoing){
            if(j<=i)continue;
            const to=stops[j];
            const middle=leg(f,tripIndex,trip,serviceDay,i,j,shift);
            if(!middle)continue;
            const following=shortlistLast(
              nearby(bLook,context,f.source.id,to[0]),bLook,middle.arrival);
            if(!following.length)continue;
            for(const firstLeg of previous){
              if(firstLeg.tripKey===middle.tripKey)continue;
              const transferA=assessTransfer(firstLeg,middle,context,{...opts,date:params.date});
              if(!transferA)continue;
              for(const lastLeg of following){
                combos++;
                if(combos>MAX_COMBINATIONS){aborted=true;break outer;}
                if(lastLeg.tripKey===middle.tripKey||lastLeg.tripKey===firstLeg.tripKey)continue;
                const transferB=assessTransfer(middle,lastLeg,context,{...opts,date:params.date});
                if(!transferB)continue;
                if(lastLeg.arrival<=firstLeg.departure||lastLeg.arrival-firstLeg.departure>2*DAY)continue;
                // avoid a second transfer at the first transfer station, i.e. fake routes
                if(firstLeg.to===lastLeg.from && middle.from===middle.to)continue;
                const legs=[firstLeg,middle,lastLeg];
                const signature=legs.map(l=>l.tripKey+':'+l.fromIndex+':'+l.toIndex).join('+');
                if(found.has(signature))continue;
                const journey={id:signature,departure:firstLeg.departure,arrival:lastLeg.arrival,
                  from:firstLeg.from,to:lastLeg.to,legs,transfers:[transferA,transferB],
                  changes:2,mode:legs.every(l=>l.mode==='rail')?'rail':legs.every(l=>l.mode==='bus')?'bus':'mixed'};
                journey.score=sortRank(journey);
                found.set(signature,journey);
              }
            }
          }
        }
      }
    }
  }
  const sorted=[...found.values()].sort((a,b)=>a.score-b.score || a.arrival-b.arrival);
  const limited=sorted.slice(0,opts.limit||60);
  limited.partial=aborted;
  return limited;
}
