/** Safe per-person station summary, including dossiers created before routeEnds. */
function legacyStop(p,kind,field){
 const text=p.options?.[kind]?.[0]?.label||'';
 const part=text.split(' | ').find(x=>x.startsWith(field+': '));
 return part?part.slice(field.length+2).trim():'';
}
export function stationPair(p,kind,eventDestination=''){
 const ends=p.routeEnds?.[kind]||{};
 const from=ends.from||legacyStop(p,kind,'Départ')||
   (kind==='A'?p.departure:eventDestination);
 const to=ends.to||legacyStop(p,kind,'Arrivée')||
   (kind==='A'?eventDestination:p.departure);
 return {from,to};
}
