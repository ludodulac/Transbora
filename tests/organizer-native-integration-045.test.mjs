import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';
import {registerNativeLink} from '../site/organizer-replies-bridge.mjs';

test('045: REAL native choice handler creates link, artist answers, organizer demo reads it',async()=>{
 const stores=new Map();
 const getStore=name=>{
  if(!stores.has(name))stores.set(name,new Map());
  const m=stores.get(name);
  return {setJSON:async(k,v)=>m.set(k,structuredClone(v)),
    get:async k=>structuredClone(m.get(k)??null),
    delete:async k=>m.delete(k)};
 };
 const handler=createChoiceHandler({
  getStore,masterKey:()=> 'private-demo-admin-key',
  clock:()=>Date.parse('2026-10-30T12:00:00Z')
 });
 const post=async(action,args={},secret='')=>{
  const response=await handler(new Request('https://transbora-ludo.netlify.app/api/transbora',{
   method:'POST',
   headers:{'content-type':'application/json',...(secret?{'x-transbora-admin':secret}:{})},
   body:JSON.stringify({action,...args})
  }));
  return {code:response.status,data:await response.json()};
 };
 const event={title:'Festival exemple — données fictives',destination:'Mulhouse',
  startDate:'2026-10-31',startTime:'10:00',
  endDate:'2026-11-01',endTime:'20:00'};
 const people=[{id:'P-001',first:'Sophie',last:'(exemple)',departure:'Paris',
  options:{A:[{id:'sncf-A-1',label:'Paris 09:22 → Mulhouse 12:21'}],R:[]}}];
 const created=await post('create',{event,people,mode:'individual'},'private-demo-admin-key');
 assert.equal(created.code,201);
 assert.equal(created.data.links.length,1);
 const submitted=await post('submit',{token:created.data.links[0].token,
  answers:[{personId:'P-001',A:'sncf-A-1'}]});
 assert.equal(submitted.code,200);
 const status=await post('status',{
  eventId:created.data.eventId,ownerKey:created.data.ownerKey
 });
 assert.equal(status.code,200);
 assert.equal(status.data.people[0].answer.A,'sncf-A-1');
 const storage=new Map();
 const local={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),
  removeItem:k=>storage.delete(k)};
 const localApi=createRehearsalApi(local);
 const route={personId:'sophie-demo',direction:'A',travelDate:'2026-10-31',
  nativeOptionId:'sncf-A-1',sourceKey:'unique-route-A',
  estimatedCents:null,
  legs:[{from:'Paris',to:'Mulhouse',departure:'09:22',arrival:'12:21',
   departureDate:'2026-10-31',arrivalDate:'2026-10-31',mode:'rail'}]};
 await localApi('import_search_results',{eventId:'festival-demo',rows:[route]});
 const mapping=registerNativeLink(local,{
  organizerHandoff:{eventId:'festival-demo',title:event.title,
   destination:event.destination,startDate:event.startDate,
   travelers:[{personId:'sophie-demo',name:'Sophie (exemple)'}]},
  nativeEventId:created.data.eventId,
  participants:[{id:'P-001',organizerPersonId:'sophie-demo'}],
  plans:new Map(),choicePeople:people,routes:{rows:[route]}
 });
 const result=await localApi('sync_native_answers',{mapping,report:status.data});
 assert.equal(result.synced,1);
 const choice=(await localApi('list',{type:'choice'})).items.find(x=>x.direction==='A');
 const expected=(await localApi('list',{type:'option'})).items.find(x=>x.sourceKey==='unique-route-A');
 assert.equal(choice.firstOptionId,expected.id);
 assert.equal((await localApi('list',{type:'booking'})).items.length,0);
 assert.ok(!storage.get('transbora_local_example_043').includes(created.data.ownerKey));
 assert.ok(!storage.get('transbora_demo_native_links_045').includes(created.data.ownerKey));
});
