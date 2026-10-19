import test from 'node:test';
import assert from 'node:assert/strict';
import {createChoiceHandler} from '../backend/choice-core.mjs';

test('visitor can create in enabled demo mode with IP quota',async()=>{
  const maps=new Map();
  const getStore=name=>{
    if(!maps.has(name))maps.set(name,new Map());
    const data=maps.get(name);
    return {get:async key=>data.get(key)||null,
      setJSON:async(key,v)=>data.set(key,v),delete:async key=>data.delete(key)};
  };
  const serve=createChoiceHandler({getStore,masterKey:()=>'',demoMode:()=>true,
    clientIp:()=> 'testing-phone',clock:()=>Date.parse('2026-10-19T09:00:00Z')});
  const input={action:'create',mode:'individual',
    event:{title:'Test',destination:'Paris',startDate:'2026-11-25',startTime:'12:00',
      endDate:'2026-11-25',endTime:'20:00'},
    people:[{id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',
      options:{A:[{id:'1',label:'Test itinerary'}],R:[]}}]};
  const call=async origin=>{
    const res=await serve(new Request('https://test.example/api/transbora',{
      method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(input)}));
    return res.status;
  };
  assert.equal(await call('https://unrelated.example'),403);
  for(let i=0;i<5;i++)assert.equal(await call('https://test.example'),201);
  assert.equal(await call('https://test.example'),429);
});
