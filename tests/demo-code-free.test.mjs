import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';

function fixture({enabled}={}){
 const stores=new Map();
 const getStore=name=>{
  if(!stores.has(name))stores.set(name,new Map());
  const store=stores.get(name);
  return {get:async key=>structuredClone(store.get(key)||null),
    setJSON:async(key,val)=>store.set(key,structuredClone(val)),
    delete:async key=>store.delete(key)};
 };
 const api=createChoiceHandler({getStore,masterKey:()=>'',openDemo:()=>enabled});
 const record={action:'create',mode:'individual',
  event:{title:'Concert test',destination:'Paris',startDate:'2026-11-25',startTime:'14:00',
    endDate:'2026-11-25',endTime:'20:00'},
  people:[{id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',
    options:{A:[{id:'out-1',label:'Brest 09:00 → Paris 12:00'}],
      R:[{id:'return-1',label:'Paris 22:00 → Brest 01:00'}]}}]};
 const call=async(data,origin='https://transbora-ludo.netlify.app')=>{
  const res=await api(new Request('https://transbora-ludo.netlify.app/api/transbora',{
   method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},
   body:JSON.stringify(data)
  }));
  return {status:res.status,data:await res.json()};
 };
 return {call,record,stores};
}

test('open demo creates personal links without any password and records selections',async()=>{
 const x=fixture({enabled:true});
 const c=await x.call(x.record);
 assert.equal(c.status,201);
 assert.equal(c.data.links.length,1);
 assert.equal(c.data.ownerKey.length>=25,true);
 assert.ok(!JSON.stringify(c.data).includes('TRANSBORA_MASTER_KEY'));
 const url=c.data.links[0].token;
 const traveler=await x.call({action:'view',token:url});
 assert.equal(traveler.status,200);
 assert.deepEqual(traveler.data.people.map(p=>p.first),['Sophie']);
 const answer=await x.call({action:'submit',token:url,
    answers:[{personId:'P-001',A:'out-1',R:'return-1'}]});
 assert.equal(answer.status,200);
 const owner=await x.call({action:'status',eventId:c.data.eventId,ownerKey:c.data.ownerKey});
 assert.equal(owner.data.people[0].answer.A,'out-1');
 assert.equal((await x.call({action:'status',eventId:c.data.eventId,ownerKey:'not-owner'})).status,403);
});

test('without demo flag, creation remains protected',async()=>{
 const x=fixture({enabled:false});
 assert.equal((await x.call(x.record)).status,403);
});

test('demo rejects cross-origin browser creation, even with valid event fields',async()=>{
 const x=fixture({enabled:true});
 assert.equal((await x.call(x.record,'https://other.example')).status,403);
 assert.equal((await x.call(x.record,null)).status,403);
 assert.equal(x.stores.size>0,true);
 assert.equal(x.stores.get('transbora-event-records').size,0);
});

test('one collective link can be created without a code',async()=>{
 const x=fixture({enabled:true});
 const created=await x.call({...x.record,mode:'group'});
 assert.equal(created.status,201);
 const view=await x.call({action:'view',token:created.data.links[0].token});
 assert.equal(view.status,200);
 assert.equal(view.data.mode,'group');
});
