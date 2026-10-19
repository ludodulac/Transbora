import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';

function fixture(){
  const stores=new Map(),time={now:Date.parse('2026-10-19T08:00:00Z')};
  function getStore(name){
    if(!stores.has(name))stores.set(name,new Map());
    const map=stores.get(name);
    return {
      setJSON:async(key,value)=>{map.set(key,structuredClone(value));return {modified:true};},
      get:async(key)=>structuredClone(map.get(key)??null),
      delete:async(key)=>{map.delete(key);}
    };
  }
  const handler=createChoiceHandler({getStore,masterKey:()=>'very-private-secret-123',clock:()=>time.now});
  const event={title:'Festival',destination:'Paris',startDate:'2026-11-25',startTime:'14:00',
    endDate:'2026-11-26',endTime:'23:00'};
  const people=[
    {id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',
      options:{A:[{id:'aller-1',label:'Brest 8:00 → Paris 12:00'},{id:'aller-2',label:'Brest 9:00 → Paris 13:00'}],
      R:[{id:'retour-1',label:'Paris 23:45 → Brest 06:00'}]}},
    {id:'P-002',first:'Marc',last:'Legrand',departure:'Nantes',
      options:{A:[{id:'aller-3',label:'Nantes 11:00 → Paris 13:00'}],R:[]}}
  ];
  async function call(action,args={},secret){
    const req=new Request('https://test.example/api/transbora',{
      method:'POST',headers:{'content-type':'application/json',...(secret?{'x-transbora-admin':secret}:{})},
      body:JSON.stringify({action,...args})});
    const response=await handler(req);
    return {status:response.status,data:await response.json()};
  }
  return {call,stores,time,event,people};
}
test('secrets required to create links; participants need no account and only see their own trips',async()=>{
 const f=fixture();
 assert.equal((await f.call('create',{event:f.event,people:f.people,mode:'individual'})).status,403);
 const created=await f.call('create',{event:f.event,people:f.people,mode:'individual'},'very-private-secret-123');
 assert.equal(created.status,201);
 const {eventId,ownerKey,links}=created.data;
 assert.equal(links.length,2);
 assert.ok(ownerKey.length>30 && links[0].token.length>30);
 const person=await f.call('view',{token:links[0].token});
 assert.equal(person.status,200);
 assert.deepEqual(person.data.people.map(p=>p.first),['Sophie']);
 assert.equal(JSON.stringify(person.data).includes('very-private-secret-123'),false);
 const groupVisible=await f.call('status',{eventId,ownerKey:'not-valid'});
 assert.equal(groupVisible.status,403);
 const own=await f.call('status',{eventId,ownerKey});
 assert.equal(own.status,200);
 assert.equal(own.data.people[0].answer,null);
});
test('participant radio choices saved, rejected if unknown, repeatable and visible only on owner dashboard',async()=>{
 const f=fixture();
 const c=(await f.call('create',{event:f.event,people:f.people,mode:'individual'},'very-private-secret-123')).data;
 const token=c.links[0].token;
 assert.equal((await f.call('submit',{token,answers:[{personId:'P-001',A:'unknown',R:'retour-1'}]})).status,400);
 assert.equal((await f.call('submit',{token,answers:[{personId:'P-002',A:'aller-3'}]})).status,400);
 assert.equal((await f.call('submit',{token,answers:[{personId:'P-001',A:'aller-1',R:'retour-1'}]})).status,200);
 let status=(await f.call('status',{eventId:c.eventId,ownerKey:c.ownerKey})).data;
 assert.equal(status.people[0].answer.A,'aller-1');
 assert.equal(status.people[1].answer,null);
 await f.call('submit',{token,answers:[{personId:'P-001',A:'NONE',R:'retour-1'}]});
 status=(await f.call('status',{eventId:c.eventId,ownerKey:c.ownerKey})).data;
 assert.equal(status.people[0].answer.A,'NONE');
});
test('organizer group link permits one response per person, refuses omissions',async()=>{
 const f=fixture();
 const c=(await f.call('create',{event:f.event,people:f.people,mode:'group'},'very-private-secret-123')).data;
 assert.equal(c.links.length,1);
 const view=(await f.call('view',{token:c.links[0].token})).data;
 assert.equal(view.people.length,2);
 assert.equal((await f.call('submit',{token:c.links[0].token,
   answers:[{personId:'P-001',A:'aller-2',R:'retour-1'}]})).status,400);
 const done=await f.call('submit',{token:c.links[0].token,answers:[
  {personId:'P-001',A:'aller-2',R:'retour-1'},{personId:'P-002',A:'aller-3'}]});
 assert.equal(done.status,200);assert.equal(done.data.count,2);
 const status=(await f.call('status',{eventId:c.eventId,ownerKey:c.ownerKey})).data;
 assert.equal(status.people[1].answer.A,'aller-3');
});
test('owner can revoke all links and permanently delete saved responses',async()=>{
 const f=fixture(),c=(await f.call('create',{event:f.event,people:f.people,mode:'individual'},'very-private-secret-123')).data;
 assert.equal((await f.call('remove',{eventId:c.eventId,ownerKey:'invalid'})).status,403);
 const removed=await f.call('remove',{eventId:c.eventId,ownerKey:c.ownerKey});
 assert.equal(removed.status,200);
 assert.equal((await f.call('view',{token:c.links[0].token})).status,404);
 assert.equal(f.stores.get('transbora-choice-replies').size,0);
});
test('participant capability links expire after the event and retention period',async()=>{
 const f=fixture(),c=(await f.call('create',{event:f.event,people:f.people,mode:'individual'},'very-private-secret-123')).data;
 f.time.now+=100*24*3600*1000;
 assert.equal((await f.call('view',{token:c.links[0].token})).status,410);
 assert.equal((await f.call('submit',{token:c.links[0].token,answers:[]})).status,410);
});
test('unsafe record sizes, duplicate travelers and missing routes rejected before save',async()=>{
 const f=fixture();
 const dup=[f.people[0],{...f.people[0]}];
 assert.equal((await f.call('create',{event:f.event,people:dup,mode:'group'},'very-private-secret-123')).status,400);
 assert.equal((await f.call('create',{event:f.event,people:[],mode:'group'},'very-private-secret-123')).status,400);
 assert.equal((await f.call('create',{event:f.event,people:[{...f.people[0],options:{A:[],R:[]}}],mode:'group'},'very-private-secret-123')).status,201);
});
