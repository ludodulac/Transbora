/** Organizer dossier index on this browser.
 * This is NOT a public server-side catalogue. Owner capability links are
 * sensitive: never send them to participants or embed them in exports.
 */
export const HISTORY_KEY='transbora_owner_dossiers_v021';
const LIMIT=300;
export function readHistory(storage){
  try{
    const data=JSON.parse(storage?.getItem(HISTORY_KEY)||'[]');
    return Array.isArray(data)?data.filter(valid).slice(0,LIMIT):[];
  }catch{return [];}
}
function valid(x){
  return x&&typeof x==='object'&&/^[\w-]{20,90}$/.test(x.eventId||'')&&
    /^[\w-]{20,90}$/.test(x.ownerKey||'')&&typeof x.title==='string'&&
    /^\d{4}-\d\d-\d\d$/.test(x.endDate||'');
}
export function registerHistory(storage,{eventId,ownerKey,event,peopleCount=0},now=Date.now()){
  if(!event||!valid({eventId,ownerKey,title:event.title,endDate:event.endDate}))return false;
  const current=readHistory(storage);
  const previous=current.find(x=>x.eventId===eventId);
  const entry={eventId,ownerKey,title:event.title.slice(0,90),
    destination:String(event.destination||'').slice(0,140),
    startDate:String(event.startDate||'').slice(0,10),endDate:event.endDate,
    peopleCount:Number(peopleCount)||0,createdAt:previous?.createdAt||now};
  const next=[entry,...current.filter(x=>x.eventId!==eventId)].slice(0,LIMIT);
  try{storage.setItem(HISTORY_KEY,JSON.stringify(next));return true;}catch{return false;}
}
export function forgetHistory(storage,eventId){
  try{
    storage.setItem(HISTORY_KEY,JSON.stringify(
      readHistory(storage).filter(x=>x.eventId!==eventId)));
    return true;
  }catch{return false;}
}
export function parseOwnerLink(raw,origin){
  try{
    const u=new URL(raw,origin);
    if(u.origin!==origin||!u.pathname.endsWith('/suivi.html'))return null;
    const params=new URLSearchParams(u.hash.slice(1));
    const eventId=params.get('event'),ownerKey=params.get('key');
    return valid({eventId,ownerKey,title:'Dossier',endDate:'2026-01-01'})?
      {eventId,ownerKey}:null;
  }catch{return null;}
}
export function ownerUrl(eventId,ownerKey,locationHref){
  const u=new URL('./suivi.html',locationHref);
  u.hash='event='+encodeURIComponent(eventId)+'&key='+encodeURIComponent(ownerKey);
  return u.href;
}
