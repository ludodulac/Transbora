import test from 'node:test';
import assert from 'node:assert/strict';
import {createRehearsalApi,KEY} from '../site/organizer-rehearsal.mjs';
function storage(){
 const m=new Map();
 return {m,getItem:key=>m.get(key)||null,setItem:(key,value)=>m.set(key,String(value))};
}
test('043: first visit loads fictitious month on this device without server request',async()=>{
 const store=storage(),api=createRehearsalApi(store);
 const me=await api('me');
 assert.equal(me.organizationName,'Atelier de démonstration');
 const people=(await api('list',{type:'person'})).items;
 assert.equal(people.length,2);
 assert.match(people[0].name,/exemple/);
 const journey=await api('person_month',{personId:'sophie-demo',month:'2026-10'});
 assert.equal(journey.events.length,1);
 assert.equal(journey.events[0].journeys.length,2);
 assert.deepEqual(journey.events[0].journeys.map(j=>j.selectedRank),[1,2]);
 assert.ok(store.m.has(KEY));
 const budget=await api('event_budget',{eventId:'festival-demo'});
 assert.equal(budget.forecastCents,6500,'backup is not a second payable ticket');
});
test('043: local edits persist but never cross to another device',async()=>{
 const s1=storage(),api=createRehearsalApi(s1);
 const record=(await api('save',{type:'person',record:{
   name:'Voyageur fictif',departure:'Rennes'}})).item;
 const event=(await api('save',{type:'event',record:{
   title:'Spectacle fictif',startDate:'2026-11-02',budgetCents:20000}})).item;
 const p=(await api('save',{type:'participation',record:{
   personId:record.id,eventId:event.id}})).item;
 const option=(await api('save',{type:'option',record:{
   participationId:p.id,direction:'A',travelDate:'2026-11-02',
   estimatedCents:null,legs:[{from:'Rennes',to:'Nantes',departure:'12:00',arrival:'13:00'}]}})).item;
 await api('save',{type:'choice',record:{participationId:p.id,direction:'A',
   firstOptionId:option.id}});
 const b=await api('event_budget',{eventId:event.id});
 assert.equal(b.forecastComplete,false);
 assert.equal(b.forecastCents,null,'unknown ticket price is not zero');
 await api('save',{type:'booking',record:{
   optionId:option.id,stage:'IN_CART'}});
 await api('save',{type:'booking',record:{
   optionId:option.id,stage:'PAID',paidCents:7500}});
 await api('save',{type:'booking',record:{
   optionId:option.id,stage:'FILED',paidCents:7500,receiptReference:'exemple/dossier'}});
 assert.equal((await api('event_budget',{eventId:event.id})).paidKnownCents,7500);
 const apiReload=createRehearsalApi(s1);
 assert.equal((await apiReload('person_month',{personId:record.id,month:'2026-11'}))
   .events[0].journeys[0].stage,'FILED');
 assert.equal((await createRehearsalApi(storage())('list',{type:'person'})).items.length,2);
 assert.throws(()=>JSON.parse(s1.getItem(KEY)).session,undefined);
 const exported=await api('export_backup');
 assert.equal(exported.type,'local-rehearsal');
 await api('reset_demo');
 assert.equal((await api('list',{type:'person'})).items.length,2);
});
test('043: demo still validates travelers, choice directions and booking transitions',async()=>{
 const api=createRehearsalApi(storage());
 await assert.rejects(()=>api('save',{type:'option',record:{
   participationId:'missing',direction:'A',travelDate:'2026-10-31',
   estimatedCents:1000,legs:[{from:'Paris',to:'Brest',departure:'10:00',arrival:'13:00'}]
 }}),/introuvable/);
 await assert.rejects(()=>api('save',{type:'choice',record:{
   participationId:'ps-demo',direction:'R',firstOptionId:'opt1-demo'
 }}),/autre voyageur|autorisé/);
 await assert.rejects(()=>api('save',{type:'booking',record:{
   optionId:'opt1-demo',stage:'FILED',paidCents:500
 }}),/dossier/);
});
