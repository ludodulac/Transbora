/** Plan one event for many people. Work is entirely inside the browser; no PII uploads. */
import {searchFeed,normalizeStop,matchesStop} from './search-multi.mjs';
import {findConnections,officialIndex} from './connections.mjs';
import {findTwoChanges} from './connections-two.mjs';
import {parisInstant,parisDate} from './time-zones.mjs';
import {queryKey,itineraryKey} from './events-model.mjs';
import {canBeDirect,canBeOneChange} from './route-topology.mjs';
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
/** Compare different transport types together. A journey departing only a little
 * later should not lose to a coach which takes several hours longer.
 * This is a timetable score, NOT a fare, remaining-seat or reliability score.
 * Preserve the organizer's arrival/departure boundary as a hard constraint.
 */
export function compareMultimodalJourneys(a,b,kind,boundary){
  const score=j=>{
    const relevant=kind==='A'?j.arrival:j.departure;
    const gap=Math.abs(+parisInstant(j.date,relevant)-boundary)/1000;
    const journeyTime=Math.max(0,j.arrival-j.departure);
    return gap+0.65*journeyTime+0.5*tiePenalty(j);
  };
  return score(a)-score(b)||compareJourneys(a,b,kind,boundary);
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
  const changes=(config.connections==='two'||config.connections==='auto')?2:config.connections==='no'?0:1;
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
  const onlyOne=config.connections==='only_one';
  const onlyTwo=config.connections==='only_two';
  let list=[];
  if(!onlyOne&&!onlyTwo)for(const f of chosen){
    if(query.date<f.data.meta.first||query.date>shiftDate(f.data.meta.last,1))continue;
    list.push(...searchFeed(f.data,query,f.source));
  }
  if(onlyOne||(!onlyTwo&&config.connections!=='no')){
    list.push(...findConnections(chosen,query,{profile:config.buffer,officialRules,limit:100,
      allowRiskyInterstation:config.allowRiskyInterstation===true}));
  }
  if(onlyTwo||config.connections==='two'){
    list.push(...findTwoChanges(chosen,query,{profile:config.buffer,officialRules,limit:90}));
  }
  return list;
}
export async function planEvent(event,participants,feeds,settings,officialRules=new Map(),progress=()=>{},options={}){
  // Normal event searches have NO arbitrary time budget: they finish once
  // enough valid itineraries are found and older/later service days cannot
  // improve them, or when all the published GTFS dates have been explored.
  // A caller may still opt into a timeout for controlled tests or audits.
  const began=Date.now();
  const duration=Number.isFinite(options.maxDurationMs)?options.maxDurationMs:Infinity;
  const perDirection=Number.isFinite(options.maxDirectionMs)?options.maxDirectionMs:Infinity;
  const timedOut=()=>Date.now()-began>duration;
  const cancelled=()=>Boolean(options.shouldAbort?.());
  eventBoundaries(event);
  const cache=new Map(),plans=new Map(),issues=[];
  let partial=false;
  const max=Math.max(1,Math.min(5,Number(settings.maxOptions)||3));
  async function searchDirection(queryData,p,kind,searchSettings=settings,boundaryEvent=event){
    const coverage=publishedRange(feeds,searchSettings);
    const maxPath=maximumPathSeconds(feeds,searchSettings);
    const reportIssues=searchSettings.mode===settings.mode;
    const explicit=travelDates(event,p,kind);
    const {min,max:publishedEnd}=coverage;
    const dirStarted=Date.now();
    if(!min||!publishedEnd)return {choices:[],searched:[],covered:false,reason:'no_published_data'};
    // Skip a costly full-calendar search when a selected source has no stop
    // bearing the requested city/station name at all.
    // Each endpoint may be served by a DIFFERENT operator. Never require
    // both stop names in one feed, or legitimate multimodal journeys vanish.
    const knownFrom=coverage.selected.some(f=>f.data.stations.some(s=>matchesStop(s[1],queryData.from)));
    const knownTo=coverage.selected.some(f=>f.data.stations.some(s=>matchesStop(s[1],queryData.to)));
    const knownPair=knownFrom&&knownTo;
    if(!knownPair){
      if(reportIssues)issues.push(p.first+' '+p.last+' : '+(!knownFrom?'départ':'destination')+
        ' non reconnu dans les gares/arrêts publiés pour '+kind+'.');
      return {choices:[],searched:[],covered:false,
        reason:!knownFrom?'unknown_origin':'unknown_destination'};
    }
    const deadline=travelBoundary(boundaryEvent,kind);
    const boundaryDay=kind==='A'?event.startDate:event.endDate;
    const finalClockDay=shiftDate(publishedEnd,1);
    const starting=kind==='A'?
      [boundaryDay,finalClockDay].sort()[0]:
      [boundaryDay,min].sort().at(-1);
    const ending=kind==='A'?min:finalClockDay;
    let current=explicit.length?explicit[0]:starting;
    if(explicit.length===0 && (kind==='A'?current<ending:current>ending))
      return {choices:[],searched:[],covered:false,reason:'no_published_data'};
    let covered=false,directionIncomplete=false;
    const searched=[],found=new Map();
    // Auto mode escalates only when earlier tiers yield no valid itinerary.
    // Prefer direct trips, then one transfer, then two transfers only when
    // the earlier tier has no matching itinerary. Every leg and transfer
    // is validated by the same existing routing engines.
    const automatic=searchSettings.connections==='auto';
    const tiers=automatic?['no','only_one','only_two']:[searchSettings.connections];
    const tierLabels={no:'directs',only_one:'1 correspondance',only_two:'2 correspondances'};
    let chosenTier=null;
    for(let level=0;level<tiers.length;level++){
      if(cancelled())throw new Error('Recherche interrompue.');
      if(timedOut()||Date.now()-dirStarted>perDirection){
        partial=true;directionIncomplete=true;
        issues.push(p.first+' '+p.last+' : recherche '+kind+' incomplète, délai atteint.');
        break;
      }
      const tier=tiers[level];
      const tierConfig={...searchSettings,connections:tier};
      options.onTier?.({person:p,kind,tier,level});
      // There is no need to scan every service date to disprove a direct
      // or single-change route: first rule out impossible connections in
      // the complete timetable's station graph (independent of calendar).
      if(automatic&&tier==='no'&&!canBeDirect(coverage.selected,queryData.from,queryData.to,searchSettings)){
        options.onTier?.({person:p,kind,tier,level,skipped:true});
        continue;
      }
      if(automatic&&tier==='only_one'&&!canBeOneChange(coverage.selected,queryData.from,queryData.to,searchSettings)){
        options.onTier?.({person:p,kind,tier,level,skipped:true});
        continue;
      }
      let tierTruncated=false;
      let current=explicit.length?explicit[0]:starting;
      const tierFound=new Map();
      while(explicit.length?(current===explicit[0]):(kind==='A'?current>=ending:current<=ending)){
        if(cancelled())throw new Error('Recherche interrompue.');
        if(timedOut()||Date.now()-dirStarted>perDirection){
          tierTruncated=true;
          directionIncomplete=true;partial=true;
          break;
        }
        const date=current;
        options.onDay?.({person:p,kind,date,searched:searched.length+1,
          level:automatic?level:null});
        searched.push(date);
        const query={...queryData,date,earliest:'00:00',latest:'23:59'};
        const key=queryKey(query,tierConfig);
        covered ||=coverage.selected.some(f=>
          date>=f.data.meta.first&&date<=shiftDate(f.data.meta.last,1));
        try{
          if(!cache.has(key))cache.set(key,allOptions(feeds,query,tierConfig,officialRules));
          for(const route of pickItineraries(cache.get(key),query,boundaryEvent,kind,{maximum:200})){
            if(!tierFound.has(route.key))tierFound.set(route.key,route);
          }
        }catch(err){
          issues.push(p.first+' '+p.last+' / '+kind+' le '+date+' : '+err.message);
        }
        const ranked=[...tierFound.values()].sort((a,b)=>compareJourneys(a,b,kind,deadline));
        if(!explicit.length&&ranked.length>=max){
          if(kind==='R')break;
          const previous=shiftDate(date,-1);
          const latestOlderArrival=+parisInstant(previous,86400)+maxPath*1000;
          const selectedArrival=+parisInstant(ranked[max-1].date,ranked[max-1].arrival);
          if(latestOlderArrival<selectedArrival)break;
        }
        if(explicit.length)break;
        current=shiftDate(current,kind==='A'?-1:1);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(tierFound.size){
        chosenTier=tier;
        for(const [k,v] of tierFound)found.set(k,v);
        break;
      }
      if(tierTruncated)issues.push(p.first+' '+p.last+' : niveau '+
        (tierLabels[tier]||tier)+' exploré partiellement ; résultats non exhaustifs.');
    }
    const choices=[...found.values()].sort((a,b)=>compareJourneys(a,b,kind,deadline)).slice(0,max);
    return {choices,searched,covered,level:chosenTier,
      reason:directionIncomplete?'incomplete':
        !covered?'no_published_data':!choices.length?'not_found':null};
  }
  for(let i=0;i<participants.length;i++){
    const p=participants[i];
    if(cancelled())throw new Error('Recherche interrompue.');
    if(timedOut()){
      partial=true;
      issues.push('Recherche partielle : limite globale de temps atteinte. Certains voyageurs restent sans proposition.');
      // Provide empty, explicitly incomplete plans for remaining participants.
      for(const rest of participants.slice(i))plans.set(rest.id,{
        outwardDate:event.startDate,returnDate:event.endDate,
        outwardDates:[],returnDates:[],outward:[],returning:[]});
      break;
    }
    const entries={outwardDate:event.startDate,returnDate:event.endDate,
      outwardDates:[],returnDates:[],outward:[],returning:[],
      reasons:{A:null,R:null},levels:{A:null,R:null}};
    for(const kind of ['A','R']){
      if(kind==='A'&&event.includeOutward===false)continue;
      if(kind==='R'&&event.includeReturn===false)continue;
      const from=kind==='A'?p.departure:event.destination;
      const to=kind==='A'?event.destination:p.departure;
      if(normalizeStop(from)===normalizeStop(to)){
        issues.push(p.first+' '+p.last+' : départ et arrivée identiques.');
        continue;
      }
      // Train + autocar means a union of eligible itineraries, not "stop as
      // soon as ANY operator has a direct service". Search rail, road and
      // cross-provider journeys independently so a direct coach cannot hide
      // a faster train with a change (and vice versa).
      const multimodal=settings.mode==='all'&&settings.connections==='auto';
      const modes=multimodal?['rail','bus','all']:[settings.mode];
      const runs=[];
      for(const mode of modes){
        if(multimodal&&mode!=='all'&&!feeds.some(f=>f.source.mode===mode))continue;
        runs.push(await searchDirection({from,to},p,kind,{...settings,mode,allowRiskyInterstation:false}));
      }
      const byKey=new Map();
      for(const run of runs)for(const journey of run.choices)
        if(!byKey.has(journey.key))byKey.set(journey.key,journey);
      const boundary=travelBoundary(event,kind);
      const scorer=(a,b)=>multimodal
        ?compareMultimodalJourneys(a,b,kind,boundary)
        :compareJourneys(a,b,kind,boundary);
      let ranked=[...byKey.values()].sort(scorer);

      // A published DIRECT service from the previous day should not hide a
      // later-arriving, SAFE transfer on the event day. The usual automatic
      // search first checks direct services; this one-day complement does NOT
      // relax interchange or station-to-venue margins, nor the transport mode.
      // A route departing the previous evening but arriving on event day is
      // NOT "arriving the previous day" and keeps its existing ranking.
      const eventMidnight=+parisInstant(event.startDate,0);
      const hasPreviousDayArrival=ranked.some(j=>
        +parisInstant(j.date,j.arrival)<eventMidnight);
      const explicitlyDated=travelDates(event,p,kind).length>0;
      const dayArrivals=ranked.filter(j=>
        +parisInstant(j.date,j.arrival)>=eventMidnight);
      if(kind==='A'&&settings.connections==='auto'&&!explicitlyDated&&
        hasPreviousDayArrival&&dayArrivals.length<max){
        const date=event.startDate;
        const query={from,to,date,earliest:'00:00',latest:'23:59'};
        const searchSafeTier=tier=>{
          for(const mode of modes){
            if(multimodal&&mode!=='all'&&!feeds.some(f=>f.source.mode===mode))continue;
            const selected=feeds.filter(f=>mode==='all'||f.source.mode===mode);
            if(tier==='only_one'&&!canBeOneChange(selected,from,to,{mode}))continue;
            const config={...settings,mode,connections:tier,allowRiskyInterstation:false};
            const key=queryKey(query,config);
            try{
              if(!cache.has(key))cache.set(key,allOptions(feeds,query,config,officialRules));
              const valid=pickItineraries(cache.get(key),query,event,kind,{maximum:250});
              for(const journey of valid){
                // Only depart on the event day; avoid a hidden overnight
                // interpretation for services expressed as GTFS >24:00.
                const depDay=parisDate(date,journey.departure);
                const wantedDay=parisDate(date,0);
                if(depDay!==wantedDay)continue;
                if(!byKey.has(journey.key))byKey.set(journey.key,journey);
              }
            }catch(err){
              issues.push(p.first+' '+p.last+' / A le '+date+' : '+err.message);
            }
          }
        };
        if(!cancelled()&&!timedOut())searchSafeTier('only_one');
        // Two changes only as a fallback if the first pass still leaves
        // the organizer with previous-day arrivals among the top options.
        ranked=[...byKey.values()].sort(scorer);
        if(ranked.slice(0,max).some(j=>+parisInstant(j.date,j.arrival)<eventMidnight)
            &&!cancelled()&&!timedOut())searchSafeTier('only_two');
        ranked=[...byKey.values()].sort(scorer);
      }
      const choices=ranked.slice(0,max);
      const searched=[...new Set(runs.flatMap(run=>run.searched))];
      let covered=runs.some(run=>run.covered);
      const mainRun=runs.at(-1);
      let level=runs.find(run=>run.choices.some(j=>j.key===choices[0]?.key))?.level||null;
      // Only when explicitly requested: display separately flagged suggestions
      // with reduced station-to-venue access time (minimum 30 minutes).
      const margin=Number(kind==='A'?event.arrivalMargin:event.departureMargin);
      if(settings.allowReducedMargin && Number.isFinite(margin) && margin>30 &&
        choices.length<5){
        const softEvent={...event,[kind==='A'?'arrivalMargin':'departureMargin']:30};
        const extras=[],excluded=new Set(choices.map(j=>j.key));
        const limits=eventBoundaries(event);
        for(const mode of modes){
          if(multimodal&&mode!=='all'&&!feeds.some(f=>f.source.mode===mode))continue;
          const run=await searchDirection({from,to},p,kind,{...settings,mode,allowRiskyInterstation:false},softEvent);
          covered ||=run.covered;
          for(const d of run.searched)if(!searched.includes(d))searched.push(d);
          for(const j of run.choices){
            if(excluded.has(j.key))continue;
            const time=+parisInstant(j.date,kind==='A'?j.arrival:j.departure);
            const minutes=(kind==='A'?limits.start-time:time-limits.end)/60000;
            if(minutes<30||minutes>=margin)continue;
            excluded.add(j.key);
            extras.push({...j,marginReduced:true,actualMarginMinutes:Math.floor(minutes),
              requestedMarginMinutes:margin});
          }
        }
        extras.sort((a,b)=>multimodal?compareMultimodalJourneys(a,b,kind,boundary):
          compareJourneys(a,b,kind,boundary));
        const room=Math.min(5-choices.length,Math.max(1,max-choices.length));
        choices.push(...extras.slice(0,room));
      }
      // Opt-in supplementary options: never replace or downgrade safe choices.
      // First version: vetted NAME PAIR only (Paris-Montparnasse / Paris-Gare de Lyon),
      // one rail-to-rail change, limited to the event day (and next-day returns).
      // Interstation journey durations are UNKNOWN: these are explicitly risky.
      if(settings.allowRiskyInterstation && settings.mode!=='bus'){
        const railFeeds=feeds.filter(f=>f.source.mode==='rail');
        const dates=kind==='A'?[event.startDate]:
          [event.endDate,shiftDate(event.endDate,1)];
        const excluded=new Set(choices.map(j=>j.key)),risks=new Map();
        for(const date of dates){
          if(cancelled())throw new Error('Recherche interrompue.');
          if(timedOut())break;
          const query={from,to,date,earliest:'00:00',latest:'23:59'};
          const raw=findConnections(railFeeds,query,{
            profile:settings.buffer,officialRules,limit:250,allowRiskyInterstation:true});
          // Only keep deliberately flagged station changes, never leak safe results
          // from this supplemental search into the principal ranking.
          const risky=raw.filter(j=>j.riskAlternative===true);
          for(const journey of pickItineraries(risky,query,event,kind,{maximum:200})){
            if(!excluded.has(journey.key)&&!risks.has(journey.key))
              risks.set(journey.key,journey);
          }
        }
        const extras=[...risks.values()].sort((a,b)=>compareJourneys(a,b,kind,boundary));
        choices.push(...extras.slice(0,2)); // up to 2, in addition to 2–5 safe proposals
      }
      const reason=choices.length?null:mainRun?.reason||'no_published_data';
      entries.reasons[kind]=reason;
      entries.levels[kind]=level;
      if(kind==='A'){entries.outward=choices;entries.outwardDates=searched;entries.outwardDate=searched[0]||event.startDate;}
      else{entries.returning=choices;entries.returnDates=searched;entries.returnDate=searched[0]||event.endDate;}
      if(!covered&&reason!=='unknown_origin'&&reason!=='unknown_destination')
        issues.push(p.first+' '+p.last+' : aucune donnée de circulation exploitable dans la période publiée pour '+
          (kind==='A'?'l’aller':'le retour')+'.');
    }
    plans.set(p.id,entries);
    progress(i+1,participants.length,p);
    if(i%2===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {plans,issues,partial};
}
