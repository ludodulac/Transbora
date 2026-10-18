// Direct scheduled journeys (no transfers, prices, seat availability or live data).
// Search is based on stop names, not geographical interchangeability.
import {timeText, dateText, durationText} from './engine.mjs';
const DAY=86400;

export function normalizeStop(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').trim();
}
export function matchesStop(name, value) {
  const stop=normalizeStop(name), query=normalizeStop(value);
  if(query.length<3) return false;
  return stop===query || stop.startsWith(query+' ') || stop.includes(' '+query+' ') ||
         stop.endsWith(' '+query);
}
function dateDay(value) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value))return NaN;
  const t=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===value ? Math.floor(t/86400000):NaN;
}
function runOn(encoded, index) {
  if(index<0)return false;
  const bytes=atob(encoded||'');
  const b=Math.floor(index/8);
  return b<bytes.length && Boolean(bytes.charCodeAt(b)&(1 << (index%8)));
}
export function searchFeed(data, params, source) {
  const day=dateDay(params.date);
  const first=dateDay(data.meta.first),last=dateDay(data.meta.last);
  if(!Number.isFinite(day) || day<first || day>last)return [];
  const origins=new Set(),targets=new Set();
  data.stations.forEach((entry,i)=>{
    if(matchesStop(entry[1],params.from))origins.add(i);
    if(matchesStop(entry[1],params.to))targets.add(i);
  });
  if(!origins.size || !targets.size)return [];
  const toSeconds=s=>{const [h,m]=s.split(':').map(Number);return h*3600+m*60;};
  const start=toSeconds(params.earliest||'00:00'), end=toSeconds(params.latest||'23:59')+59;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return [];
  const output=[];
  for(let serviceDay=Math.max(first,day-1);serviceDay<=day;serviceDay++){
    for(let t=0;t<data.trips.length;t++){
      const trip=data.trips[t];
      if(!runOn(data.services[trip[0]],serviceDay-first))continue;
      const stops=trip[4];
      for(let i=0;i<stops.length-1;i++){
        const from=stops[i];
        if(!origins.has(from[0])||from[3]!==1)continue;
        const departure=from[2]+(serviceDay-day)*DAY;
        if(departure<start||departure>end)continue;
        for(let j=i+1;j<stops.length;j++){
          const to=stops[j];
          if(!targets.has(to[0])||to[4]!==1||to[1]<from[2])continue;
          output.push({
            id:source.id+':'+t+':'+serviceDay+':'+i+':'+j,
            departure,arrival:to[1]+(serviceDay-day)*DAY,
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
    'Date : '+dateText(params.date),''];
  for(let i=0;i<journeys.length;i++){
    const j=journeys[i];
    const nextDate=Math.floor(j.arrival/DAY)!==0?' ('+dateText(params.date,j.arrival)+')':'';
    lines.push((i+1)+'. '+(j.mode==='bus'?'Autocar':'Train')+' '+j.provider
      +(j.number?' n° '+j.number:'')
      +' | '+j.from+' '+timeText(j.departure)+' → '+j.to+' '+timeText(j.arrival)
      +nextDate+' | '+durationText(j.arrival-j.departure)+' | Sans correspondance');
  }
  lines.push('','Horaires théoriques indicatifs. Tarifs et places non vérifiés.',
    'Vérifier les horaires auprès de chaque transporteur avant toute réservation.');
  return lines.join('\n');
}
