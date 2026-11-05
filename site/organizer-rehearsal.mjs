import {personMonthView,eventBudgetSummary} from './organizer-domain.mjs';
import {planNativeAnswers} from './organizer-replies-bridge.mjs';
import {validateRehearsalBackup} from './organizer-recovery.mjs';
export const KEY='transbora_local_example_043';
const ORG='local-rehearsal',KINDS=['person','event','participation','need','option','choice','booking','note'];
const str=(x,n=200)=>String(x??'').trim().slice(0,n);
const uuid=()=>String(globalThis.crypto?.randomUUID?.()||('d'+Math.random().toString(36).slice(2))).replace(/-/g,'');
const die=msg=>{throw Error(msg)};
const cents=n=>n==null||(Number.isSafeInteger(n)&&n>=0);
const date=x=>/^\d{4}-\d\d-\d\d$/.test(x||'');
const init=()=>{
 const leg=(from,to,departure,arrival,order=1)=>({from,to,departure,arrival,order,mode:'rail'});
 const data={version:1,
  person:[{id:'sophie-demo',name:'Sophie (exemple)',departure:'Paris'},
          {id:'michel-demo',name:'Michel (exemple)',departure:'Brest'}],
  event:[{id:'festival-demo',title:'Festival exemple — données fictives',startDate:'2026-10-31',destination:'Mulhouse',theater:'Salle fictive',budgetCents:75000}],
  participation:[{id:'ps-demo',personId:'sophie-demo',eventId:'festival-demo'},
                 {id:'pm-demo',personId:'michel-demo',eventId:'festival-demo'}],
  option:[{id:'opt1-demo',participationId:'ps-demo',direction:'A',travelDate:'2026-10-31',estimatedCents:6500,legs:[leg('Paris Gare de Lyon','Mulhouse','09:22','12:21')]},
          {id:'opt2-demo',participationId:'ps-demo',direction:'A',travelDate:'2026-10-31',estimatedCents:8000,legs:[leg('Paris Gare de Lyon','Mulhouse','07:22','10:03')]},
          {id:'opt3-demo',participationId:'pm-demo',direction:'A',travelDate:'2026-10-30',estimatedCents:12000,legs:[leg('Brest','Paris Montparnasse','08:00','12:00'),leg('Paris Est','Mulhouse','13:45','16:50',2)]}],
  choice:[{id:'choice-demo',participationId:'ps-demo',direction:'A',firstOptionId:'opt1-demo',backupOptionId:'opt2-demo',origin:'sample'}],
  booking:[],need:[],
  note:[{id:'note-demo',targetType:'event',targetId:'festival-demo',content:'Note fictive : vérifier les horaires.',updatedBy:'Démonstration',updatedAt:Date.now()}]};
 for(const k of KINDS)for(const row of data[k])row.organizationId=ORG;
 return data;
};
const empty=()=>({version:1,person:[],event:[],participation:[],
 need:[],option:[],choice:[],booking:[],note:[]});
/* Only remove the known built-in fictional fixtures. Never delete unrelated
   user-created persons, events or records from an existing local browser. */
export function stripFictionalExamples(data){
 const copy={...data};
 const isFixturePerson=p=>(p.id==='sophie-demo'&&p.name==='Sophie (exemple)')||
  (p.id==='michel-demo'&&p.name==='Michel (exemple)');
 const isFixtureEvent=e=>e.id==='festival-demo'&&
  e.title==='Festival exemple — données fictives';
 copy.person=data.person.filter(p=>!isFixturePerson(p));
 copy.event=data.event.filter(e=>!isFixtureEvent(e));
 const removedPeople=new Set(data.person.filter(isFixturePerson).map(x=>x.id));
 const removedEvents=new Set(data.event.filter(isFixtureEvent).map(x=>x.id));
 copy.participation=data.participation.filter(p=>!removedPeople.has(p.personId)&&
  !removedEvents.has(p.eventId));
 const removedParts=new Set(data.participation.filter(p=>
  !copy.participation.some(x=>x.id===p.id)).map(p=>p.id));
 copy.need=(data.need||[]).filter(n=>!removedParts.has(n.participationId));
 copy.option=data.option.filter(o=>!removedParts.has(o.participationId));
 const removedOptions=new Set(data.option.filter(o=>
  !copy.option.some(x=>x.id===o.id)).map(o=>o.id));
 copy.choice=data.choice.filter(x=>!removedParts.has(x.participationId));
 copy.booking=data.booking.filter(x=>!removedOptions.has(x.optionId));
 copy.note=data.note.filter(x=>!(x.targetType==='person'&&removedPeople.has(x.targetId))&&
  !(x.targetType==='event'&&removedEvents.has(x.targetId)));
 return copy;
}
export function createRehearsalApi(store,{cleanExamples=false}={}){
 const write=data=>{try{store.setItem(KEY,JSON.stringify(data))}catch{die('Impossible de sauvegarder sur cet appareil.')}};
 const read=()=>{
  const raw=store.getItem(KEY);
  if(!raw){const data=cleanExamples?empty():init();write(data);return data;}
  let data;try{data=JSON.parse(raw)}catch{die('Démonstration illisible.')}
  if(data.version!==1)die('Version de démonstration incompatible.');
  // Additive migration: keep existing people (including user-created Gérard).
  if(!Array.isArray(data.need))data.need=[];
  if(KINDS.some(k=>!Array.isArray(data[k])))die('Version de démonstration incompatible.');
  if(cleanExamples){
   const clean=stripFictionalExamples(data);
   if(KINDS.some(k=>clean[k].length!==data[k].length)){write(clean);return clean;}
  }
  return data;
 };
 return async function api(action,args={}){
  if(action==='me')return {organizationName:'Atelier de démonstration',role:'manager',email:'',organizationId:ORG};
  if(action==='reset_demo'){write(cleanExamples?empty():init());return {reset:true};}
  const data=read(),{type,record}=args;
  const get=(kind,key)=>data[kind].find(x=>x.id===key)||die('Élément introuvable.');
  if(action==='set_participation_active'){
    const part=get('participation',args.participationId);
    if(typeof args.active!=='boolean')die('État invalide.');
    part.active=args.active;part.updatedAt=Date.now();
    write(data);return {saved:true,item:structuredClone(part)};
  }
  if(action==='list')return {items:structuredClone(data[type]||[])};
  if(action==='export_backup')return {type:'local-rehearsal',...data};
  if(action==='restore_demo_backup'){
    const restored=validateRehearsalBackup(args.backup);
    restored.need=Array.isArray(restored.need)?restored.need:[];
    write(restored);
    return {restored:true,persons:restored.person.length,events:restored.event.length};
  }
  if(action==='import_search_results'){
    const {eventId,rows}=args;
    if(!data.event.some(e=>e.id===eventId))die('Événement de destination introuvable.');
    if(!Array.isArray(rows)||rows.length>1000)die('Liste de trajets trop longue.');
    const now=Date.now(),additions=[];
    let alreadyPresent=0;
    const seen=new Set(data.option.map(x=>x.sourceKey).filter(Boolean));
    for(const item of rows){
      if(!['A','R'].includes(item?.direction)||!date(item.travelDate)||
        typeof item.sourceKey!=='string'||!item.sourceKey||
        item.sourceKey.length>6000||!Array.isArray(item.legs)||
        !item.legs.length||item.legs.length>6)die('Proposition de transport invalide.');
      const participant=data.participation.find(p=>p.personId===item.personId&&p.eventId===eventId);
      if(!participant)die('Participant non inscrit à cet événement.');
      const legs=item.legs.map((l,index)=>({
        order:index+1,from:str(l.from,150),to:str(l.to,150),
        departure:str(l.departure,5),arrival:str(l.arrival,5),
        departureDate:str(l.departureDate,10),arrivalDate:str(l.arrivalDate,10),
        mode:l.mode==='bus'?'bus':'rail',operator:str(l.operator,100)
      }));
      if(legs.some(l=>!l.from||!l.to||!date(l.departureDate)||!date(l.arrivalDate)||
         !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(l.departure)||
         !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(l.arrival))||
         legs[0].departureDate!==item.travelDate)die('Horaire de transport invalide.');
      if(seen.has(item.sourceKey)){alreadyPresent++;continue;}
      seen.add(item.sourceKey);
      additions.push({id:uuid(),organizationId:ORG,createdAt:now,updatedAt:now,
        participationId:participant.id,direction:item.direction,
        travelDate:item.travelDate,estimatedCents:null,
        source:'Horaires théoriques, prix et disponibilité inconnus',
        sourceKey:item.sourceKey,legs});
    }
    data.option.push(...additions);write(data);
    return {imported:additions.length,alreadyPresent};
  }
  if(action==='sync_native_answers'){
    const mapping=args.mapping,report=args.report;
    const event=data.event.find(e=>e.id===mapping?.organizerEventId);
    if(!event)die('Événement de démonstration introuvable.');
    const summary=planNativeAnswers({
      mapping,report,event,participations:data.participation,
      options:data.option,choices:data.choice,bookings:data.booking
    });
    const now=Date.now();
    for(const update of summary.updates){
      const old=data.choice.find(row=>row.participationId===update.participationId&&
        row.direction===update.direction);
      data.choice=data.choice.filter(row=>row!==old);
      data.choice.push({id:old?.id||uuid(),createdAt:old?.createdAt||now,
        updatedAt:now,organizationId:ORG,...update});
    }
    if(summary.updates.length)write(data);
    return {synced:summary.updates.length,unchanged:summary.unchanged,
      pending:summary.pending,none:summary.none,
      paidStatusNotImported:summary.paidStatusNotImported,
      conflicts:summary.conflicts};
  }
  const model={organizationId:ORG,people:data.person,events:data.event,
    participations:data.participation,options:data.option,choices:data.choice,bookings:data.booking};
  if(action==='person_month')return personMonthView({...model,personId:args.personId,month:args.month});
  if(action==='event_budget')return eventBudgetSummary({...model,eventId:args.eventId});
  if(action!=='save'||!KINDS.includes(type)||!record)die('Opération impossible.');
  const prev=record.id?get(type,record.id):null;
  const base={id:prev?.id||uuid(),organizationId:ORG,createdAt:prev?.createdAt||Date.now(),updatedAt:Date.now()};
  let row={...base};
  if(type==='person'){
   if(!str(record.name))die('Nom obligatoire.');
   for(const field of ['name','departure','email','phone','reductionCards','preferences'])row[field]=str(record[field],field==='preferences'?600:200);
  }else if(type==='event'){
   if(!str(record.title)||!date(record.startDate)||!cents(record.budgetCents))die('Événement invalide.');
   for(const field of ['title','startDate','destination','theater'])row[field]=str(record[field],160);
   row.startTime=str(record.startTime??prev?.startTime,5);
   row.endDate=str(record.endDate??prev?.endDate,10);
   row.endTime=str(record.endTime??prev?.endTime,5);
   row.arrivalLeadMinutes=Number(record.arrivalLeadMinutes??prev?.arrivalLeadMinutes??60);
   const timeOk=v=>!v||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
   if(!timeOk(row.startTime)||!timeOk(row.endTime)||
     (row.endDate&&!date(row.endDate))||
     !Number.isInteger(row.arrivalLeadMinutes)||row.arrivalLeadMinutes<0||row.arrivalLeadMinutes>360)
     die('Horaires invalides.');
   row.budgetCents=record.budgetCents??null;
  }else if(type==='participation'){
   get('person',record.personId);get('event',record.eventId);
   if(data.participation.some(x=>x.eventId===record.eventId&&x.personId===record.personId))die('Cette personne est déjà inscrite.');
   row={...row,eventId:record.eventId,personId:record.personId};
  }else if(type==='need'){
   const participation=get('participation',record.participationId);
   if(participation.active===false)die('Personne retirée de cet événement.');
   const time=str(record.targetTime,5);
   const origin=str(record.origin,160),destination=str(record.destination,160);
   if(!['A','R'].includes(record.direction)||!date(record.targetDate)||
     !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)||!origin||!destination)
      die('Déplacement incomplet.');
   if(prev&&prev.participationId!==record.participationId)die('Déplacement associé à une autre personne.');
   row={...row,participationId:participation.id,direction:record.direction,
     origin,destination,targetDate:record.targetDate,targetTime:time,
     customized:record.customized===true,note:str(record.note,400)};
  }else if(type==='option'){
   get('participation',record.participationId);
   if(!['A','R'].includes(record.direction)||!date(record.travelDate)||!cents(record.estimatedCents)||!Array.isArray(record.legs)||!record.legs.length)die('Option invalide.');
   const legs=record.legs.map((l,i)=>({order:i+1,from:str(l.from),to:str(l.to),departure:str(l.departure),arrival:str(l.arrival),mode:str(l.mode)||'rail'}));
   if(legs.some(x=>!x.from||!x.to||!x.departure||!x.arrival))die('Tronçon incomplet.');
   row={...row,participationId:record.participationId,direction:record.direction,travelDate:record.travelDate,estimatedCents:record.estimatedCents??null,legs};
  }else if(type==='choice'){
   get('participation',record.participationId);
   if(!['A','R'].includes(record.direction))die('Sens invalide.');
   for(const k of [record.firstOptionId,record.backupOptionId].filter(Boolean)){
    const o=get('option',k);
    if(o.participationId!==record.participationId||o.direction!==record.direction)die('Choix non autorisé.');
   }
   if(record.firstOptionId&&record.firstOptionId===record.backupOptionId)die('Choix identiques.');
   const old=data.choice.find(x=>x.participationId===record.participationId&&x.direction===record.direction);
   row={...row,id:old?.id||row.id,participationId:record.participationId,direction:record.direction,firstOptionId:record.firstOptionId||null,backupOptionId:record.backupOptionId||null};
  }else if(type==='booking'){
   const opt=get('option',record.optionId);
   if(!['PROPOSED','IN_CART','PAID','FILED'].includes(record.stage)||!cents(record.paidCents))die('Statut invalide.');
   if(record.stage==='FILED'&&!str(record.receiptReference))die('Précisez le dossier du billet.');
   const old=data.booking.find(x=>x.optionId===opt.id);
   if(old?.paidAt&&['PROPOSED','IN_CART'].includes(record.stage))die('Ce billet est déjà payé.');
   const paid=['PAID','FILED'].includes(record.stage);
   row={...row,id:old?.id||row.id,participationId:opt.participationId,optionId:opt.id,
    inCartAt:record.stage!=='PROPOSED'?old?.inCartAt||Date.now():null,
    paidAt:paid?old?.paidAt||Date.now():null,filedAt:record.stage==='FILED'?old?.filedAt||Date.now():null,
    paidCents:paid?record.paidCents??null:null,receiptReference:str(record.receiptReference)};
  }else{
   if(!['person','event'].includes(record.targetType))die('Cible de note invalide.');
   get(record.targetType,record.targetId);
   if(!str(record.content))die('Note vide.');
   row={...row,targetType:record.targetType,targetId:record.targetId,content:str(record.content,2000),updatedBy:'Démonstration'};
  }
  data[type]=data[type].filter(x=>x.id!==row.id&&!(type==='booking'&&x.optionId===row.optionId)&&
    !(type==='choice'&&x.participationId===row.participationId&&x.direction===row.direction));
  data[type].push(row);write(data);return {saved:true,item:structuredClone(row)};
 };
}
