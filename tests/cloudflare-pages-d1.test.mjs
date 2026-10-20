import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1Stores} from '../cloudflare/d1-store.mjs';
import {onRequest} from '../functions/api/transbora.js';

function fakeD1(){
  const records=new Map();
  return {
    records,
    prepare(sql){
      let args=[];
      return {
        bind(...input){args=input;return this;},
        async first(){
          assert.match(sql,/^SELECT value FROM transbora_records/);
          const item=records.get(JSON.stringify(args));
          return item?{value:item.value}:null;
        },
        async run(){
          const key=JSON.stringify(args.slice(0,2));
          if(sql.startsWith('INSERT OR IGNORE')){
            if(records.has(key))return {meta:{changes:0}};
            records.set(key,{value:args[2]});return {meta:{changes:1}};
          }
          if(sql.startsWith('INSERT INTO transbora_records')){
            records.set(key,{value:args[2]});return {meta:{changes:1}};
          }
          if(sql.startsWith('DELETE FROM transbora_records')){
            const modified=records.delete(key);
            return {meta:{changes:Number(modified)}};
          }
          throw new Error('Unexpected SQL');
        }
      };
    }
  };
}
const event={title:'Festival',destination:'Paris',startDate:'2026-11-25',
  startTime:'14:00',endDate:'2026-11-26',endTime:'22:00'};
const people=[
  {id:'P-001',first:'Test',last:'Martin',departure:'Nantes',
    options:{A:[{id:'T1',label:'Nantes → Paris · 09h00'}],R:[]}}
];
function fixture(){
  const db=fakeD1(),env={TRANSBORA_DB:db};
  async function call(action,payload={},headers={}){
    const request=new Request('https://transbora-demo.pages.dev/api/transbora',{
      method:'POST',headers:{'content-type':'application/json','origin':'https://transbora-demo.pages.dev',...headers},
      body:JSON.stringify({action,...payload})
    });
    const response=await onRequest({request,env});
    return {status:response.status,data:await response.json()};
  }
  return {db,env,call};
}

test('D1 stores isolate buckets and enforce onlyIfNew',async()=>{
  const db=fakeD1(),getStore=createD1Stores(db);
  await getStore('transbora-event-records').setJSON('e/x',{item:1},{onlyIfNew:true});
  await assert.rejects(()=>getStore('transbora-event-records').setJSON('e/x',{item:2},{onlyIfNew:true}));
  assert.deepEqual(await getStore('transbora-event-records').get('e/x',{type:'json'}),{item:1});
  assert.equal(await getStore('transbora-private-links').get('e/x',{type:'json'}),null);
  await getStore('transbora-event-records').setJSON('e/x',{item:3});
  assert.deepEqual(await getStore('transbora-event-records').get('e/x',{type:'json'}),{item:3});
  await getStore('transbora-event-records').delete('e/x');
  assert.equal(await getStore('transbora-event-records').get('e/x',{type:'json'}),null);
  assert.throws(()=>getStore('unexpected-bucket'));
});
test('Pages Function preserves organizer creation, individual choice and private replies',async()=>{
  const f=fixture();
  const made=await f.call('create',{event,people,mode:'individual'});
  assert.equal(made.status,201);
  const {eventId,ownerKey,links}=made.data;
  assert.equal(links.length,1);
  assert.equal((await f.call('view',{token:links[0].token})).data.people[0].first,'Test');
  const saved=await f.call('submit',{token:links[0].token,answers:[
    {personId:'P-001',A:'T1'}]});
  assert.equal(saved.status,200);
  const report=await f.call('status',{eventId,ownerKey});
  assert.equal(report.status,200);
  assert.equal(report.data.people[0].answer.A,'T1');
  const switched=await f.call('switch_mode',{eventId,ownerKey,mode:'group'});
  assert.equal(switched.status,200);
  assert.equal((await f.call('view',{token:links[0].token})).status,404);
  assert.equal((await f.call('status',{eventId,ownerKey})).data.people[0].answer.A,'T1');
  assert.equal((await f.call('remove',{eventId,ownerKey})).status,200);
  assert.equal((await f.call('status',{eventId,ownerKey})).status,403);
  assert.equal(f.db.records.size,0);
});
test('Cloudflare does not allow anonymous cross-origin creation or private owner actions',async()=>{
  const f=fixture();
  const cross=await f.call('create',{event,people,mode:'individual'},
    {'origin':'https://attacker.example'});
  assert.equal(cross.status,403);
  const created=(await f.call('create',{event,people,mode:'individual'})).data;
  assert.equal((await f.call('remove',{eventId:created.eventId,ownerKey:'wrong'})).status,403);
});
test('missing D1 binding fails explicitly instead of silently losing responses',async()=>{
  const request=new Request('https://transbora.pages.dev/api/transbora',{method:'GET'});
  const response=await onRequest({request,env:{}});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/Base de données/);
});
