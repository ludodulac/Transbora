import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_KEY,readHistory,registerHistory,forgetHistory,parseOwnerLink,ownerUrl} from '../site/event-history.mjs';
const event={title:'Spectacle Saint-Brieuc',destination:'Saint-Brieuc',
  startDate:'2026-11-29',endDate:'2026-12-01'};
const id='abcdef123456abcdef123456abcdef12',ownerKey='abcd9876543210abcd9876543210abce';
const fake=()=>{
 const map=new Map();return {
  getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,val),
  removeItem:key=>map.delete(key),dump:()=>map
 };
};
test('event dossiers persist and can be reopened after a fresh page',()=>{
 const storage=fake();
 assert.equal(registerHistory(storage,{eventId:id,ownerKey,event,peopleCount:7},10),true);
 assert.ok(storage.dump().has(HISTORY_KEY));
 const nextVisit=readHistory(storage);
 assert.equal(nextVisit[0].title,'Spectacle Saint-Brieuc');
 assert.equal(nextVisit[0].peopleCount,7);
 assert.equal(nextVisit[0].ownerKey,ownerKey);
 assert.equal(registerHistory(storage,{eventId:id,ownerKey,event,peopleCount:7},20),true);
 assert.equal(readHistory(storage).length,1,'Opening a folder again never duplicates it');
 assert.equal(readHistory(storage)[0].createdAt,10);
});
test('new browser draft is separate from persistent saved folders',()=>{
 const storage=fake();
 registerHistory(storage,{eventId:id,ownerKey,event});
 storage.setItem('transbora_event_draft_v013','old-draft');
 storage.removeItem('transbora_event_draft_v013');
 assert.equal(readHistory(storage).length,1);
});
test('do not list forged, cross-domain or malformed owner links',()=>{
 const origin='https://transbora-ludo.netlify.app';
 const link=ownerUrl(id,ownerKey,origin+'/mes-evenements.html');
 assert.deepEqual(parseOwnerLink(link,origin),{eventId:id,ownerKey});
 assert.equal(parseOwnerLink('https://evil.example/suivi.html#event='+id+'&key='+ownerKey,origin),null);
 assert.equal(parseOwnerLink(origin+'/choix.html#event='+id+'&key='+ownerKey,origin),null);
 assert.equal(parseOwnerLink(origin+'/suivi.html#event=missing&key=bad',origin),null);
});
test('explicit server deletion removes only the matching local record',()=>{
 const storage=fake();
 const second='1234567890abcdef1234567890abcdef';
 registerHistory(storage,{eventId:id,ownerKey,event});
 registerHistory(storage,{eventId:second,ownerKey,event});
 assert.equal(forgetHistory(storage,id),true);
 assert.equal(readHistory(storage).length,1);
 assert.equal(readHistory(storage)[0].eventId,second);
});
test('history records never expire locally just because event ended',()=>{
 const storage=fake();
 registerHistory(storage,{eventId:id,ownerKey,event},1);
 assert.equal(readHistory(storage).length,1);
});
