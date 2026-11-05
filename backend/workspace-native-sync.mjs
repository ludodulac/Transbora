/**
 * TRANSBORA 054 — server-only bridge for artist preferences.
 *
 * Native owner credentials live exclusively in the private organization Blob
 * store. Never expose them in list/export_backup, logs, iframe acknowledgements
 * or public traveler responses.
 */
import {createHash} from 'node:crypto';
import {planNativeAnswers} from '../site/organizer-replies-bridge.mjs';

const sha=x=>createHash('sha256').update(String(x)).digest('hex');
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{10,100}$/.test(x);
const dirs=['A','R'];
const linkedKey=(org,eventId,needId)=>'native-link/'+org+'/'+eventId+(needId?'/'+needId:'');
const reverseKey=nativeId=>'native-reverse/'+nativeId;
const error=(message)=>{throw Error(message);};
async function rows(store,kind,org){
 const results=await store.list({prefix:kind+'/'+org+'/'});
 if((results.blobs||[]).length>1000)error('Trop de dossiers synchronisés.');
 return (await Promise.all((results.blobs||[]).map(x=>store.get(x.key,{type:'json'}))))
  .filter(x=>x?.organizationId===org);
}
async function liveReport(nativeStatus,eventId,ownerKey){
 if(typeof nativeStatus!=='function')error('Service de réponses indisponible.');
 return nativeStatus(eventId,ownerKey);
}
export async function registerNativeWorkspaceLink({store,org,eventId,mapping,ownerKey,nativeStatus,clock=Date.now}){
 if(!idOk(org)||!idOk(eventId)||!mapping||mapping.version!==1||
    mapping.organizerEventId!==eventId||!idOk(mapping.nativeEventId)||
    !/^[A-Za-z0-9_-]{20,100}$/.test(ownerKey||'')||
    !Array.isArray(mapping.travelers)||!mapping.travelers.length||
    mapping.travelers.length>100)error('Liaison de réponses invalide.');
 const needId=mapping.needId||null;
 if(needId&&!idOk(needId))error('Identifiant de déplacement invalide.');
 const event=await store.get('event/'+org+'/'+eventId,{type:'json'});
 if(!event||event.organizationId!==org)error('Événement introuvable.');
 const report=await liveReport(nativeStatus,mapping.nativeEventId,ownerKey);
 if(!report?.event||report.event.title!==event.title||
   report.event.destination!==event.destination||
   report.event.startDate!==event.startDate||
   mapping.title!==event.title||mapping.destination!==event.destination||
   mapping.startDate!==event.startDate||
   !Array.isArray(report.people)||report.people.length!==mapping.travelers.length)
  error('Les liens ne correspondent pas à cet événement.');
 const participating=(await rows(store,'participation',org))
  .filter(p=>p.eventId===eventId&&p.active!==false);
 const need=needId?await store.get('need/'+org+'/'+needId,{type:'json'}):null;
 if(needId&&(!need||need.organizationId!==org||!participating.some(p=>
   p.id===need.participationId)||mapping.travelers.length!==1))
  error('Le déplacement ne correspond pas à cet événement.');
 const options=(await rows(store,'option',org)).filter(o=>
  participating.some(p=>p.id===o.participationId));
 const seenPeople=new Set(),seenNative=new Set();
 const safeTravelers=[];
 for(const t of mapping.travelers){
  if(!idOk(t.organizerPersonId)||typeof t.nativePersonId!=='string'||
     !/^[A-Za-z0-9_-]{1,80}$/.test(t.nativePersonId)||
     seenPeople.has(t.organizerPersonId)||seenNative.has(t.nativePersonId))
   error('Association des voyageurs invalide.');
  seenPeople.add(t.organizerPersonId);seenNative.add(t.nativePersonId);
  const participant=participating.filter(p=>p.personId===t.organizerPersonId);
  const native=report.people.filter(p=>p.id===t.nativePersonId);
  if(participant.length!==1||native.length!==1||
     (needId&&participant[0].id!==need.participationId))
    error('Un voyageur ne correspond pas au dossier.');
  const mapped={organizerPersonId:t.organizerPersonId,nativePersonId:t.nativePersonId,options:{A:[],R:[]}};
  for(const dir of dirs){
   const actual=native[0].options?.[dir]||[];
   const entries=t.options?.[dir]||[];
   if(!Array.isArray(actual)||!Array.isArray(entries)||entries.length!==actual.length||
      entries.length>5)error('Propositions publiées incohérentes.');
   const seenOptions=new Set();
   for(const proposed of entries){
    const nativeOptionId=proposed?.nativeOptionId;
    const sourceKey=proposed?.sourceKey;
    if(typeof nativeOptionId!=='string'||!nativeOptionId||nativeOptionId.length>180||
       typeof sourceKey!=='string'||!sourceKey||sourceKey.length>6000||
       seenOptions.has(nativeOptionId)||
       !actual.some(o=>o.id===nativeOptionId))error('Proposition de train non reconnue.');
    seenOptions.add(nativeOptionId);
    const sourceKeyHash=sha(eventId+'|'+sourceKey);
    const matches=options.filter(o=>o.participationId===participant[0].id&&
      o.direction===dir&&(o.needId||null)===needId&&o.sourceKeyHash===sourceKeyHash);
    if(matches.length!==1)error('Les horaires ne sont pas encore enregistrés dans TRANSBORA.');
    mapped.options[dir].push({nativeOptionId,sourceKeyHash});
   }
  }
  safeTravelers.push(mapped);
 }
 if(seenNative.size!==report.people.length)error('Un voyageur manque dans la liaison.');
 const earlier=await store.get(linkedKey(org,eventId,needId),{type:'json'});
 if(earlier&&earlier.nativeEventId!==mapping.nativeEventId)
  error('Un autre dossier de réponses est déjà lié à cet événement.');
 const reverse=await store.get(reverseKey(mapping.nativeEventId),{type:'json'});
 if(reverse&&(reverse.org!==org||reverse.eventId!==eventId||
   (reverse.needId||null)!==needId))
  error('Ces réponses appartiennent déjà à un autre dossier.');
 const link={version:1,organizationId:org,organizerEventId:eventId,
  ...(needId?{needId}:{}),nativeEventId:mapping.nativeEventId,ownerKey,
  title:event.title,destination:event.destination,startDate:event.startDate,
  travelers:safeTravelers,createdAt:earlier?.createdAt||clock(),updatedAt:clock()};
 await store.setJSON(linkedKey(org,eventId,needId),link);
 await store.setJSON(reverseKey(mapping.nativeEventId),{org,eventId,...(needId?{needId}:{})});
 return {linked:true,organizerEventId:eventId,nativeEventId:mapping.nativeEventId};
}
export async function linkedEventsForOrganization(store,org){
 const {blobs=[]}=await store.list({prefix:'native-link/'+org+'/'});
 if(blobs.length>1000)error('Trop de dossiers de choix liés.');
 return (await Promise.all(blobs.map(async x=>{
  const link=await store.get(x.key,{type:'json'});
  return link?.organizationId===org?{
   eventId:link.organizerEventId,nativeEventId:link.nativeEventId,
   ...(link.needId?{needId:link.needId}:{})
  }:null;
 }))).filter(Boolean);
}
export async function syncNativeWorkspaceEvent({store,org,eventId,needId,nativeEventId,nativeStatus,clock=Date.now}){
 let link;
 if(org&&eventId){
  link=await store.get(linkedKey(org,eventId,needId),{type:'json'});
 }else if(nativeEventId){
  const reverse=await store.get(reverseKey(nativeEventId),{type:'json'});
  if(!reverse)return {linked:false,synced:0,pending:0,unchanged:0,conflicts:[]};
  org=reverse.org;eventId=reverse.eventId;needId=reverse.needId||null;
  link=await store.get(linkedKey(org,eventId,needId),{type:'json'});
 }
 if(!link||link.organizationId!==org||link.organizerEventId!==eventId||
   (nativeEventId&&link.nativeEventId!==nativeEventId))
  return {linked:false,synced:0,pending:0,unchanged:0,conflicts:[]};
 const [event,report,participations,options,choices,bookings]=await Promise.all([
  store.get('event/'+org+'/'+eventId,{type:'json'}),
  liveReport(nativeStatus,link.nativeEventId,link.ownerKey),
  rows(store,'participation',org),rows(store,'option',org),
  rows(store,'choice',org),rows(store,'booking',org)
 ]);
 if(!event||event.organizationId!==org)error('Événement de synchronisation absent.');
 const plan=planNativeAnswers({
  mapping:link,report,event,
  participations:participations.filter(p=>p.eventId===eventId),
  options,choices,bookings
 });
 let synced=0;
 for(const update of plan.updates){
  const choiceId='c-'+sha(update.participationId+':'+update.direction+
    (link.needId?':'+link.needId:'')).slice(0,42);
  const key='choice/'+org+'/'+choiceId;
  const previous=await store.get(key,{type:'json'});
  // Re-check to avoid replacing a later manual edit or a paid booking while
  // another collaborator is submitting the same organizer event.
  if(previous&&previous.origin!=='native'&&previous.origin!=='sample'){
   plan.conflicts.push('Choix de l’organisateur modifié depuis la lecture.');
   continue;
  }
  if(previous?.origin==='native'&&previous.nativeEventId!==link.nativeEventId){
   plan.conflicts.push('Choix associé à un autre dossier.');
   continue;
  }
  const recentBookings=(await rows(store,'booking',org));
  const paid=recentBookings.some(b=>b.participationId===update.participationId&&b.paidAt&&
   options.some(o=>o.id===b.optionId&&o.direction===update.direction&&
     (o.needId||null)===(link.needId||null)));
  if(paid){
   plan.conflicts.push('Billet déjà acheté, aucun remplacement du choix.');
   continue;
  }
  if(previous?.firstOptionId===update.firstOptionId&&
    (previous.backupOptionId||null)===(update.backupOptionId||null)){
   plan.unchanged++;continue;
  }
  const now=clock();
  await store.setJSON(key,{id:choiceId,organizationId:org,
   createdAt:previous?.createdAt||now,updatedAt:now,
   participationId:update.participationId,direction:update.direction,
   ...(link.needId?{needId:link.needId}:{}),
   firstOptionId:update.firstOptionId,backupOptionId:update.backupOptionId,
   origin:'native',nativeEventId:link.nativeEventId,
   confirmedBy:'Choix de l’artiste (lien TRANSBORA)'});
  synced++;
 }
 return {linked:true,eventId,nativeEventId:link.nativeEventId,
  synced,pending:plan.pending,unchanged:plan.unchanged,none:plan.none,
  conflicts:plan.conflicts,paidStatusNotImported:plan.paidStatusNotImported};
}
