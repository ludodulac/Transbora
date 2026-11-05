import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultTravelNeed} from '../site/organizer-needs.mjs';
import {buildSearchHandoff,wizardPeople} from '../site/organizer-bridge.mjs';
import {createRehearsalApi,KEY} from '../site/organizer-rehearsal.mjs';
import {createWorkspaceHandler} from '../backend/workspace-core.mjs';

function localStorage(){
 const rows=new Map();
 return {
  getItem:key=>rows.get(key)||null,
  setItem:(key,value)=>rows.set(key,value),
  removeItem:key=>rows.delete(key)
 };
}
test('055: arrival deadline inherits event time and crosses midnight safely',()=>{
 const event={startDate:'2026-12-02',startTime:'00:15',endTime:'03:00',
  destination:'Rennes',arrivalLeadMinutes:60};
 const person={departure:'Brest'};
 assert.deepEqual(defaultTravelNeed(event,person,'A'),{
  targetDate:'2026-12-01',targetTime:'23:15',
  origin:'Brest',destination:'Rennes'
 });
 assert.deepEqual(defaultTravelNeed({...event,endDate:'2026-12-03',
  endTime:'14:00'},person,'R'),{
  targetDate:'2026-12-03',targetTime:'14:00',
  origin:'Rennes',destination:'Brest'
 });
});
test('055: real person preserved, fictional Sophie and Michel removed from local legacy data',async()=>{
 const store=localStorage();
 store.setItem(KEY,JSON.stringify({version:1,
  person:[{id:'sophie-demo',name:'Sophie (exemple)',departure:'Paris'},
   {id:'michel-demo',name:'Michel (exemple)',departure:'Brest'},
   {id:'gerard-real',name:'Gérard',departure:'Nantes'}],
  event:[],participation:[],option:[],choice:[],booking:[],note:[]}));
 const api=createRehearsalApi(store,{cleanExamples:true});
 const people=(await api('list',{type:'person'})).items;
 assert.deepEqual(people.map(p=>p.name),['Gérard']);
 assert.deepEqual((await api('list',{type:'need'})).items,[]);
});
test('055: one person can have many requirements for one event and reversible enrollment',async()=>{
 const api=createRehearsalApi(localStorage(),{cleanExamples:true});
 const person=(await api('save',{type:'person',record:{
  name:'Gérard',departure:'Brest',reductionCards:'Carte Avantage Senior | Autre carte'}})).item;
 const event=(await api('save',{type:'event',record:{
  title:'Spectacle Rennes',startDate:'2026-12-02',startTime:'20:00',
  endDate:'2026-12-03',endTime:'21:00',arrivalLeadMinutes:60,
  destination:'Rennes',budgetCents:null}})).item;
 const participation=(await api('save',{type:'participation',record:{
  personId:person.id,eventId:event.id}})).item;
 const a=defaultTravelNeed(event,person,'A');
 for(const targetTime of ['19:00','15:00']){
  await api('save',{type:'need',record:{
   participationId:participation.id,direction:'A',...a,
   targetTime,customized:targetTime!=='19:00'
  }});
 }
 const needs=(await api('list',{type:'need'})).items;
 assert.equal(needs.length,2);
 assert.equal(needs.filter(n=>n.participationId===participation.id).length,2);
 const handoff=buildSearchHandoff({event,people:[person],
  participations:[participation],need:needs[1]});
 assert.equal(handoff.travelers.length,1);
 assert.equal(wizardPeople(handoff)[0].arrivalTime,needs[1].targetTime);
 await api('set_participation_active',{participationId:participation.id,active:false});
 assert.equal((await api('list',{type:'person'})).items[0].name,'Gérard');
 assert.equal((await api('list',{type:'need'})).items.length,2);
 await api('set_participation_active',{participationId:participation.id,active:true});
 assert.equal((await api('list',{type:'participation'})).items[0].active,true);
});
test('055: form has genuine events, travelers, requirements and an open-ended card',()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 assert.match(html,/id="need-form"/);
 assert.match(html,/name="startTime" type="time"/);
 assert.match(html,/name="arrivalLeadMinutes"/);
 assert.match(html,/id="person-card-other-checkbox"/);
 assert.match(html,/id="person-card-other"/);
 assert.match(html,/Préférences et remarques de voyage/);
 assert.doesNotMatch(html,/placeholder="(?:Sophie|Michel|Mulhouse|750|Paris)/i);
 assert.doesNotMatch(html,/Atelier de démonstration/);
});
function memoryStores(){
 const map=new Map();
 return name=>{
  if(!map.has(name))map.set(name,new Map());
  const rows=map.get(name);
  return {
   get:async key=>structuredClone(rows.get(key)??null),
   setJSON:async(key,value)=>{rows.set(key,structuredClone(value));return {modified:true}},
   delete:async key=>rows.delete(key),
   list:async({prefix=''})=>({blobs:[...rows.keys()]
    .filter(key=>key.startsWith(prefix)).map(key=>({key}))})
  };
 };
}
test('055: shared workspace stores separate requirements; removing event participation never erases the person',async()=>{
 const root='https://transbora-ludo.netlify.app';
 const handler=createWorkspaceHandler({
  getStore:memoryStores(),masterKey:()=> 'workspace-setup-secret-0123456789012345'
 });
 let cookie='';
 const call=async(action,payload={})=>{
  const res=await handler(new Request(root+'/api/transbora-workspace',{
   method:'POST',headers:{origin:root,cookie,'content-type':'application/json'},
   body:JSON.stringify({action,...payload})
  }));
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  const body=await res.json();
  assert.ok(res.ok,action+': '+JSON.stringify(body));
  return body;
 };
 await call('bootstrap',{setupKey:'workspace-setup-secret-0123456789012345',
  organizationName:'TRANSBORA',email:'jeanne@example.fr',password:'secure-jeanne-password-123'});
 await call('login',{email:'jeanne@example.fr',password:'secure-jeanne-password-123'});
 const p=(await call('save',{type:'person',record:{name:'Gérard',departure:'Brest'}})).item;
 const e=(await call('save',{type:'event',record:{title:'Concert Rennes',
  startDate:'2026-12-02',startTime:'20:00',endTime:'21:30',
  arrivalLeadMinutes:60,destination:'Rennes'}})).item;
 const part=(await call('save',{type:'participation',record:{personId:p.id,eventId:e.id}})).item;
 for(const time of ['19:00','17:00']){
  await call('save',{type:'need',record:{participationId:part.id,
   direction:'A',targetDate:'2026-12-02',targetTime:time,
   origin:'Brest',destination:'Rennes',customized:time!=='19:00'}});
 }
 assert.equal((await call('list',{type:'need'})).items.length,2);
 await call('set_participation_active',{participationId:part.id,active:false});
 assert.equal((await call('list',{type:'person'})).items.length,1);
 assert.equal((await call('list',{type:'need'})).items.length,2);
 assert.equal((await call('list',{type:'participation'})).items[0].active,false);
});
