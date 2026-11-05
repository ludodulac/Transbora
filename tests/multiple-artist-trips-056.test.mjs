import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';
import {createWorkspaceHandler} from '../backend/workspace-core.mjs';
import {syncNativeWorkspaceEvent} from '../backend/workspace-native-sync.mjs';

const origin='https://transbora-ludo.netlify.app';
function storage(){
 const all=new Map();
 return name=>{
  if(!all.has(name))all.set(name,new Map());
  const db=all.get(name);
  return {
   get:async key=>structuredClone(db.get(key)??null),
   setJSON:async(key,value,opts={})=>{
    if(opts.onlyIfNew&&db.has(key))return {modified:false};
    db.set(key,structuredClone(value));return {modified:true};
   },
   delete:async key=>db.delete(key),
   list:async({prefix=''})=>({blobs:[...db.keys()]
    .filter(k=>k.startsWith(prefix)).map(key=>({key}))})
  };
 };
}
test('056: two trips for one artist at one event keep separate rank 1/2 replies',async()=>{
 const stores=storage(),privateStore=stores('transbora-organizer-private-v1');
 let native;
 const callNative=async(action,payload,create=false)=>{
  const response=await native(new Request(origin+'/api/transbora',{method:'POST',
   headers:{'content-type':'application/json',...(create?{origin}:{})},
   body:JSON.stringify({action,...payload})}));
  return {status:response.status,body:await response.json()};
 };
 const nativeStatus=async(eventId,ownerKey)=>{
  const response=await callNative('status',{eventId,ownerKey});
  assert.equal(response.status,200);
  return response.body;
 };
 native=createChoiceHandler({getStore:stores,masterKey:()=>'',openDemo:()=>true,
  onAnswerSaved:async nativeEventId=>{
   await syncNativeWorkspaceEvent({store:privateStore,nativeEventId,nativeStatus});
  }});
 const workspace=createWorkspaceHandler({getStore:stores,
  masterKey:()=> 'private-org-setup-secret-0123456789',nativeStatus});
 let cookie='';
 const call=async(action,payload={})=>{
  const response=await workspace(new Request(origin+'/api/transbora-workspace',{
   method:'POST',headers:{origin,cookie,'content-type':'application/json'},
   body:JSON.stringify({action,...payload})}));
  if(response.headers.get('set-cookie'))
   cookie=response.headers.get('set-cookie').split(';')[0];
  const result=await response.json();
  assert.ok(response.ok,action+': '+JSON.stringify(result));
  return result;
 };
 await call('bootstrap',{setupKey:'private-org-setup-secret-0123456789',
  organizationName:'Organisatrice',email:'jeanne@example.fr',
  password:'jeanne-private-passphrase-long'});
 await call('login',{email:'jeanne@example.fr',password:'jeanne-private-passphrase-long'});
 const p=(await call('save',{type:'person',record:{name:'Gérard Martin',departure:'Brest'}})).item;
 const e=(await call('save',{type:'event',record:{title:'Spectacle Rennes',
  startDate:'2026-12-02',startTime:'20:00',endTime:'22:00',
  destination:'Rennes',arrivalLeadMinutes:60}})).item;
 const participation=(await call('save',{type:'participation',record:{personId:p.id,eventId:e.id}})).item;
 const createNative=async(index,need,source)=>{
  const event={title:e.title,destination:e.destination,startDate:e.startDate,
   endDate:'2026-12-04',startTime:'20:00',endTime:'23:00'};
  const n1='t'+index+'a',n2='t'+index+'b';
  const people=[{id:'P-001',first:'Gérard',last:'Martin',departure:'Brest',
   options:{A:[{id:n1,label:'Train option 1'},{id:n2,label:'Train option 2'}],R:[]}}];
  const created=await callNative('create',{event,people,mode:'individual'},true);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const rows=[n1,n2].map((nativeOptionId,i)=>({
   personId:p.id,needId:need.id,direction:'A',travelDate:'2026-12-02',
   sourceKey:source+'-'+i,legs:[{from:'Brest',to:'Rennes',
    departure:i?'10:00':'09:00',arrival:i?'13:00':'12:00',
    departureDate:'2026-12-02',arrivalDate:'2026-12-02',mode:'rail',operator:'SNCF'}]
  }));
  assert.equal((await call('import_search_results',{eventId:e.id,rows})).imported,2);
  const mapping={version:1,needId:need.id,organizerEventId:e.id,
   nativeEventId:created.body.eventId,title:e.title,destination:e.destination,
   startDate:e.startDate,travelers:[{organizerPersonId:p.id,nativePersonId:'P-001',
    options:{A:[{nativeOptionId:n1,sourceKey:source+'-0'},
      {nativeOptionId:n2,sourceKey:source+'-1'}],R:[]}}]};
  assert.equal((await call('link_native_choices',{eventId:e.id,
   mapping,ownerKey:created.body.ownerKey})).linked,true);
  return {created,n1,n2};
 };
 const a=(await call('save',{type:'need',record:{participationId:participation.id,
  direction:'A',targetDate:'2026-12-02',targetTime:'19:00',
  origin:'Brest',destination:'Rennes'}})).item;
 const b=(await call('save',{type:'need',record:{participationId:participation.id,
  direction:'A',targetDate:'2026-12-03',targetTime:'17:00',
  origin:'Brest',destination:'Rennes'}})).item;
 const first=await createNative(1,a,'outbound-1');
 const second=await createNative(2,b,'outbound-2');
 for(const c of [first,second]){
  const result=await callNative('submit',{token:c.created.body.links[0].token,
   answers:[{personId:'P-001',A:c.n2,A2:c.n1}]});
  assert.equal(result.status,200,JSON.stringify(result.body));
 }
 const choices=(await call('list',{type:'choice'})).items;
 assert.equal(choices.length,2,'each ride has a separate choice');
 assert.equal(new Set(choices.map(c=>c.needId)).size,2);
 assert.ok(choices.every(c=>c.firstOptionId&&c.backupOptionId));
 const after=await call('sync_native_choices');
 assert.equal(after.linked,2);
 assert.equal(after.synced,0);
 assert.equal((await call('list',{type:'booking'})).items.length,0);
});
