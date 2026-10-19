import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';

function fixture(){
  const stores=new Map();
  function getStore(name){
    if(!stores.has(name))stores.set(name,new Map());
    const map=stores.get(name);
    return {
      get:async key=>structuredClone(map.get(key)??null),
      setJSON:async(key,value)=>{map.set(key,structuredClone(value));return {modified:true};},
      delete:async key=>map.delete(key)
    };
  }
  const handle=createChoiceHandler({getStore,masterKey:()=>'',openDemo:()=>true,
    clock:()=>Date.parse('2026-10-19T14:00:00Z')});
  const event={title:'Concert Saint-Brieuc',destination:'Saint-Brieuc',
    startDate:'2026-11-29',startTime:'13:00',endDate:'2026-12-01',endTime:'09:00'};
  const people=[
    {id:'P-001',first:'Michel',last:'Delpech',departure:'Brest',
      options:{A:[{id:'a1',label:'Brest → Saint-Brieuc 10:00'}],
        R:[{id:'r1',label:'Saint-Brieuc → Brest 08:00'}]}},
    {id:'P-002',first:'Gerard',last:'Manger',departure:'Paris',
      options:{A:[{id:'a2',label:'Paris → Saint-Brieuc 07:00'}],R:[]}}
  ];
  async function call(action,payload={}){
    const req=new Request('https://transbora-ludo.netlify.app/api/transbora',{
      method:'POST',headers:{origin:'https://transbora-ludo.netlify.app',
        'content-type':'application/json'},
      body:JSON.stringify({action,...payload})
    });
    const response=await handle(req);
    return {status:response.status,value:await response.json()};
  }
  return {call,event,people,stores};
}
test('individual -> collective shares one active link without creating another event',async()=>{
  const x=fixture();
  const original=await x.call('create',{event:x.event,people:x.people,mode:'individual'});
  assert.equal(original.status,201);
  assert.equal(original.value.links.length,2);
  const {eventId,ownerKey}=original.value;
  const answer=await x.call('submit',{
    token:original.value.links[0].token,
    answers:[{personId:'P-001',A:'a1',R:'r1'}]
  });
  assert.equal(answer.status,200);
  const swapped=await x.call('switch_mode',{eventId,ownerKey,mode:'group'});
  assert.equal(swapped.status,200);
  assert.equal(swapped.value.links.length,1);
  assert.equal(swapped.value.eventId,eventId);
  assert.equal(swapped.value.ownerKey,ownerKey);
  const status=await x.call('status',{eventId,ownerKey});
  assert.equal(status.status,200);
  assert.equal(status.value.mode,'group');
  assert.equal(status.value.people[0].answer.A,'a1','Existing choices are preserved');
  assert.equal(status.value.links.length,1);
  assert.equal(x.stores.get('transbora-event-records').size,1);
  for(const old of original.value.links){
    const view=await x.call('view',{token:old.token});
    assert.ok([404,410].includes(view.status),'Original choice URL must no longer work');
  }
  const current=await x.call('view',{token:swapped.value.links[0].token});
  assert.equal(current.value.people.length,2);
  assert.equal(current.value.mode,'group');
});
test('the same dossier can switch back from group to individual without losing replies',async()=>{
  const x=fixture(),created=await x.call('create',
    {event:x.event,people:x.people,mode:'group'});
  const keys={eventId:created.value.eventId,ownerKey:created.value.ownerKey};
  const changed=await x.call('switch_mode',{...keys,mode:'individual'});
  assert.equal(changed.status,200);
  assert.equal(changed.value.links.length,2);
  const second=await x.call('switch_mode',{...keys,mode:'group'});
  assert.equal(second.status,200);
  assert.equal(second.value.links.length,1);
  assert.equal(second.value.eventId,keys.eventId);
  assert.equal(x.stores.get('transbora-event-records').size,1);
  assert.equal((await x.call('view',{token:changed.value.links[0].token})).status,404);
});
test('wrong organizer key cannot replace links or alter an existing dossier',async()=>{
  const x=fixture(),created=await x.call('create',{event:x.event,people:x.people,mode:'group'});
  const {eventId,ownerKey}=created.value;
  const denied=await x.call('switch_mode',{eventId,ownerKey:'invalid',mode:'individual'});
  assert.equal(denied.status,403);
  const valid=await x.call('view',{token:created.value.links[0].token});
  assert.equal(valid.status,200);
  const idempotent=await x.call('switch_mode',{eventId,ownerKey,mode:'group'});
  assert.equal(idempotent.value.unchanged,true);
  assert.equal(idempotent.value.links[0].token,created.value.links[0].token);
  assert.equal((await x.call('switch_mode',{eventId,ownerKey,mode:'invalid'})).status,400);
});
test('old choice URL cannot be used even if Blob deletion failed',async()=>{
  const x=fixture(),created=await x.call('create',{event:x.event,people:x.people,mode:'group'});
  // Simulate a dangling stale link when Blob deletion encounters a failure.
  const store=x.stores.get('transbora-private-links');
  const previous=store.get('t/'+created.value.links[0].token);
  const swapped=await x.call('switch_mode',{
    eventId:created.value.eventId,ownerKey:created.value.ownerKey,mode:'individual'});
  assert.equal(swapped.status,200);
  store.set('t/'+created.value.links[0].token,previous);
  assert.equal((await x.call('view',{token:created.value.links[0].token})).status,410);
  assert.equal((await x.call('submit',{token:created.value.links[0].token,answers:[]})).status,410);
});
