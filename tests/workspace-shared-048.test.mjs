import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHandler} from '../backend/workspace-core.mjs';
function storage(){
 const data=new Map();
 return ()=>({
  get:async k=>structuredClone(data.get(k)??null),
  setJSON:async(k,x,o={})=>{
   if(o.onlyIfNew&&data.has(k))return {modified:false};
   data.set(k,structuredClone(x));return {modified:true};
  },
  delete:async k=>data.delete(k),
  list:async({prefix=''})=>({blobs:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})
 });
}
const site='https://transbora-ludo.netlify.app';
const secret='private-setup-key-strong-1234567890';
function client(handler){
 let cookie='';
 return {async call(action,payload={}){
  const r=await handler(new Request(site+'/api/transbora-workspace',{
   method:'POST',headers:{origin:site,cookie,'content-type':'application/json'},
   body:JSON.stringify({action,...payload})
  }));
  const set=r.headers.get('set-cookie');
  if(set)cookie=set.split(';')[0];
  return {status:r.status,body:await r.json()};
 }};
}
test('048: two invited organizers see the same records, and stale editing refuses to erase a coworker change',async()=>{
 let now=Date.parse('2026-11-02T11:00:00Z');
 const handler=createWorkspaceHandler({getStore:storage(),masterKey:()=>secret,clock:()=>++now});
 const jeanne=client(handler);
 assert.equal((await jeanne.call('bootstrap',{setupKey:secret,
  organizationName:'Compagnie Jeanne',email:'jeanne@example.fr',
  password:'jeanne-long-password-123'})).status,201);
 assert.equal((await jeanne.call('login',{email:'jeanne@example.fr',
  password:'jeanne-long-password-123'})).status,200);
 const invitation=await jeanne.call('invite',{email:'alice@example.fr',role:'editor'});
 assert.equal(invitation.status,201);
 const alice=client(handler);
 assert.equal((await alice.call('accept_invite',{token:invitation.body.inviteToken,
  email:'alice@example.fr',password:'alice-long-password-123'})).status,201);
 assert.equal((await alice.call('login',{email:'alice@example.fr',
  password:'alice-long-password-123'})).status,200);
 const saved=await jeanne.call('save',{type:'person',record:{name:'Sophie',departure:'Brest'}});
 const row=saved.body.item;
 assert.equal((await alice.call('list',{type:'person'})).body.items[0].id,row.id);
 const update=await alice.call('save',{type:'person',record:{
  id:row.id,name:'Sophie',departure:'Lorient',expectedUpdatedAt:row.updatedAt
 }});
 assert.equal(update.status,200,JSON.stringify(update.body));
 assert.equal((await jeanne.call('save',{type:'person',record:{
  id:row.id,name:'Sophie',departure:'Rennes',expectedUpdatedAt:row.updatedAt
 }})).status,409);
 assert.equal((await jeanne.call('list',{type:'person'})).body.items[0].departure,'Lorient');
 const event=(await jeanne.call('save',{type:'event',record:{
  title:'Concert',startDate:'2026-11-20',destination:'Nantes'
 }})).body.item;
 assert.equal((await alice.call('list',{type:'event'})).body.items[0].id,event.id);
 const joined=await alice.call('save',{type:'participation',record:{
  personId:row.id,eventId:event.id
 }});
 assert.equal(joined.status,200);
 assert.equal((await jeanne.call('list',{type:'participation'})).body.items.length,1);
});
