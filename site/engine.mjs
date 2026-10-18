// Static scheduled SNCF trains, direct rides only. No live availability.
const DAY = 86400;
function unixDay(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (!year || !month || !day || isNaN(value.getTime()) || value.toISOString().slice(0,10) !== dateString) return NaN;
  return Math.floor(value.getTime() / 86400000);
}
function runs(mask, offset) {
  if (!mask || offset < 0) return false;
  const bytes = atob(mask), index = Math.floor(offset / 8);
  return index < bytes.length && Boolean(bytes.charCodeAt(index) & (1 << (offset % 8)));
}
export function timeText(seconds) {
  const minutes = Math.floor((((seconds % DAY) + DAY) % DAY) / 60);
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
export function durationText(seconds) {
  const mins = Math.floor(seconds / 60);
  return Math.floor(mins / 60) + ' h ' + String(mins % 60).padStart(2, '0');
}
export function dateText(dateString, seconds = 0) {
  const current = new Date(dateString + 'T12:00:00Z');
  current.setUTCDate(current.getUTCDate() + Math.floor(seconds / DAY));
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC'}).format(current);
}
export function findDirect(data, origin, destination, travelDate, earliest='00:00', latest='23:59') {
  const requested = unixDay(travelDate), first = unixDay(data.meta.first), last = unixDay(data.meta.last);
  if (!Number.isFinite(requested) || requested < first || requested > last || origin === destination) return [];
  const [startH,startM] = earliest.split(':').map(Number), [endH,endM] = latest.split(':').map(Number);
  const start = (startH*60+startM)*60, end = (endH*60+endM)*60+59;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const matches = [];
  // Previous service day captures post-midnight GTFS times such as 25:00.
  for (const serviceDay of [requested-1, requested]) {
    if (serviceDay < first || serviceDay > last) continue;
    for (let t=0; t<data.trips.length; t++) {
      const trip = data.trips[t];
      if (!runs(data.services[trip[0]],serviceDay-first)) continue;
      const stops = trip[4];
      for (let i=0; i<stops.length-1; i++) {
        const depart = stops[i];
        if (depart[0] !== origin || depart[3] !== 1) continue;
        const departure = depart[2] + (serviceDay-requested)*DAY;
        if (departure < start || departure > end) continue;
        for (let j=i+1; j<stops.length; j++) {
          const arrive = stops[j];
          if (arrive[0] !== destination || arrive[4] !== 1 || arrive[1] < depart[2]) continue;
          matches.push({id:t+'-'+serviceDay+'-'+i+'-'+j, departure,
            arrival:arrive[1]+(serviceDay-requested)*DAY,
            line:trip[1]||'Train', headsign:trip[2]||'', number:trip[3]||''});
          break;
        }
      }
    }
  }
  matches.sort((a,b)=>a.departure-b.departure || a.arrival-b.arrival);
  return matches;
}
