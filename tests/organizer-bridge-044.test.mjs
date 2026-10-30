import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchHandoff,readSearchHandoff,wizardPeople,routesFromSearch,
  writeSearchResults,readSearchResults,HANDOFF_KEY,RESULTS_KEY} from '../site/organizer-bridge.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';
import {parisTime,parisDate} from '../site/time-zones.mjs';
const store=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),
  removeItem:k=>map.delete(k)};
};
const fixture=()=>({
 event:{id:'festival-demo',title:'Festival exemple',startDate:'2026-10-31',
  destination:'Mulhouse',budgetCents:75000},
 people:[{id:'sophie-demo',name:'Sophie Martin',departure:'Paris Gare de Lyon',
  reductionCards:'Carte Avantage',preferences:'Train calme',email:'secret@example.invalid',
  phone:'0123456789'},
  {id:'michel-demo',name:'Michel',departure:'Brest'}],
 participations:[{eventId:'festival-demo',personId:'sophie-demo'},
  {eventId:'festival-demo',personId:'michel-demo'}]
});
test('event handoff contains only local demo, not contacts, budget or secrets',()=>{
 const s=store(),data=createSearchHandoff(s,fixture(),1000);
 assert.equal(data.travelers.length,2);
 assert.equal(data.travelers[0].reductionCards,'Carte Avantage');
 assert.ok(!s.getItem(HANDOFF_KEY).includes('secret@example.invalid'));
 assert.ok(!s.getItem(HANDOFF_KEY).includes('75000'));
 assert.ok(!s.getItem(HANDOFF_KEY).includes('0123456789'));
 assert.deepEqual(wizardPeople(data).map(p=>p.last),['Martin','']);
 assert.equal(wizardPeople(data)[0].organizerPersonId,'sophie-demo');
 assert.deepEqual(readSearchHandoff(s,1001),data);
 assert.equal(readSearchHandoff(s,1000+13*3600000),null);
});
test('handoff refuses unassigned people or missing departure',()=>{
 const s=store(),input=fixture();
 input.people[0].departure='';
 assert.throws(()=>createSearchHandoff(s,input),/gare habituelle/);
 assert.equal(s.getItem(HANDOFF_KEY),null);
});
test('search results preserve authentic legs, overnight calendar and unknown prices',()=>{
 const s=store(),handoff=createSearchHandoff(s,fixture(),5000);
 const participants=wizardPeople(handoff);
 const plans=new Map([[participants[0].id,{outward:[{
  date:'2026-10-31',legs:[
   {from:'Paris Gare de Lyon',to:'Dijon',departure:82800,arrival:86340,mode:'rail',provider:'SNCF'},
   {from:'Dijon',to:'Mulhouse',departure:90000,arrival:95400,mode:'rail',provider:'SNCF'}
  ]
 }],returning:[]}]]);
 const data=routesFromSearch(handoff,participants,plans,{parisDate,parisTime});
 assert.equal(data.rows.length,1);
 const route=data.rows[0];
 assert.equal(route.personId,'sophie-demo');
 assert.equal(route.direction,'A');
 assert.equal(route.travelDate,'2026-10-31');
 assert.equal(route.legs[0].departureDate,'2026-10-31');
 assert.equal(route.legs[1].departureDate,'2026-11-01');
 assert.equal(route.legs[1].arrivalDate,'2026-11-01');
 assert.equal(route.estimatedCents,null);
 assert.ok(!JSON.stringify(route).includes('Carte Avantage'));
 writeSearchResults(s,data,5001);
 assert.equal(readSearchResults(s,5002).rows.length,1);
 assert.equal(readSearchResults(s,5001+13*3600000),null);
});
test('import into local demo is atomic, idempotent and never manufactures prices or bookings',async()=>{
 const s=store(),api=createRehearsalApi(s);
 const handoff=createSearchHandoff(s,fixture(),30000);
 const p=wizardPeople(handoff)[0];
 const plans=new Map([[p.id,{outward:[{
  date:'2026-10-31',from:'Paris',to:'Mulhouse',departure:32400,arrival:46800,mode:'rail',
  provider:'SNCF'
 }],returning:[]}]]);
 const batch=routesFromSearch(handoff,[p],plans,{parisDate,parisTime});
 assert.equal(batch.rows.length,1);
 const invalid=structuredClone(batch.rows);
 invalid.push({...invalid[0],personId:'unknown',sourceKey:'invalid'});
 await assert.rejects(api('import_search_results',{eventId:handoff.eventId,rows:invalid}),/non inscrit/);
 assert.equal((await api('list',{type:'option'})).items.length,3);
 const first=await api('import_search_results',{...batch});
 assert.deepEqual(first,{imported:1,alreadyPresent:0});
 const second=await api('import_search_results',{...batch});
 assert.deepEqual(second,{imported:0,alreadyPresent:1});
 const options=(await api('list',{type:'option'})).items;
 assert.equal(options.length,4);
 const imported=options.find(o=>o.sourceKey===batch.rows[0].sourceKey);
 assert.equal(imported.estimatedCents,null);
 assert.equal(imported.participationId,'ps-demo');
 assert.equal((await api('list',{type:'booking'})).items.length,0);
 const projection=await api('person_month',{personId:'sophie-demo',month:'2026-10'});
 assert.ok(projection.events.some(e=>e.journeys.some(j=>j.optionId===imported.id)));
});
