import test from 'node:test';
import assert from 'node:assert/strict';
import {registerNativeLink,nativeLinkFor,planNativeAnswers,NATIVE_LINKS_KEY}
  from '../site/organizer-replies-bridge.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';
const memory=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k)};
};
const event={id:'festival-demo',title:'Festival exemple — données fictives',
 destination:'Mulhouse',startDate:'2026-10-31'};
const nativeEventId='native-event-abcdefghijklmnopqrstuvwxyz';
const entry={
 organizerHandoff:{eventId:event.id,title:event.title,destination:event.destination,
   startDate:event.startDate,travelers:[
     {personId:'sophie-demo',name:'Sophie (exemple)'}]},
 nativeEventId,
 participants:[{id:'P-001',organizerPersonId:'sophie-demo'}],
 plans:new Map([['P-001',{outward:[],returning:[]}]]),
 choicePeople:[{id:'P-001',options:{A:[{id:'sncf-A-1',label:'Train test'}],R:[]}}],
 routes:{rows:[{personId:'sophie-demo',direction:'A',
  nativeOptionId:'sncf-A-1',sourceKey:'stable-source-key-1'}]}
};
const importedRows=[{personId:'sophie-demo',direction:'A',travelDate:'2026-10-31',
 sourceKey:'stable-source-key-1',estimatedCents:null,
 legs:[{from:'Paris Gare de Lyon',to:'Mulhouse',
  departureDate:'2026-10-31',arrivalDate:'2026-10-31',
  departure:'09:22',arrival:'12:21',mode:'rail',operator:'SNCF'}]}];
const report=(answer='sncf-A-1')=>({
 event:{title:event.title,destination:event.destination,startDate:event.startDate,
  endDate:'2026-11-01',startTime:'10:00',endTime:'20:00'},
 people:[{id:'P-001',first:'Sophie',last:'(exemple)',
  options:{A:[{id:'sncf-A-1',label:'Train test'}],R:[]},
  answer:answer===null?null:{A:answer,A2:null,R:null,R2:null,updatedAt:1},
  booking:{A:null,R:null}}]
});
test('045: native link keeps no owner key, token, personal contacts, or prices',()=>{
 const s=memory(),link=registerNativeLink(s,entry);
 assert.equal(nativeLinkFor(s,event.id).nativeEventId,nativeEventId);
 assert.equal(link.travelers[0].options.A[0].sourceKey,'stable-source-key-1');
 const raw=s.getItem(NATIVE_LINKS_KEY);
 for(const secret of ['ownerKey','secret','password','token','email','phone','paidCents'])
  assert.ok(!raw.includes(secret),'Unexpected secret '+secret);
 assert.equal(link.travelers.length,1);
});
test('045: native reply sync is atomic, idempotent and creates no paid ticket',async()=>{
 const s=memory(),api=createRehearsalApi(s);
 const mapping=registerNativeLink(s,entry);
 await api('import_search_results',{eventId:event.id,rows:importedRows});
 const one=await api('sync_native_answers',{mapping,report:report()});
 assert.equal(one.synced,1);
 assert.equal(one.pending,0);
 const options=(await api('list',{type:'option'})).items;
 const sourceOption=options.find(o=>o.sourceKey==='stable-source-key-1');
 const chosen=(await api('list',{type:'choice'})).items.find(c=>c.direction==='A');
 assert.equal(chosen.firstOptionId,sourceOption.id);
 assert.equal(chosen.origin,'native');
 assert.equal(chosen.nativeEventId,nativeEventId);
 assert.equal((await api('list',{type:'booking'})).items.length,0);
 const twice=await api('sync_native_answers',{mapping,report:report()});
 assert.equal(twice.synced,0);
 assert.equal(twice.unchanged,1);
 const changed=await api('sync_native_answers',{mapping,report:report('NONE')});
 assert.equal(changed.synced,1);
 assert.equal(changed.none,1);
 assert.equal((await api('list',{type:'choice'})).items.find(x=>x.direction==='A').firstOptionId,'NONE');
});
test('045: no silent overwrite of local manual choices or paid tickets',async()=>{
 const s=memory(),api=createRehearsalApi(s);
 const mapping=registerNativeLink(s,entry);
 await api('import_search_results',{eventId:event.id,rows:importedRows});
 const old=(await api('list',{type:'option'})).items.find(o=>o.sourceKey==='stable-source-key-1');
 await api('save',{type:'choice',record:{participationId:'ps-demo',direction:'A',
  firstOptionId:'opt2-demo',backupOptionId:null}});
 const result=await api('sync_native_answers',{mapping,report:report()});
 assert.equal(result.synced,0);
 assert.equal(result.conflicts.length,1);
 const choice=(await api('list',{type:'choice'})).items.find(c=>c.direction==='A');
 assert.equal(choice.firstOptionId,'opt2-demo');
 assert.equal(old.estimatedCents,null);
});
test('045: unknown native options, wrong event and conflicting source keys are rejected',async()=>{
 const s=memory(),api=createRehearsalApi(s);
 const mapping=registerNativeLink(s,entry);
 await api('import_search_results',{eventId:event.id,rows:importedRows});
 const bogus=report('unknown-option');
 const invalid=await api('sync_native_answers',{mapping,report:bogus});
 assert.equal(invalid.synced,0);
 assert.equal(invalid.conflicts.length,1);
 const wrong=report();wrong.event.title='Autre spectacle';
 await assert.rejects(api('sync_native_answers',{mapping,report:wrong}),/ne correspond pas/);
 const bad=structuredClone(mapping);bad.travelers[0].options.A[0].sourceKey='unmatched';
 const noMatch=await api('sync_native_answers',{mapping:bad,report:report()});
 assert.equal(noMatch.synced,0);
 assert.equal(noMatch.conflicts.length,1);
});
test('045: paid native status is counted but NEVER imported as an actual paid amount',async()=>{
 const s=memory(),api=createRehearsalApi(s);
 const mapping=registerNativeLink(s,entry);
 await api('import_search_results',{eventId:event.id,rows:importedRows});
 const r=report();r.people[0].booking.A={optionId:'sncf-A-1',bookedAt:12345};
 const result=await api('sync_native_answers',{mapping,report:r});
 assert.equal(result.synced,1);
 assert.equal(result.paidStatusNotImported,1);
 assert.deepEqual((await api('list',{type:'booking'})).items,[]);
});
