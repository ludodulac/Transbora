import test from 'node:test';
import assert from 'node:assert/strict';
import {personMonthView,eventBudgetSummary} from '../site/organizer-domain.mjs';

const trip=(id,participationId,direction,travelDate,estimatedCents,legs)=>({
 id,organizationId:'company-cliche',participationId,direction,
 travelDate,estimatedCents,source:'SNCF',legs
});
const leg=(order,from,to)=>({
 order,from,to,departure:'09:00',arrival:'12:00',mode:'rail',operator:'SNCF'
});
function sample(){
 return {
  organizationId:'company-cliche',personId:'sophie',month:'2026-10',
  people:[{id:'sophie',organizationId:'company-cliche',name:'Sophie Test'},
    {id:'sophie',organizationId:'other-company',name:'Personne à protéger'}],
  events:[{id:'e-oct',organizationId:'company-cliche',title:'Spectacle Strasbourg',
      startDate:'2026-10-31',budgetCents:75000},
    {id:'e-nov',organizationId:'company-cliche',title:'Spectacle Nantes',
      startDate:'2026-11-02',budgetCents:40000},
    {id:'e-private',organizationId:'other-company',title:'Secret',startDate:'2026-10-30'}],
  participations:[{id:'p-oct',organizationId:'company-cliche',personId:'sophie',eventId:'e-oct'},
    {id:'p-nov',organizationId:'company-cliche',personId:'sophie',eventId:'e-nov'},
    {id:'p-private',organizationId:'other-company',personId:'sophie',eventId:'e-private'}],
  options:[
   trip('o-1','p-oct','A','2026-10-30',8000,
     [leg(2,'Paris Montparnasse','Strasbourg'),leg(1,'Brest','Paris Montparnasse')]),
   trip('o-2','p-oct','A','2026-10-30',7000,[leg(1,'Brest','Strasbourg')]),
   trip('o-3','p-oct','R','2026-11-01',15000,[leg(1,'Strasbourg','Brest')]),
   trip('o-4','p-nov','A','2026-11-02',null,[leg(1,'Brest','Nantes')]),
   {...trip('hidden','p-private','A','2026-10-30',100,[leg(1,'Rennes','Lille')]),
     organizationId:'other-company'}
  ],
  choices:[
   {organizationId:'company-cliche',participationId:'p-oct',direction:'A',
     firstOptionId:'o-1',backupOptionId:'o-2'},
   {organizationId:'company-cliche',participationId:'p-oct',direction:'R',
     firstOptionId:'o-3',backupOptionId:null},
   {organizationId:'company-cliche',participationId:'p-nov',direction:'A',
     firstOptionId:'o-4',backupOptionId:null},
   {organizationId:'other-company',participationId:'p-private',direction:'A',
     firstOptionId:'hidden'}
  ],
  bookings:[
   {id:'b-cart',organizationId:'company-cliche',participationId:'p-oct',
    optionId:'o-1',inCartAt:'2026-10-29T10:00:00Z',paidAt:null,filedAt:null},
   {id:'b-paid',organizationId:'company-cliche',participationId:'p-oct',
    optionId:'o-3',paidAt:'2026-10-30T10:00:00Z',
    filedAt:'2026-10-30T11:00:00Z',paidCents:18000}
  ]
 };
}
test('M1: Jeanne monthly person filter returns all alternative options across events',()=>{
 const data=sample();
 const october=personMonthView(data);
 assert.deepEqual(october.events.map(e=>e.eventId),['e-oct']);
 assert.deepEqual(october.events[0].journeys.map(j=>j.optionId),['o-1','o-2']);
 assert.deepEqual(october.events[0].journeys.map(j=>j.selectedRank),[1,2]);
 assert.equal(october.events[0].journeys[0].stage,'IN_CART');
 assert.deepEqual(october.events[0].journeys[0].legs.map(l=>l.from),
   ['Brest','Paris Montparnasse'],'order segments, not options');
 assert.ok(!JSON.stringify(october).includes('Secret'));
 assert.ok(!JSON.stringify(october).includes('Personne à protéger'));
 const november=personMonthView({...data,month:'2026-11'});
 assert.deepEqual(november.events.map(e=>e.eventId),['e-oct','e-nov']);
 assert.deepEqual(november.events.flatMap(e=>e.journeys.map(j=>j.optionId)),
   ['o-3','o-4']);
 assert.equal(november.events[0].journeys[0].stage,'FILED');
 assert.equal(november.events[0].journeys[0].paidCents,18000);
});
test('M1: paid spend counted only once and alternatives never added to forecast',()=>{
 const data=sample();
 const budget=eventBudgetSummary({...data,eventId:'e-oct'});
 assert.equal(budget.budgetCents,75000);
 assert.equal(budget.paidKnownCents,18000);
 assert.equal(budget.paidTickets,1);
 assert.equal(budget.unpaidChoices,1);
 assert.equal(budget.unpaidKnownEstimateCents,8000);
 assert.equal(budget.forecastCents,26000);
 assert.equal(budget.remainingFromKnownPaidCents,57000);
 assert.equal(budget.forecastComplete,true);
});
test('M1: estimated budget unknown does NOT become zero',()=>{
 const budget=eventBudgetSummary({...sample(),eventId:'e-nov'});
 assert.equal(budget.unpaidUnknownCount,1);
 assert.equal(budget.forecastComplete,false);
 assert.equal(budget.forecastCents,null);
 assert.equal(budget.budgetCents,40000);
});
test('M1: purchase of an old non-selected option remains real cost',()=>{
 const data=sample();
 data.bookings.push({id:'b-old',organizationId:'company-cliche',
   participationId:'p-oct',optionId:'o-2',paidAt:'2026-10-31',paidCents:12000});
 const budget=eventBudgetSummary({...data,eventId:'e-oct'});
 assert.equal(budget.paidKnownCents,30000);
 assert.equal(budget.unpaidKnownEstimateCents,8000);
});
test('M1: filing cannot precede payment and pricing has to be valid cents',()=>{
 const data=sample();
 data.bookings[0].filedAt='2026-10-30';
 assert.throws(()=>personMonthView(data),/doit avoir été acheté/);
 assert.throws(()=>eventBudgetSummary({...data,eventId:'e-oct'}),/doit avoir été acheté/);
 const bad=sample();bad.options[0].estimatedCents=-1;
 assert.throws(()=>eventBudgetSummary({...bad,eventId:'e-oct'}),/Option de voyage invalide/);
});
test('M1: organization scoping is enforced as projection, not authentication',()=>{
 const data=sample();
 assert.throws(()=>personMonthView({...data,organizationId:'unrelated'}),/absente/);
 assert.throws(()=>eventBudgetSummary({...data,organizationId:'unrelated',eventId:'e-oct'}),/absent/);
 assert.throws(()=>personMonthView({...data,month:'2026-13'}),/Mois invalide/);
});
test('M1: never count a backup as a second planned ticket',()=>{
 const data=sample();data.options[1].estimatedCents=30000;
 assert.equal(eventBudgetSummary({...data,eventId:'e-oct'}).forecastCents,26000);
});
test('M1: choices never silently map to a different traveler or direction',()=>{
 const data=sample();data.choices[0].firstOptionId='o-3';
 assert.throws(()=>eventBudgetSummary({...data,eventId:'e-oct'}),/sans proposition correspondante/);
});
