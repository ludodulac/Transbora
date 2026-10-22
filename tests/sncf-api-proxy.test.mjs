import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{config} from '../netlify/functions/sncf-journeys.mjs';

test('SNCF proxy uses a secret only in server requests, resolves stations and returns journeys',async()=>{
 const before=process.env.SNCF_API_TOKEN;
 const oldFetch=globalThis.fetch;
 process.env.SNCF_API_TOKEN='private-test-key-never-front-end';
 const calls=[];
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',
   year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const compact=date.replaceAll('-','');
 globalThis.fetch=async(url,options)=>{
   calls.push({url:String(url),auth:options.headers.authorization});
   const path=new URL(url);
   if(path.pathname.endsWith('/places')){
     const q=path.searchParams.get('q');
     return Response.json({places:[{embedded_type:'stop_area',
       name:q,id:'stop_area:SNCF:'+q.replaceAll(' ','_')}]});
   }
   if(path.pathname.endsWith('/journeys'))return Response.json({journeys:[
    {departure_date_time:compact+'T200000',arrival_date_time:compact+'T220000',
      sections:[{type:'public_transport',
        departure_date_time:compact+'T200000',arrival_date_time:compact+'T220000',
        from:{name:'Toulouse Matabiau'},to:{name:'Nancy'},
        display_informations:{commercial_mode:'TGV',code:'1000'}}]}
   ]});
   throw Error('Unexpected URL');
 };
 try{
   const request=new Request('https://app.example/api/sncf/journeys',{
     method:'POST',headers:{origin:'https://app.example','content-type':'application/json'},
     body:JSON.stringify({from:'Toulouse Matabiau',to:'Nancy',date,time:'19:00',direction:'R'})
   });
   const response=await handler(request);
   assert.equal(response.status,200);
   const body=await response.json();
   assert.equal(body.journeys.length,1);
   assert.equal(body.journeys[0].legs[0].from,'Toulouse Matabiau');
   assert.equal(calls.length,3);
   assert.ok(calls.every(x=>x.auth?.startsWith('Basic ')));
   assert.ok(!JSON.stringify(body).includes('private-test-key'));
   assert.ok(config.rateLimit);
 }finally{
   globalThis.fetch=oldFetch;
   if(before===undefined)delete process.env.SNCF_API_TOKEN;
   else process.env.SNCF_API_TOKEN=before;
 }
});
test('SNCF proxy rejects cross-site calls before using third-party API',async()=>{
 const req=new Request('https://app.example/api/sncf/journeys',{method:'POST',
  headers:{origin:'https://attacker.example','content-type':'application/json'},
  body:JSON.stringify({from:'Nancy',to:'Paris',date:'2026-10-22',time:'12:00',direction:'R'})});
 const reply=await handler(req);
 assert.equal(reply.status,403);
});
