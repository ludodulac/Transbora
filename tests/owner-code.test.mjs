import test from 'node:test';
import assert from 'node:assert/strict';
import {savedOwnerCode,rememberOwnerCode,forgetOwnerCode,OWNER_CODE_KEY} from '../site/owner-code.mjs';

function fakeStorage(){
  const data=new Map();
  return {getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,val),
    removeItem:key=>data.delete(key),dump:()=>Object.fromEntries(data)};
}
test('single owner code is remembered across browser visits without placing it in public code',()=>{
 const storage=fakeStorage();
 assert.equal(savedOwnerCode(storage),'');
 assert.equal(rememberOwnerCode(storage,'one-time-secret'),true);
 assert.equal(savedOwnerCode(storage),'one-time-secret');
 assert.deepEqual(Object.keys(storage.dump()),[OWNER_CODE_KEY]);
 assert.equal(forgetOwnerCode(storage),true);
 assert.equal(savedOwnerCode(storage),'');
});
test('invalid or missing credentials never get persisted',()=>{
 const storage=fakeStorage();
 assert.equal(rememberOwnerCode(storage,''),false);
 assert.equal(rememberOwnerCode(storage,'a'.repeat(161)),false);
 assert.equal(savedOwnerCode(storage),'');
 assert.equal(savedOwnerCode({getItem(){throw Error('private browsing');}}),'');
});
