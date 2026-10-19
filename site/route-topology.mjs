/** Necessary connectivity checks independent of dates and fares.
 * When a connection is impossible even in the theoretical GTFS network,
 * skip scanning hundreds of calendar days. A positive answer is NOT a
 * promised journey: real services and interchange margins must still match.
 */
import {stationIndexes} from './search-multi.mjs';
import {compatible,stationRecord,geoCell,coordKey} from './connections.mjs';

const cache=new WeakMap();
function allTripSegments(feed,stopName,kind){
  let indexed=cache.get(feed.data);
  if(!indexed){indexed=new Map();cache.set(feed.data,indexed);}
  const key=kind+'|'+stopName;
  if(indexed.has(key))return indexed.get(key);
  const stationIds=stationIndexes(feed.data,stopName),result=new Set();
  for(const trip of feed.data.trips){
    const stops=trip[4]||[];
    let seen=false;
    if(kind==='forward'){
      // Any alighting stop reachable after boarding at the requested origin.
      for(const stop of stops){
        if(stop[4]===1&&seen)result.add(stop[0]);
        if(stop[3]===1&&stationIds.has(stop[0]))seen=true;
      }
    }else{
      // Any boarding stop that can reach the requested destination later.
      for(let i=stops.length-1;i>=0;i--){
        const stop=stops[i];
        if(stop[3]===1&&seen)result.add(stop[0]);
        if(stop[4]===1&&stationIds.has(stop[0]))seen=true;
      }
    }
  }
  indexed.set(key,result);
  return result;
}
function eligibleFeeds(feeds,config){
  return feeds.filter(f=>config.mode==='all'||f.source.mode===config.mode);
}
/** A valid direct itinerary must have a trip with both stations in order. */
export function canBeDirect(feeds,from,to,config){
  return eligibleFeeds(feeds,config).some(feed=>{
    const destinations=stationIndexes(feed.data,to);
    if(!destinations.size)return false;
    const reached=allTripSegments(feed,from,'forward');
    for(const stop of destinations)if(reached.has(stop))return true;
    return false;
  });
}
/** A valid 1-change journey must share the same GTFS station or transfer
 * between coordinates within the router's cross-provider 100m threshold.
 * This intentionally returns true in ambiguous cases, to avoid excluding
 * valid routes. Service-day checks happen in findConnections().
 */
export function canBeOneChange(feeds,from,to,config){
  const chosen=eligibleFeeds(feeds,config);
  const arrivals=[],departures=[],lastSpatial=new Map();
  for(const feed of chosen){
    for(const index of allTripSegments(feed,from,'forward'))
      arrivals.push(stationRecord(feed,index));
    for(const index of allTripSegments(feed,to,'backward')){
      const stop=stationRecord(feed,index);
      departures.push(stop);
      const cell=geoCell(stop.station);
      if(cell){
        const id=coordKey(cell[0],cell[1]);
        if(!lastSpatial.has(id))lastSpatial.set(id,[]);
        lastSpatial.get(id).push(stop);
      }
    }
  }
  if(!arrivals.length||!departures.length)return false;
  for(const arrival of arrivals){
    if(departures.some(stop=>arrival.source.id===stop.source.id&&arrival.index===stop.index))
      return true;
    const cell=geoCell(arrival.station);
    if(!cell)continue;
    for(let x=cell[0]-2;x<=cell[0]+2;x++)for(let y=cell[1]-2;y<=cell[1]+2;y++){
      for(const other of lastSpatial.get(coordKey(x,y))||[]){
        if(compatible(arrival,other))return true;
      }
    }
  }
  return false;
}
