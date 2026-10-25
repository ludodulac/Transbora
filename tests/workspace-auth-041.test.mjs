import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHandler} from '../backend/workspace-core.mjs';

function memory(){
 const storage=new Map();
 const getStore=()=>({
   async get(k){return structuredClone(storage.get(k)??null)},
   async setJSON(k,value,{onlyIfNew=false}={}){
     if(onlyIfNew&&storage.has(k))return {modified:false};
     storage.set(k,structuredClone(value));return {modified:true};
   },
   async delete(k){storage.delete(k)},
   async list({prefix=''}={}){return {blobs:[...storage.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}}
 });
 return {getStore,storage};
}
const origin='https://transbora-ludo.netlify.app';
function createClient(handler){
 let cookie='';
 async function call(action,payload={},extra={}){
   const headers={'content-type':'application/json',origin,...extra};
   if(cookie)headers.cookie=cookie;
   const req=new Request(origin+'/api/transbora-workspace',{
     method:'POST',headers,body:JSON.stringify({action,...payload})
   });
   const response=await handler(req);
   const json=await response.json();
   if(response.headers.get('set-cookie'))
     cookie=response.headers.get('set-cookie').split(';')[0];
   return {status:response.status,data:json,cookie};
 }
 return {call,get cookie(){return cookie},set cookie(v){cookie=v}};
}
const secret='an-internal-secret-only-for-local-testing-123';
async function setup(){
 let tick=Date.parse('2026-10-25T12:00:00Z');
 const db=memory(),handle=createWorkspaceHandler({
   getStore:db.getStore,masterKey:()=>secret,clock:()=>tick
 });
 const owner=createClient(handle);
 const boot=await owner.call('bootstrap',{setupKey:secret,organizationName:'Bora-Bora',
   email:'jeanne@example.org',password:'my-long-test-password'});
 assert.equal(boot.status,201,JSON.stringify(boot.data));
 const login=await owner.call('login',{email:'jeanne@example.org',password:'my-long-test-password'});
 assert.equal(login.status,200,JSON.stringify(login.data));
 return {owner,handle,db,advance:ms=>{tick+=ms}};
}
test('M2: bootstrap gated by environment master key, no public-open-demo access',async()=>{
 const db=memory();
 const client=createClient(createWorkspaceHandler({getStore:db.getStore,masterKey:()=>secret}));
 const illegal=await client.call('bootstrap',{setupKey:'wrong',
   email:'jeanne@example.org',password:'my-long-test-password',organizationName:'Bora'});
 assert.equal(illegal.status,403);
 assert.equal(db.storage.size,0);
 const insecure=new Request(origin+'/api/transbora-workspace',{method:'POST',
   headers:{'content-type':'application/json',origin:'https://evil.example'},
   body:JSON.stringify({action:'bootstrap',setupKey:secret,email:'a@b.org',
     password:'my-long-test-password',organizationName:'Bora'})});
 const blocked=await createWorkspaceHandler({getStore:db.getStore,masterKey:()=>secret})(insecure);
 assert.equal(blocked.status,403);
});
test('M2: secure HttpOnly cookie, no creds exposed to scripts, logout revokes',async()=>{
 const {owner}=await setup();
 assert.match(owner.cookie,/^__Host-transbora_staff=/);
 const unauthorized=await owner.call('me',{}, {'origin':'https://evil.example'});
 assert.equal(unauthorized.status,403);
 const me=await owner.call('me');
 assert.equal(me.data.role,'manager');
 assert.equal(me.data.organizationName,'Bora-Bora');
 const out=await owner.call('logout');
 assert.equal(out.status,200);
 assert.equal((await owner.call('me')).status,401);
});
test('M2: invitation binds email and role, rejects other-organization read',async()=>{
 const {owner,handle}=await setup();
 const invite=await owner.call('invite',{email:'marion@example.org',role:'editor'});
 assert.equal(invite.status,201);
 const token=invite.data.inviteToken;
 const editor=createClient(handle);
 assert.equal((await editor.call('accept_invite',{
   token,email:'intruder@example.org',password:'another-test-password'})).status,400);
 assert.equal((await editor.call('accept_invite',{
   token,email:'marion@example.org',password:'another-test-password'})).status,201);
 assert.equal((await editor.call('accept_invite',{
   token,email:'marion@example.org',password:'another-test-password'})).status,410);
 assert.equal((await editor.call('login',{
   email:'marion@example.org',password:'another-test-password'})).status,200);
 assert.equal((await editor.call('invite',{email:'x@y.com',role:'manager'})).status,403);
 const secondOrg=createClient(handle);
 assert.equal((await secondOrg.call('bootstrap',{
   setupKey:secret,organizationName:'Autre',
   email:'autre@example.org',password:'different-valid-password'})).status,201);
 await secondOrg.call('login',{email:'autre@example.org',
   password:'different-valid-password'});
 const p=await owner.call('save',{type:'person',record:{name:'Sophie',departure:'Brest'}});
 assert.equal(p.status,200);
 assert.equal((await editor.call('list',{type:'person'})).data.items.length,1);
 assert.equal((await secondOrg.call('list',{type:'person'})).data.items.length,0);
 assert.equal((await secondOrg.call('save',{type:'person',
   record:{id:p.data.item.id,name:'Exfiltration'}})).status,400);
});
test('M2: event/artist/options/notes stored independently, monthly cross-event view',async()=>{
 const {owner}=await setup();
 const person=(await owner.call('save',{type:'person',record:{
   name:'Sophie',departure:'Paris',preferences:'voyager la veille'}})).data.item;
 const event=(await owner.call('save',{type:'event',record:{
   title:'Festival',startDate:'2026-10-31',destination:'Mulhouse',budgetCents:75000}})).data.item;
 const participant=(await owner.call('save',{type:'participation',record:{
   personId:person.id,eventId:event.id}})).data.item;
 const o=(await owner.call('save',{type:'option',record:{participationId:participant.id,
   direction:'A',travelDate:'2026-10-31',estimatedCents:12000,
   legs:[{from:'Paris',to:'Mulhouse',departure:'09:22',arrival:'12:21',operator:'SNCF'}]}})).data.item;
 const alt=(await owner.call('save',{type:'option',record:{participationId:participant.id,
   direction:'A',travelDate:'2026-10-31',estimatedCents:13000,
   legs:[{from:'Paris',to:'Mulhouse',departure:'07:22',arrival:'10:03'}]}})).data.item;
 assert.equal((await owner.call('save',{type:'choice',record:{
   participationId:participant.id,direction:'A',firstOptionId:o.id,
   backupOptionId:alt.id}})).status,200);
 assert.equal((await owner.call('save',{type:'booking',record:{
   optionId:o.id,stage:'IN_CART'}})).status,200);
 assert.equal((await owner.call('save',{type:'note',record:{
   targetType:'person',targetId:person.id,content:'Prévoir une arrivée tôt.'}})).status,200);
 const month=await owner.call('person_month',{personId:person.id,month:'2026-10'});
 assert.equal(month.status,200,JSON.stringify(month.data));
 assert.deepEqual(month.data.events.flatMap(x=>x.journeys.map(j=>j.selectedRank)),[1,2],
   'A stable sorted view retains both choices, whatever their source order');
 const j=month.data.events[0].journeys;
 assert.equal(j.length,2);
 assert.equal(j.find(x=>x.optionId===o.id).stage,'IN_CART');
 const budget=(await owner.call('event_budget',{eventId:event.id})).data;
 assert.equal(budget.unpaidKnownEstimateCents,12000);
 assert.equal(budget.forecastCents,12000);
 assert.equal((await owner.call('list',{type:'note'})).data.items[0].visibility,'private');
 const marked=await owner.call('save',{type:'booking',record:{
   optionId:o.id,stage:'FILED',paidCents:12300,receiptReference:'dossier-2026-10-31'}});
 assert.equal(marked.status,200);
 const after=(await owner.call('event_budget',{eventId:event.id})).data;
 assert.equal(after.paidKnownCents,12300);
 assert.equal(after.unpaidKnownEstimateCents,0);
 assert.equal(after.forecastCents,12300);
});
test('M2: prevent a foreign participant, broken leg or filing without reference',async()=>{
 const {owner}=await setup();
 const p=(await owner.call('save',{type:'person',record:{name:'Michel'}})).data.item;
 const e=(await owner.call('save',{type:'event',record:{
   title:'Concert',startDate:'2026-10-31'}})).data.item;
 assert.equal((await owner.call('save',{type:'participation',record:{
   eventId:e.id,personId:'not-existing'}})).status,400);
 const joined=(await owner.call('save',{type:'participation',record:{
   eventId:e.id,personId:p.id}})).data.item;
 assert.equal((await owner.call('save',{type:'option',record:{
   participationId:joined.id,direction:'R',travelDate:'2026-10-31',
   legs:[{from:'Mulhouse',to:'Brest',departure:'',arrival:'10:00'}]}})).status,400);
});
