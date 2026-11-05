/** TRANSBORA 048 — Jeanne's monthly travel register.
 * Pure local projection: no prices inferred, never double-count alternatives
 * as bookings. Returns one row per real proposed itinerary + a pending row
 * for a participant with no options at all.
 */
const isMonth=v=>/^\d{4}-(?:0[1-9]|1[0-2])$/.test(v||'');
const str=v=>String(v??'').trim();
const dict=rows=>new Map((rows||[]).filter(x=>x?.id).map(x=>[x.id,x]));
const time=v=>/^(?:[01]\d|2[0-3]):[0-5]/.test(v||'')?v.slice(0,5):str(v);
export function monthLedger(data,month,personId=''){
 if(!isMonth(month))throw Error('Mois invalide.');
 const people=dict(data?.people),events=dict(data?.events);
 const parts=dict(data?.participations),options=data?.options||[],
   needs=data?.needs||[],choices=data?.choices||[],bookings=data?.bookings||[];
 if(!Array.isArray(options)||!Array.isArray(choices)||!Array.isArray(bookings))
  throw Error('Registre incomplet.');
 const choiceMap=new Map(choices.map(x=>[x.participationId+':'+x.direction+':'+(x.needId||''),x]));
 const bookingMap=new Map(bookings.map(x=>[x.optionId,x]));
 const hasOptions=new Set(options.map(x=>x.participationId));
 const hasScopedOptions=new Set(options.filter(x=>x.needId).map(x=>x.participationId+':'+x.needId));
 const rows=[];
 for(const option of options){
  const part=parts.get(option.participationId);
  if(!part||part.active===false||!['A','R'].includes(option.direction)||!String(option.travelDate||'').startsWith(month))continue;
  if(personId&&part.personId!==personId)continue;
  const person=people.get(part.personId),event=events.get(part.eventId);
  if(!person||!event)continue;
  const legs=[...(option.legs||[])].sort((a,b)=>(a.order||0)-(b.order||0));
  if(!legs.length)continue;
  const choice=choiceMap.get(part.id+':'+option.direction+':'+(option.needId||''));
  const rank=choice?.firstOptionId===option.id?1:
    choice?.backupOptionId===option.id?2:null;
  const booking=bookingMap.get(option.id);
  const paid=Boolean(booking?.paidAt),filed=Boolean(booking?.filedAt);
  const inCart=Boolean(booking?.inCartAt);
  rows.push({
   optionId:option.id,needId:option.needId||null,
   participationId:part.id,eventId:event.id,personId:person.id,
   date:option.travelDate,event:event.title,person:person.name,
   direction:option.direction==='A'?'Aller':'Retour',
   from:str(legs[0]?.from),to:str(legs.at(-1)?.to),
   departure:time(legs[0]?.departure),arrival:time(legs.at(-1)?.arrival),
   legs:legs.map(x=>({from:str(x.from),to:str(x.to),departure:time(x.departure),arrival:time(x.arrival),mode:str(x.mode)})),
   choiceRank:rank,choiceOrigin:choice?.origin||null,
   cart:inCart,paid,filed,stage:filed?'Classé':paid?'Acheté':inCart?'Panier':rank?'Choisi':'Proposé',
   paidCents:paid?(booking.paidCents??null):null,
   estimateCents:option.estimatedCents??null,
   source:option.source||null,receiptReference:booking?.receiptReference||null,
   pending:false
  });
 }
 for(const need of needs){
  const part=parts.get(need.participationId);
  if(!part||part.active===false||hasScopedOptions.has(part.id+':'+need.id)||
     !String(need.targetDate||'').startsWith(month))continue;
  if(personId&&part.personId!==personId)continue;
  const person=people.get(part.personId),event=events.get(part.eventId);
  if(!person||!event)continue;
  rows.push({optionId:null,needId:need.id,participationId:part.id,
   eventId:event.id,personId:person.id,date:need.targetDate,
   event:event.title,person:person.name,
   direction:need.direction==='A'?'Aller':'Retour',
   from:str(need.origin),to:str(need.destination),
   departure:need.direction==='R'?time(need.targetTime):'',
   arrival:need.direction==='A'?time(need.targetTime):'',legs:[],
   choiceRank:null,choiceOrigin:null,cart:false,paid:false,filed:false,
   stage:'À rechercher',paidCents:null,estimateCents:null,
   source:null,receiptReference:null,pending:true});
 }
 for(const part of parts.values()){
  if(part.active===false||(personId&&part.personId!==personId))continue;
  const person=people.get(part.personId),event=events.get(part.eventId);
  if(!person||!event||needs.some(n=>n.participationId===part.id)||
     hasOptions.has(part.id)||!String(event.startDate||'').startsWith(month))continue;
  rows.push({optionId:null,participationId:part.id,eventId:event.id,personId:person.id,
   date:event.startDate,event:event.title,person:person.name,direction:'—',
   from:person.departure||'—',to:event.destination||'—',
   departure:'',arrival:'',legs:[],choiceRank:null,choiceOrigin:null,
   cart:false,paid:false,filed:false,stage:'À rechercher',
   paidCents:null,estimateCents:null,source:null,receiptReference:null,pending:true});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.person.localeCompare(b.person,'fr')||
  a.event.localeCompare(b.event,'fr')||a.direction.localeCompare(b.direction,'fr')||
  a.departure.localeCompare(b.departure)||String(a.optionId).localeCompare(String(b.optionId)));
 const paidRows=rows.filter(x=>x.paid);
 return {month,personId,rows,summary:{
  travels:rows.filter(x=>!x.pending).length,
  pending:rows.filter(x=>x.pending).length,
  selected:rows.filter(x=>x.choiceRank===1).length,
  inCart:rows.filter(x=>x.cart&&!x.paid).length,
  paid:paidRows.length,paidKnownCents:paidRows.reduce((a,x)=>a+(x.paidCents??0),0),
  paidUnknown:paidRows.filter(x=>x.paidCents===null).length
 }};
}
export function personMonthLedger(data,month,personId){
 if(!personId)throw Error('Sélectionnez une personne.');
 const result=monthLedger(data,month,personId);
 return {...result,personName:(data.people||[]).find(x=>x.id===personId)?.name||'Personne'};
}
