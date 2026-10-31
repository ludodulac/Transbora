/**
 * TRANSBORA 045 — Native artist answers -> local demonstration workspace.
 *
 * A mapping contains only public-looking internal identifiers and itinerary
 * source keys. NEVER copy the native ownerKey, invitation tokens or entire
 * native status report into local rehearsal records or this mapping.
 * Read the owner capability exclusively from existing organizer history
 * when the organizer explicitly requests a refresh.
 */
export const NATIVE_LINKS_KEY='transbora_demo_native_links_045';
const str=(s,max=200)=>String(s??'').trim().slice(0,max);
const directions=['A','R'];
const MAX_LINKS=20;
const parse=(storage)=>{
  try{
    const x=JSON.parse(storage.getItem(NATIVE_LINKS_KEY)||'[]');
    return Array.isArray(x)?x.filter(v=>v?.version===1&&v.organizerEventId&&v.nativeEventId):[];
  }catch{return [];}
};
export function nativeLinkFor(storage,organizerEventId){
  return parse(storage).find(v=>v.organizerEventId===organizerEventId)||null;
}
/** Publish mapping only AFTER native link creation succeeds.
 * Native option IDs are selected from actual link-service proposals; every
 * one maps to one sourceKey of the real search plan.
 */
export function registerNativeLink(storage,{
  organizerHandoff,nativeEventId,participants,plans,choicePeople,routes
},now=Date.now()){
  if(!organizerHandoff?.eventId||!nativeEventId||
     !Array.isArray(participants)||!Array.isArray(choicePeople)||
     !Array.isArray(routes?.rows)||!plans?.get)
    throw Error('Association des réponses incomplète.');
  if(!Number.isFinite(now))throw Error('Date incorrecte.');
  const travelers=[];
  for(const traveler of organizerHandoff.travelers){
    const person=participants.find(p=>p.organizerPersonId===traveler.personId);
    if(!person)throw Error('Association de voyageur manquante.');
    const published=choicePeople.find(p=>p.id===person.id);
    if(!published)throw Error('Propositions natives introuvables.');
    const options={A:[],R:[]};
    for(const dir of directions){
      for(const option of published.options?.[dir]||[]){
        // The existing native endpoint stores its option IDs at max 180 chars.
        const optionId=str(option.id,180);
        const matching=routes.rows.filter(row=>row.personId===traveler.personId &&
          row.direction===dir && row.nativeOptionId===optionId);
        if(matching.length!==1)
          throw Error('Trajet de '+traveler.name+' impossible à associer à son lien.');
        const key=matching[0].sourceKey;
        if(!optionId||options[dir].some(o=>o.nativeOptionId===optionId))
          throw Error('Identifiant de proposition en double ou vide.');
        options[dir].push({nativeOptionId:optionId,sourceKey:str(key,6000)});
      }
    }
    travelers.push({organizerPersonId:traveler.personId,nativePersonId:person.id,options});
  }
  const mapping={version:1,createdAt:now,
    organizerEventId:organizerHandoff.eventId,nativeEventId:str(nativeEventId,100),
    title:organizerHandoff.title,destination:organizerHandoff.destination,
    startDate:organizerHandoff.startDate,travelers};
  const rest=parse(storage).filter(v=>v.organizerEventId!==mapping.organizerEventId);
  storage.setItem(NATIVE_LINKS_KEY,JSON.stringify([mapping,...rest].slice(0,MAX_LINKS)));
  return mapping;
}
export function planNativeAnswers({mapping,report,event,participations,options,choices,bookings}){
  if(mapping?.version!==1||!report?.event||!event ||
      mapping.organizerEventId!==event.id||
      mapping.title!==event.title||mapping.destination!==event.destination||
      mapping.startDate!==event.startDate||
      report.event.title!==mapping.title||report.event.destination!==mapping.destination||
      report.event.startDate!==mapping.startDate||
      !Array.isArray(mapping.travelers)||!Array.isArray(report.people))
    throw Error('Le dossier reçu ne correspond pas exactement à cet événement. Aucune donnée modifiée.');
  const summary={updates:[],unchanged:0,pending:0,conflicts:[],none:0,paidStatusNotImported:0};
  const seen=new Set();
  for(const t of mapping.travelers){
    if(!t.organizerPersonId||!t.nativePersonId||seen.has(t.nativePersonId))
      throw Error('Association de participants invalide.');
    seen.add(t.nativePersonId);
    const nativePeople=report.people.filter(p=>p.id===t.nativePersonId);
    if(nativePeople.length!==1) {
      summary.conflicts.push('Participant natif introuvable : '+str(t.nativePersonId,40));
      continue;
    }
    const native=nativePeople[0];
    const matches=participations.filter(p=>p.eventId===event.id&&p.personId===t.organizerPersonId);
    if(matches.length!==1){
      summary.conflicts.push('Participant du tableau manquant : '+str(t.organizerPersonId,40));
      continue;
    }
    const pid=matches[0].id;
    for(const dir of directions){
      if(native.booking?.[dir])summary.paidStatusNotImported++;
      const answer=native.answer?.[dir];
      if((answer===null||answer===undefined||answer==='')&&
          !(native.options?.[dir]||[]).length)continue;
      if(answer===null||answer===undefined||answer===''){summary.pending++;continue;}
      const translate=(id)=>{
        if(!id)return null;
        if(id==='NONE')return 'NONE';
        const linkRows=t.options?.[dir]||[];
        const links=linkRows.filter(row=>row.nativeOptionId===id);
        if(links.length!==1)return null;
        if(!native.options?.[dir]?.some(row=>row.id===id))return null;
        const match=options.filter(o=>o.participationId===pid&&o.direction===dir&&
           o.sourceKey===links[0].sourceKey);
        return match.length===1?match[0].id:null;
      };
      const first=translate(answer);
      if(!first){
        summary.conflicts.push(str(native.first+' '+native.last,100)+
          ' ('+dir+') : horaire choisi introuvable ou ambigu.');
        continue;
      }
      const backupId=native.answer?.[dir+'2'];
      const backup=backupId?translate(backupId):null;
      if(backupId && (!backup||backup==='NONE'||backup===first)){
        summary.conflicts.push(str(native.first+' '+native.last,100)+
          ' ('+dir+') : second choix introuvable ou invalide.');
        continue;
      }
      const previous=choices.find(c=>c.participationId===pid&&c.direction===dir);
      if(previous?.firstOptionId===first &&
         (previous?.backupOptionId||null)===(backup||null)){summary.unchanged++;continue;}
      if(previous && previous.origin!=='sample' && (previous.origin!=='native'||
         previous.nativeEventId!==mapping.nativeEventId)){
        summary.conflicts.push(str(native.first+' '+native.last,100)+
          ' ('+dir+') : choix local déjà différent, aucune écriture automatique.');
        continue;
      }
      if(bookings.some(b=>b.participationId===pid&&b.paidAt &&
         options.some(o=>o.id===b.optionId&&o.direction===dir))){
        summary.conflicts.push(str(native.first+' '+native.last,100)+
          ' ('+dir+') : achat local existant, choix non remplacé.');
        continue;
      }
      if(answer==='NONE')summary.none++;
      summary.updates.push({participationId:pid,direction:dir,
        firstOptionId:first,backupOptionId:backup||null,
        origin:'native',nativeEventId:mapping.nativeEventId});
    }
  }
  return summary;
}
