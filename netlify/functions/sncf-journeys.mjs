/** SNCF API proxy: official journeys without ever shipping a private token to the browser.
 * Pure comparison endpoint: fares, seats, and bookings are NOT verified.
 */
const endpoint='https://api.sncf.com/v1/coverage/sncf';
const utf8=(value,max=110)=>typeof value==='string'?value.trim().slice(0,max):'';
const fail=(error,status)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
const cache=new Map();
async function official(path,params,token){
  const url=new URL(endpoint+path);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  const response=await fetch(url,{headers:{
    authorization:'Basic '+Buffer.from(token+':').toString('base64'),
    accept:'application/json'
  },signal:AbortSignal.timeout(11000)});
  if(!response.ok)throw Error('SNCF '+response.status);
  return response.json();
}
function safeDate(date){
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date+'T12:00:00Z'))&&
    new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
}
function selectPlace(results,wanted){
  const places=(results.places||[]).filter(x=>
    ['stop_area','administrative_region'].includes(x.embedded_type));
  const normalize=x=>String(x||'').toLocaleLowerCase('fr-FR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s*\([^)]*\)/g,'').trim();
  const name=normalize(wanted);
  const exact=places.find(x=>normalize(x.name)===name);
  const starts=places.find(x=>normalize(x.name).startsWith(name+' '));
  return (exact||starts||places[0])?.id||'';
}
function publicOnly(journey){
  const rail=(journey.sections||[]).filter(x=>x.type==='public_transport');
  if(!rail.length||rail.length>3)return null;
  const times=/^\d{8}T\d{6}$/;
  if(!times.test(journey.departure_date_time||'')||
     !times.test(journey.arrival_date_time||''))return null;
  const first=rail[0],last=rail.at(-1);
  const legs=rail.map(section=>{
    const from=utf8(section.from?.name,140),to=utf8(section.to?.name,140);
    const display=section.display_informations||{};
    const dep=section.departure_date_time,arr=section.arrival_date_time;
    if(!from||!to||!times.test(dep||'')||!times.test(arr||''))return null;
    return {from,to,departure:dep,arrival:arr,
      route:utf8(display.commercial_mode||display.physical_mode||'Train',60),
      line:utf8(display.code,45)};
  });
  if(legs.some(x=>!x))return null;
  return {departure:first.departure_date_time,arrival:last.arrival_date_time,
    legs,changes:legs.length-1,source:'SNCF API',disruptions:[]};
}
export default async function handler(request){
  if(request.method!=='POST')return fail('Méthode non autorisée.',405);
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin)return fail('Origine non autorisée.',403);
  const token=globalThis.Netlify?.env?.get('SNCF_API_TOKEN')||process.env.SNCF_API_TOKEN;
  if(!token)return fail('API SNCF non configurée.',503);
  try{
    const raw=await request.text();
    if(raw.length>1500)return fail('Requête trop volumineuse.',413);
    const input=JSON.parse(raw);
    const from=utf8(input.from),to=utf8(input.to),day=utf8(input.date,10);
    const time=utf8(input.time,5),direction=input.direction;
    if(!from||!to||from.length<2||to.length<2||!safeDate(day)||
       !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)||
       !['A','R'].includes(direction))return fail('Gares ou dates invalides.',400);
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',
      year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const offset=(Date.parse(day+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000;
    if(offset < -1 || offset>23)return fail('Date hors fenêtre SNCF (J-1 à J+23).',422);
    const key=[from,to,day,time,direction].join('|').toLocaleLowerCase('fr-FR');
    const old=cache.get(key);
    if(old&&old.expires>Date.now())return Response.json(old.data);
    const [fromResult,toResult]=await Promise.all([
      official('/places',{q:from,'type[]':'stop_area'},token),
      official('/places',{q:to,'type[]':'stop_area'},token)
    ]);
    const fromId=selectPlace(fromResult,from),toId=selectPlace(toResult,to);
    if(!fromId||!toId)return fail('Gare SNCF non reconnue.',422);
    const payload=await official('/journeys',{
      from:fromId,to:toId,
      datetime:day.replaceAll('-','')+'T'+time.replace(':','')+'00',
      datetime_represents:direction==='A'?'arrival':'departure',
      count:5,data_freshness:'base_schedule'
    },token);
    const journeys=(payload.journeys||[]).map(publicOnly).filter(Boolean).slice(0,5);
    const data={source:'SNCF API',journeys};
    if(cache.size>180)cache.clear();
    cache.set(key,{data,expires:Date.now()+10*60000});
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){
    // Do not leak auth values, SNCF URLs, or transport-provider response text.
    return fail('Consultation SNCF temporairement indisponible.',503);
  }
}
export const config={
  path:'/api/sncf/journeys',
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:35}
};
