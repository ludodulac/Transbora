/**
 * TRANSBORA — M1 / domaine du tableau de Jeanne.
 *
 * Pure projection helpers only: no API, database, browser storage, authentication,
 * external requests or real traveler information. Future server routes MUST
 * authorize the requesting organizer before using these helpers.
 *
 * Source-of-truth: one option consists of one or more ordered journey legs.
 * Artist choices, organizer's external basket, payment and filing are separate.
 */

const assertMonth=month=>{
  if(typeof month!=='string'||!/^(?:\d{4})-(?:0[1-9]|1[0-2])$/.test(month))
    throw new TypeError('Mois invalide : utiliser YYYY-MM.');
};
const sameOrg=(item,organizationId)=>item&&item.organizationId===organizationId;
const validCents=value=>value===null||value===undefined||
  (Number.isSafeInteger(value)&&value>=0);
const cents=value=>value===null||value===undefined?null:value;
function scopedLists(data,organizationId){
  if(!organizationId||typeof organizationId!=='string')
    throw new TypeError('Organisation requise.');
  for(const key of ['people','events','participations','options','choices','bookings']){
    if(!Array.isArray(data[key]||[]))
      throw new TypeError('Liste incorrecte : '+key);
  }
  return Object.fromEntries(['people','events','participations','options','choices','bookings']
    .map(key=>[key,(data[key]||[]).filter(row=>sameOrg(row,organizationId))]));
}
function choiceFor(choices,participationId,direction){
  return choices.find(row=>row.participationId===participationId&&
    row.direction===direction)||null;
}
function optionLegs(option){
  if(!Array.isArray(option.legs)||!option.legs.length)
    throw new TypeError('Option sans tronçon : '+option.id);
  const ordered=[...option.legs].sort((a,b)=>a.order-b.order);
  if(ordered.some((leg,index)=>leg.order!==index+1||!leg.from||!leg.to))
    throw new TypeError('Tronçons invalides : '+option.id);
  return ordered.map(leg=>({order:leg.order,from:leg.from,to:leg.to,
    departure:leg.departure,arrival:leg.arrival,mode:leg.mode,
    operator:leg.operator||null}));
}
function ticketStage(booking,selectedRank){
  if(!booking)return selectedRank?'CHOSEN':'PROPOSED';
  if(booking.filedAt&&!booking.paidAt)
    throw new TypeError('Un billet classé doit avoir été acheté.');
  if(booking.paidAt)return booking.filedAt?'FILED':'PAID';
  return booking.inCartAt?'IN_CART':selectedRank?'CHOSEN':'PROPOSED';
}
function bookingFor(bookings,optionId){
  const matching=bookings.filter(x=>x.optionId===optionId);
  if(matching.length>1)
    throw new TypeError('Plusieurs suivis pour la même option : '+optionId);
  return matching[0]||null;
}
function validateOptions(options){
  for(const option of options){
    if(!option.id||!option.participationId||
       !['A','R'].includes(option.direction)||
       typeof option.travelDate!=='string'||
       !/^\d{4}-\d{2}-\d{2}$/.test(option.travelDate)||
       !validCents(option.estimatedCents)){
      throw new TypeError('Option de voyage invalide.');
    }
    optionLegs(option);
  }
}
function distinctById(rows,what){
  const result=new Map();
  for(const row of rows){
    if(!row.id)throw new TypeError('ID manquant : '+what);
    if(result.has(row.id))throw new TypeError('ID en double : '+what);
    result.set(row.id,row);
  }
  return result;
}

/**
 * Return all options for ONE person during the travel MONTH, across events.
 * One option can contain multiple legs. Backups are visible, never billed twice.
 * This is a projection, NOT access control.
 */
export function personMonthView(input){
  const {organizationId,personId,month}=input;
  assertMonth(month);
  const data=scopedLists(input,organizationId);
  const person=data.people.find(x=>x.id===personId);
  if(!person)throw new Error('Personne absente de cette organisation.');
  const events=distinctById(data.events,'événement');
  const relevant=data.participations.filter(p=>p.personId===personId&&events.has(p.eventId));
  const options=data.options.filter(o=>relevant.some(p=>p.id===o.participationId));
  validateOptions(options);
  const result=[];
  for(const p of relevant){
    const event=events.get(p.eventId);
    const monthOptions=options.filter(o=>o.participationId===p.id&&
      o.travelDate.slice(0,7)===month);
    if(!monthOptions.length)continue;
    const journeys=monthOptions.map(option=>{
      const choice=choiceFor(data.choices,p.id,option.direction);
      const selectedRank=choice?.firstOptionId===option.id?1:
        choice?.backupOptionId===option.id?2:null;
      const booking=bookingFor(data.bookings.filter(b=>b.participationId===p.id),option.id);
      return {optionId:option.id,direction:option.direction,
        travelDate:option.travelDate,estimatedCents:cents(option.estimatedCents),
        source:option.source||null,selectedRank,
        stage:ticketStage(booking,selectedRank),
        inCartAt:booking?.inCartAt||null,paidAt:booking?.paidAt||null,
        filedAt:booking?.filedAt||null,
        paidCents:booking?.paidAt?cents(booking.paidCents):null,
        legs:optionLegs(option)};
    }).sort((a,b)=>a.travelDate.localeCompare(b.travelDate)||
      a.direction.localeCompare(b.direction)||
      (a.selectedRank||99)-(b.selectedRank||99)||
      a.optionId.localeCompare(b.optionId));
    result.push({eventId:event.id,eventTitle:event.title,
      participationId:p.id,eventDate:event.startDate||null,journeys});
  }
  result.sort((a,b)=>(a.eventDate||'').localeCompare(b.eventDate||'')||
    a.eventId.localeCompare(b.eventId));
  return {organizationId,person:{id:person.id,name:person.name},month,events:result};
}

/**
 * Organizer budget per event. Paid transactions are real spend even if the
 * artist changed the preferred option after purchase.
 * Forecast considers only primary choices not already paid.
 * Unknown money is reported as unknown, never converted to 0.
 */
export function eventBudgetSummary(input){
  const {organizationId,eventId}=input;
  const data=scopedLists(input,organizationId);
  const event=data.events.find(x=>x.id===eventId);
  if(!event)throw new Error('Événement absent de cette organisation.');
  if(!validCents(event.budgetCents))
    throw new TypeError('Enveloppe budgétaire invalide.');
  const people=data.participations.filter(p=>p.eventId===eventId);
  const pids=new Set(people.map(x=>x.id));
  const options=data.options.filter(x=>pids.has(x.participationId));
  validateOptions(options);
  const opt=distinctById(options,'option');
  const bookings=data.bookings.filter(b=>pids.has(b.participationId));
  const unique=distinctById(bookings,'suivi de billet');
  let paidKnownCents=0,paidUnknownCount=0,paidTickets=0;
  const paidOptionIds=new Set();
  for(const record of unique.values()){
    if(!opt.has(record.optionId))throw new TypeError('Suivi de billet sans option.');
    ticketStage(record,1);
    if(!validCents(record.paidCents))throw new TypeError('Prix payé invalide.');
    if(record.paidAt){
      paidTickets++;
      paidOptionIds.add(record.optionId);
      if(record.paidCents===null||record.paidCents===undefined)paidUnknownCount++;
      else paidKnownCents+=record.paidCents;
    }
  }
  let unpaidKnownEstimateCents=0,unpaidUnknownCount=0,unpaidChoices=0;
  const seen=new Set();
  for(const choice of data.choices){
    if(!pids.has(choice.participationId)||!choice.firstOptionId||
       choice.firstOptionId==='NONE')continue;
    const first=opt.get(choice.firstOptionId);
    if(!first||first.participationId!==choice.participationId||
       first.direction!==choice.direction)
      throw new TypeError('Choix principal sans proposition correspondante.');
    if(seen.has(first.id)||paidOptionIds.has(first.id))continue;
    seen.add(first.id);unpaidChoices++;
    if(first.estimatedCents===null||first.estimatedCents===undefined)unpaidUnknownCount++;
    else unpaidKnownEstimateCents+=first.estimatedCents;
  }
  const unknownCount=paidUnknownCount+unpaidUnknownCount;
  const budgetCents=cents(event.budgetCents);
  return {organizationId,eventId,budgetCents,paidTickets,paidKnownCents,
    paidUnknownCount,unpaidChoices,unpaidKnownEstimateCents,unpaidUnknownCount,
    forecastCents:unknownCount?null:paidKnownCents+unpaidKnownEstimateCents,
    forecastComplete:unknownCount===0,
    remainingFromKnownPaidCents:budgetCents===null?null:budgetCents-paidKnownCents};
}
