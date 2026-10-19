import test from 'node:test';
import assert from 'node:assert/strict';
import {saveDraft,restoreDraft,eraseDraft,DRAFT_KEY,draftFields} from '../site/event-draft.mjs';

function storage(){
 const map=new Map();
 return {
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,value),
  removeItem:key=>map.delete(key)
 };
}
test('event and participants survive page reload without credentials or server storage',()=>{
 const store=storage();
 const fields=Object.fromEntries(draftFields.map(id=>[id,'']));
 fields['event-title']='Spectacle de test';
 fields['event-destination']='Paris';
 fields['event-start-date']='2026-11-25';
 fields['include-outward']=true;
 fields['include-return']=false;
 const people=[{id:'P-001',first:'Sophie',last:'Martin',departure:'Bordeaux',
   outwardDate:'',returnDate:'',notes:'test'}];
 assert.equal(saveDraft(store,{fields,participants:people,step:3,ownerKey:'DO_NOT_STORE'},1000000),true);
 const restored=restoreDraft(store,1000100);
 assert.equal(restored.step,3);
 assert.equal(restored.fields['event-start-date'],'2026-11-25');
 assert.equal(restored.fields['include-return'],false);
 assert.equal(restored.participants[0].first,'Sophie');
 const raw=store.getItem(DRAFT_KEY);
 assert.ok(!raw.includes('DO_NOT_STORE'));
 assert.ok(!raw.includes('plans'));
 assert.ok(!raw.includes('ownerKey'));
});
test('draft expires in seven days and can be explicitly deleted',()=>{
 const store=storage();
 saveDraft(store,{fields:{},participants:[],step:4},0);
 assert.equal(restoreDraft(store,7*86400000+1000),null);
 saveDraft(store,{fields:{},participants:[],step:4},7*86400000+2000);
 assert.equal(restoreDraft(store,7*86400000+3000).step,3);
 assert.equal(eraseDraft(store),true);
 assert.equal(restoreDraft(store,7*86400000+3000),null);
});
