/** Autosave only the working draft on THIS browser, never tokens or ticket data. */
export const DRAFT_KEY='transbora_event_draft_v013';
const TTL=7*86400000;
const ACCEPTED_FIELDS=['event-title','event-destination','event-start-date','event-start-time',
  'event-end-date','event-end-time','include-outward','include-return','arrival-margin',
  'departure-margin','ev-mode','ev-buffer','ev-count','ev-reduced-margin','ev-risky-interstation'];
export const draftFields=ACCEPTED_FIELDS;
export function saveDraft(storage,draft,now=Date.now()){
  try{
    const fields=Object.fromEntries(ACCEPTED_FIELDS.map(id=>[id,draft.fields?.[id]??'']));
    const people=(draft.participants||[]).slice(0,100).map(p=>({
      id:String(p.id||'').slice(0,40),
      first:String(p.first||'').slice(0,90),
      last:String(p.last||'').slice(0,90),
      departure:String(p.departure||'').slice(0,140),
      outwardDate:String(p.outwardDate||''),returnDate:String(p.returnDate||''),
      outwardOrigin:String(p.outwardOrigin||'').slice(0,140),
      outwardDestination:String(p.outwardDestination||'').slice(0,140),
      returnOrigin:String(p.returnOrigin||'').slice(0,140),
      returnDestination:String(p.returnDestination||'').slice(0,140),
      arrivalDate:String(p.arrivalDate||'').slice(0,10),
      arrivalTime:String(p.arrivalTime||'').slice(0,5),
      releaseDate:String(p.releaseDate||'').slice(0,10),
      releaseTime:String(p.releaseTime||'').slice(0,5),
      notes:String(p.notes||'').slice(0,300),
      organizerPersonId:String(p.organizerPersonId||'').slice(0,140),
      reductionCards:String(p.reductionCards||'').slice(0,160),
      preferences:String(p.preferences||'').slice(0,240)
    }));
    storage.setItem(DRAFT_KEY,JSON.stringify({
      version:1,savedAt:now,step:Math.max(1,Math.min(3,Number(draft.step)||1)),
      fields,participants:people
    }));
    return true;
  }catch{return false;}
}
export function restoreDraft(storage,now=Date.now()){
  try{
    const data=JSON.parse(storage.getItem(DRAFT_KEY)||'null');
    if(!data||data.version!==1||!Number.isFinite(data.savedAt)||
      data.savedAt>now+60000||now-data.savedAt>TTL||
      !Array.isArray(data.participants)||!data.fields){
      storage.removeItem(DRAFT_KEY);return null;
    }
    return {fields:Object.fromEntries(ACCEPTED_FIELDS.map(id=>
      [id,data.fields[id]??''])),participants:data.participants.slice(0,100),
      step:Math.max(1,Math.min(3,Number(data.step)||1))};
  }catch{return null;}
}
export function eraseDraft(storage){
  try{storage.removeItem(DRAFT_KEY);return true;}catch{return false;}
}
