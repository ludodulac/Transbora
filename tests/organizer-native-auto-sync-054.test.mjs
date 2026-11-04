import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';
import {createWorkspaceHandler} from '../backend/workspace-core.mjs';
import {syncNativeWorkspaceEvent} from '../backend/workspace-native-sync.mjs';
import {createHash} from 'node:crypto';

const root='https://transbora-ludo.netlify.app';
function storage(){
 const allStores=new Map();
 return name=>{
  if(!allStores.has(name))allStores.set(name,new Map());
  const rows=allStores.get(name);
  return {
   get:async key=>structuredClone(rows.get(key)??null),
   setJSON:async(key,value,options={})=>{
    if(options.onlyIfNew&&rows.has(key))return {modified:false};
    rows.set(key,structuredClone(value));return {modified:true};
   },
   delete:async key=>rows.delete(key),
   list:async({prefix=''})=>({blobs:[...rows.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))})
  };
 };
}
function organizerClient(handler){
 let cookie='';
 return {async call(action,payload={}){
  const response=await handler(new Request(root+'/api/transbora-workspace',{
   method:'POST',headers:{origin:root,cookie,'content-type':'application/json'},
   body:JSON.stringify({action,...payload})
  }));
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  return {status:response.status,body:await response.json()};
 }};
}
async function runNative(handler,action,payload,origin=false){
 const response=await handler(new Request(root+'/api/transbora',{
  method:'POST',headers:{'content-type':'application/json',...(origin?{origin:root}:{})},
  body:JSON.stringify({action,...payload})
 }));
 return {status:response.status,body:await response.json()};
}
async function fixture({auto=true}={}){
 const stores=storage();
 const privateStore=stores('transbora-organizer-private-v1');
 let now=Date.parse('2026-11-04T10:00:00Z');
 let native;
 const nativeStatus=async(eventId,ownerKey)=>{
  const response=await runNative(native,'status',{eventId,ownerKey});
  if(response.status!==200)throw Error('Native status refused.');
  return response.body;
 };
 native=createChoiceHandler({
  getStore:stores,masterKey:()=>'',openDemo:()=>true,clock:()=>++now,
  onAnswerSaved:auto?async eventId=>{
   await syncNativeWorkspaceEvent({store:privateStore,nativeEventId:eventId,nativeStatus,clock:()=>++now});
  }:async()=>{}
 });
 const workspace=createWorkspaceHandler({
  getStore:stores,masterKey:()=> 'unit-test-setup-secret-value-123456',
  clock:()=>++now,nativeStatus
 });
 const owner=organizerClient(workspace);
 assert.equal((await owner.call('bootstrap',{setupKey:'unit-test-setup-secret-value-123456',
  organizationName:'Compagnie Jeanne',email:'jeanne@example.fr',password:'long-passphrase-jeanne-12345'})).status,201);
 assert.equal((await owner.call('login',{email:'jeanne@example.fr',
  password:'long-passphrase-jeanne-12345'})).status,200);
 const person=(await owner.call('save',{type:'person',record:{name:'Camille Martin',departure:'Brest'}})).body.item;
 const event=(await owner.call('save',{type:'event',record:{title:'Concert Nantes',
  destination:'Nantes',startDate:'2026-11-20'}})).body.item;
 const part=(await owner.call('save',{type:'participation',record:{
  personId:person.id,eventId:event.id}})).body.item;
 const legs=time=>[{from:'Brest',to:'Nantes',
  departure:'09:'+time,arrival:'13:'+time,
  departureDate:'2026-11-20',arrivalDate:'2026-11-20',mode:'rail',operator:'SNCF'}];
 const routes=[{personId:person.id,direction:'A',travelDate:'2026-11-20',
   sourceKey:'source-A-1',legs:legs('10')},
   {personId:person.id,direction:'A',travelDate:'2026-11-20',
   sourceKey:'source-A-2',legs:legs('20')}];
 const nativeEvent={title:event.title,destination:event.destination,startDate:event.startDate,
  endDate:'2026-11-21',startTime:'18:00',endTime:'21:00'};
 const people=[{id:'P-001',first:'Camille',last:'Martin',departure:'Brest',options:{
   A:[{id:'train-A-1',label:'Brest Nantes train 1'},
      {id:'train-A-2',label:'Brest Nantes train 2'}],R:[]}}];
 const created=await runNative(native,'create',{event:nativeEvent,people,mode:'individual'},true);
 assert.equal(created.status,201,JSON.stringify(created.body));
 const mapping={version:1,organizerEventId:event.id,nativeEventId:created.body.eventId,
  title:event.title,destination:event.destination,startDate:event.startDate,
  travelers:[{organizerPersonId:person.id,nativePersonId:'P-001',options:{
   A:[{nativeOptionId:'train-A-1',sourceKey:'source-A-1'},
      {nativeOptionId:'train-A-2',sourceKey:'source-A-2'}],R:[]}}]};
 const send=async(answers)=>runNative(native,'submit',{token:created.body.links[0].token,
  answers:[{personId:'P-001',...answers}]});
 return {owner,native,privateStore,nativeStatus,person,event,part,routes,created,mapping,send};
}
test('054: the organizer cannot link a fake choice or a not-yet-imported timetable',async()=>{
 const x=await fixture();
 const fail=await x.owner.call('link_native_choices',{
  eventId:x.event.id,mapping:x.mapping,ownerKey:x.created.body.ownerKey});
 assert.equal(fail.status,409);
 assert.match(fail.body.error,/horaires/i);
 assert.equal((await x.owner.call('import_search_results',{eventId:x.event.id,rows:x.routes})).status,200);
 const forged=structuredClone(x.mapping);
 forged.travelers[0].options.A[0].nativeOptionId='invented-train';
 const reject=await x.owner.call('link_native_choices',{
  eventId:x.event.id,mapping:forged,ownerKey:x.created.body.ownerKey});
 assert.equal(reject.status,409);
 assert.deepEqual((await x.owner.call('list',{type:'choice'})).body.items,[]);
});
test('054: artist first/second ranked choices appear in Jeanne private workspace immediately on submit',async()=>{
 const x=await fixture();
 const imported=await x.owner.call('import_search_results',{eventId:x.event.id,rows:x.routes});
 assert.equal(imported.status,200,JSON.stringify(imported.body));
 assert.equal(imported.body.imported,2);
 const linked=await x.owner.call('link_native_choices',{eventId:x.event.id,
  mapping:x.mapping,ownerKey:x.created.body.ownerKey});
 assert.equal(linked.status,201,JSON.stringify(linked.body));
 assert.equal(linked.body.linked,true);
 const first=await x.send({A:'train-A-2',A2:'train-A-1'});
 assert.equal(first.status,200,JSON.stringify(first.body));
 const saved=(await x.owner.call('list',{type:'choice'})).body.items;
 assert.equal(saved.length,1);
 assert.equal(saved[0].direction,'A');
 const travel=(await x.owner.call('list',{type:'option'})).body.items;
 const keyHash=key=>createHash('sha256').update(x.event.id+'|'+key).digest('hex');
 assert.equal(saved[0].firstOptionId,travel.find(o=>o.sourceKeyHash===keyHash('source-A-2')).id);
 assert.equal(saved[0].backupOptionId,travel.find(o=>o.sourceKeyHash===keyHash('source-A-1')).id);
 assert.equal(saved[0].origin,'native');
 assert.match(saved[0].confirmedBy,/artiste/);
 assert.deepEqual((await x.owner.call('list',{type:'booking'})).body.items,[],
  'a chosen train is never a purchased train');
 const unchanged=await x.owner.call('sync_native_choices');
 assert.equal(unchanged.status,200);
 assert.equal(unchanged.body.synced,0);
 assert.equal(unchanged.body.results[0].unchanged,1);
 assert.equal((await x.owner.call('export_backup')).body.data.choice.length,1);
 const exportJson=JSON.stringify((await x.owner.call('export_backup')).body);
 const listJson=JSON.stringify((await x.owner.call('list',{type:'choice'})).body);
 assert.ok(!exportJson.includes(x.created.body.ownerKey));
 assert.ok(!listJson.includes(x.created.body.ownerKey));
 const switched=await x.send({A:'train-A-1',A2:'train-A-2'});
 assert.equal(switched.status,200);
 const reread=(await x.owner.call('list',{type:'choice'})).body.items[0];
 assert.notEqual(reread.firstOptionId,saved[0].firstOptionId);
 assert.equal(reread.backupOptionId,saved[0].firstOptionId);
});
test('054: manual organizer choices are preserved, later artist changes are reported as conflicts',async()=>{
 const x=await fixture();
 await x.owner.call('import_search_results',{eventId:x.event.id,rows:x.routes});
 await x.owner.call('link_native_choices',{eventId:x.event.id,
  mapping:x.mapping,ownerKey:x.created.body.ownerKey});
 const routes=(await x.owner.call('list',{type:'option'})).body.items;
 const manual=await x.owner.call('save',{type:'choice',record:{
  participationId:x.part.id,direction:'A',firstOptionId:routes[0].id,backupOptionId:null}});
 assert.equal(manual.status,200);
 assert.equal((await x.send({A:'train-A-2',A2:null})).status,200);
 const after=(await x.owner.call('list',{type:'choice'})).body.items[0];
 assert.equal(after.firstOptionId,routes[0].id);
 const summary=await x.owner.call('sync_native_choices');
 assert.equal(summary.body.synced,0);
 assert.ok(summary.body.conflicts.length>0);
});
test('054: reconciliation on opening recovers a missed callback without reasking any artist',async()=>{
 const x=await fixture({auto:false});
 await x.owner.call('import_search_results',{eventId:x.event.id,rows:x.routes});
 await x.owner.call('link_native_choices',{eventId:x.event.id,
  mapping:x.mapping,ownerKey:x.created.body.ownerKey});
 assert.equal((await x.send({A:'train-A-1',A2:'train-A-2'})).status,200);
 assert.equal((await x.owner.call('list',{type:'choice'})).body.items.length,0);
 const repaired=await x.owner.call('sync_native_choices');
 assert.equal(repaired.status,200);
 assert.equal(repaired.body.synced,1);
 assert.equal((await x.owner.call('list',{type:'choice'})).body.items.length,1);
});
