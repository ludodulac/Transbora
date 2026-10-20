/** Train/bus identifiers only when supplied by the published timetable.
 * Never confuse GTFS internal trip IDs with commercial train numbers.
 */
export function journeyLegs(route){
  return route?.legs?.length?route.legs:[route];
}
export function serviceDescription(leg){
  const mode=leg?.mode==='bus'?'Autocar':'Train';
  const route=String(leg?.route||'').trim();
  const provider=String(leg?.provider||'').trim();
  const number=String(leg?.number||'').trim();
  const label=[mode,route&&route.toLowerCase()!==mode.toLowerCase()?route:null,
    provider&&provider!==route?provider:null].filter(Boolean).join(' · ');
  return label+(number?' · n° '+number:' · numéro non renseigné par la source');
}
export function serviceSummary(route){
  return journeyLegs(route).map((leg,index)=>
    (journeyLegs(route).length>1?'Tronçon '+(index+1)+' : ':'')+
    serviceDescription(leg)).join(' / ');
}
/** Identical outward clocks are not proof of a duplicate train.
 * Only warn: the timetable may contain distinct services or routes.
 */
export function sameClockOptions(a,b){
  if(!a||!b||a===b)return false;
  const left=journeyLegs(a),right=journeyLegs(b);
  return a.date===b.date&&a.departure===b.departure&&a.arrival===b.arrival&&
    left[0]?.from===right[0]?.from&&left.at(-1)?.to===right.at(-1)?.to;
}
