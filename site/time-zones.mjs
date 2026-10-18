/** Convert GTFS agency service-day times to one absolute Europe/Paris clock.
 * GTFS measures times from "noon minus 12 hours" on the service date;
 * using the noon UTC offset correctly handles overnight trips on DST-change days.
 */
const DAY_MS=86400000;
const OFFSET_REGEX=/^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/;
const noonCache=new Map();

function zoneOffsetMinutes(zone, ms) {
  const pieces=new Intl.DateTimeFormat('en-US',{
    timeZone:zone,timeZoneName:'shortOffset',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ms));
  const text=pieces.find(p=>p.type==='timeZoneName')?.value||'';
  const parsed=text.match(OFFSET_REGEX);
  if(!parsed)throw new Error('Fuseau horaire GTFS non pris en charge : '+zone+' ('+text+')');
  if(!parsed.groups?.sign)return 0;
  return (parsed.groups.sign==='-'?-1:1)*
    (Number(parsed.groups.hours)*60+Number(parsed.groups.minutes||0));
}
export function gtfsMidnightUtc(date,zone) {
  const key=zone+':'+date;
  if(noonCache.has(key))return noonCache.get(key);
  if(!/^\d{4}-\d\d-\d\d$/.test(date))throw new Error('Date invalide');
  const t=Date.parse(date+'T12:00:00Z');
  if(!Number.isFinite(t))throw new Error('Date GTFS invalide');
  const offset=zoneOffsetMinutes(zone,t);
  const result=t-offset*60000-12*3600000;
  noonCache.set(key,result);
  return result;
}
export function isoDateAtDay(dayNumber) {
  return new Date(dayNumber*DAY_MS).toISOString().slice(0,10);
}
export function shiftToParis(requestedDate,serviceDate,zone='Europe/Paris') {
  return (gtfsMidnightUtc(serviceDate,zone)-
    gtfsMidnightUtc(requestedDate,'Europe/Paris'))/1000;
}
export function parisInstant(date,offsetSeconds=0) {
  return new Date(gtfsMidnightUtc(date,'Europe/Paris')+offsetSeconds*1000);
}
export function parisTime(date,offsetSeconds=0) {
  return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(parisInstant(date,offsetSeconds));
}
export function parisDate(date,offsetSeconds=0) {
  return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',
    year:'numeric',month:'2-digit',day:'2-digit'}).format(parisInstant(date,offsetSeconds));
}
