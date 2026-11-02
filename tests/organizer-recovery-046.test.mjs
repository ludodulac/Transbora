import test from 'node:test';
import assert from 'node:assert/strict';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';
import {validateRehearsalBackup} from '../site/organizer-recovery.mjs';
const fakeStore=()=>{
 const values=new Map();
 return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),
  removeItem:k=>values.delete(k)};
};
test('046: all saved people, events and relationships recover on another preview browser origin',async()=>{
 const old=fakeStore(),api=createRehearsalApi(old);
 const before=await api('export_backup');
 const newer=fakeStore(),second=createRehearsalApi(newer);
 const result=await second('restore_demo_backup',{backup:before});
 assert.deepEqual(result,{restored:true,persons:2,events:1});
 const after=await second('export_backup');
 for(const kind of ['person','event','participation','option','choice','booking','note']){
  assert.equal(after[kind].length,before[kind].length);
  assert.deepEqual(after[kind].map(x=>x.id),before[kind].map(x=>x.id));
 }
 const report=await second('event_budget',{eventId:'festival-demo'});
 assert.equal(report.budgetCents,75000);
});
test('046: malicious extra fields, owner capability and invented money are not restored',async()=>{
 const first=fakeStore(),api=createRehearsalApi(first);
 const backup=await api('export_backup');
 backup.person[0].ownerKey='private-owner-key';
 backup.option[0].paidCents=999999;
 backup.credential='top-secret';
 const restored=validateRehearsalBackup(backup);
 assert.ok(!JSON.stringify(restored).includes('private-owner-key'));
 assert.ok(!JSON.stringify(restored).includes('top-secret'));
 assert.ok(!('paidCents' in restored.option[0]));
});
test('046: invalid or orphaned backup cannot overwrite existing demo',async()=>{
 const store=fakeStore(),api=createRehearsalApi(store);
 const backup=await api('export_backup');
 const invalid=structuredClone(backup);
 invalid.participation[0].personId='invented';
 await assert.rejects(api('restore_demo_backup',{backup:invalid}),/orpheline/);
 assert.equal((await api('list',{type:'person'})).items.length,2);
 const invalidMoney=structuredClone(backup);
 invalidMoney.event[0].budgetCents=-20;
 assert.throws(()=>validateRehearsalBackup(invalidMoney),/Événement invalide/);
});
