import test from 'node:test';
import assert from 'node:assert/strict';
const origin='https://transbora-ludo.netlify.app';
test('Production SNCF server health and sample route - no credential exposed',async()=>{
 const health=await fetch(origin+'/api/sncf/journeys',{signal:AbortSignal.timeout(12000)});
 assert.equal(health.status,200);
 const service=await health.json();
 console.log('SNCF health:',JSON.stringify(service));
 assert.equal(service.configured,true,'Netlify runtime secret is missing');
 const now='2026-10-31';
 const response=await fetch(origin+'/api/sncf/journeys',{
  method:'POST',headers:{'content-type':'application/json',origin},
  body:JSON.stringify({from:'Paris Gare de Lyon',to:'Lyon Part Dieu',
    date:now,time:'10:00',direction:'R'}),
  signal:AbortSignal.timeout(20000)
 });
 const result=await response.json();
 console.log('Live SNCF example: HTTP',response.status,
  'code',result.code||'', 'number of journeys',result.journeys?.length||0,
  'error',result.error||'');
 assert.equal(response.status,200,'SNCF proxy is not successfully querying upstream');
 assert.equal(result.source,'SNCF API');
});
