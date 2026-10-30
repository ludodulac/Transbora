/**
 * TRANSBORA 044 — local-only bridge between the organizer's rehearsal and
 * the existing real timetable search. This is NOT a server synchronization.
 * Never put invitations, organizer credentials, owner keys, email, or telephone
 * numbers into these messages. Only explicit demo data may be transferred.
 */
export const HANDOFF_KEY='transbora_demo_search_handoff_044';
export const RESULTS_KEY='transbora_demo_search_results_044';
const TTL=12*60*60*1000;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const shorten=(value,max=160)=>String(value??'').trim().slice(0,max);
function current(entry,now){
  return entry?.version===1 && Number.isFinite(entry.createdAt) &&
    entry.createdAt<=now+60000 && now-entry.createdAt>=0 &&
    now-entry.createdAt<TTL;
}
function read(storage,key,now){
  try{
    const raw=storage.getItem(key);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(!current(data,now)){storage.removeItem(key);return null;}
    return data;
  }catch{return null;}
}
export function createSearchHandoff(storage,{event,people,participations},now=Date.now()){
  if(!event?.id||!event.title||!ISO.test(event.startDate||'')||!event.destination)
    throw Error('Événement incomplet : renseignez son nom, sa date et sa ville.');
  const members=(participations||[]).filter(p=>p.eventId===event.id);
  const travelers=members.map(link=>{
    const p=(people||[]).find(p=>p.id===link.personId);
    if(!p)throw Error('Une fiche participant est introuvable.');
    if(!shorten(p.departure)||!shorten(p.name))
      throw Error('Indiquez le nom et la gare habituelle de chaque participant.');
    return {personId:p.id,name:shorten(p.name,120),
      departure:shorten(p.departure,140),
      reductionCards:shorten(p.reductionCards,160),
      preferences:shorten(p.preferences,240)};
  });
  if(!travelers.length)throw Error('Inscrivez au moins une personne à cet événement.');
  if(travelers.length>100)throw Error('Maximum 100 participants.');
  if(new Set(travelers.map(p=>p.personId)).size!==travelers.length)
    throw Error('Participant inscrit plusieurs fois.');
  const handoff={version:1,createdAt:now,eventId:event.id,
    title:shorten(event.title,90),destination:shorten(event.destination,120),
    startDate:event.startDate,travelers};
  storage.setItem(HANDOFF_KEY,JSON.stringify(handoff));
  storage.removeItem(RESULTS_KEY);
  return handoff;
}
export function readSearchHandoff(storage,now=Date.now()){
  const data=read(storage,HANDOFF_KEY,now);
  if(!data||!data.eventId||!ISO.test(data.startDate||'')||
    !data.title||!data.destination||!Array.isArray(data.travelers)||
    !data.travelers.length||data.travelers.length>100||
    data.travelers.some(p=>!p.personId||!p.name||!p.departure))return null;
  return data;
}
/** Names with a single word are allowed and are NOT expanded with fabricated surnames. */
export function wizardPeople(handoff){
  return handoff.travelers.map((person,index)=>{
    const pieces=person.name.trim().split(/\s+/);
    return {id:'P-'+String(index+1).padStart(3,'0'),first:pieces[0],
      last:pieces.slice(1).join(' '),departure:person.departure,
      organizerPersonId:person.personId,
      reductionCards:person.reductionCards||'',
      preferences:person.preferences||'',outwardDate:'',returnDate:'',notes:''};
  });
}
function isoFromParisDate(value){
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return m?m[3]+'-'+m[2]+'-'+m[1]:null;
}
/** Formats only REAL routes actually returned by the search engine.
 * Prices remain null — no rate or seat availability is inferred.
 */
export function routesFromSearch(handoff,participants,plans,{parisDate,parisTime}){
  const rows=[];
  for(const person of participants){
    if(!handoff.travelers.some(p=>p.personId===person.organizerPersonId))continue;
    const plan=plans.get(person.id);
    if(!plan)continue;
    for(const [direction,list] of [['A',plan.outward||[]],['R',plan.returning||[]]]){
      for(const trip of list.slice(0,5)){
        const day=trip.date|| (direction==='A'?plan.outwardDate:plan.returnDate);
        const raw=trip.legs?.length?trip.legs:[trip];
        if(!ISO.test(day||'')||!raw.length||raw.length>6)continue;
        const legs=raw.map((leg,index)=>({
          order:index+1,from:shorten(leg.from,150),to:shorten(leg.to,150),
          departure:parisTime(day,leg.departure),arrival:parisTime(day,leg.arrival),
          departureDate:isoFromParisDate(parisDate(day,leg.departure)),
          arrivalDate:isoFromParisDate(parisDate(day,leg.arrival)),
          mode:leg.mode==='bus'?'bus':'rail',operator:shorten(leg.provider,100)
        }));
        if(legs.some(leg=>!leg.from||!leg.to||!TIME.test(leg.departure)||
           !TIME.test(leg.arrival)||!ISO.test(leg.departureDate||'')||
           !ISO.test(leg.arrivalDate||'')))continue;
        const travelDate=legs[0].departureDate;
        const sourceKey=JSON.stringify([person.organizerPersonId,direction,travelDate,
          legs.map(x=>[x.from,x.to,x.departureDate,x.departure,x.arrivalDate,x.arrival,x.mode])]);
        rows.push({personId:person.organizerPersonId,direction,travelDate,legs,
          sourceKey,estimatedCents:null});
      }
    }
  }
  return {eventId:handoff.eventId,rows};
}
export function writeSearchResults(storage,result,now=Date.now()){
  if(!result?.eventId||!Array.isArray(result.rows)||result.rows.length>1000)
    throw Error('Résultats de recherche invalides.');
  storage.setItem(RESULTS_KEY,JSON.stringify({
    version:1,createdAt:now,eventId:result.eventId,rows:result.rows
  }));
}
export function readSearchResults(storage,now=Date.now()){
  const data=read(storage,RESULTS_KEY,now);
  if(!data||!data.eventId||!Array.isArray(data.rows)||data.rows.length>1000)
    return null;
  return data;
}
