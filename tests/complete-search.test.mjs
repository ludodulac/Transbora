import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planEvent} from '../site/event-planner.mjs';

const date='2026-11-29',base={
 title:'Festival',destination:'Paris',startDate:date,startTime:'16:00',
 endDate:date,endTime:'19:00',arrivalMargin:60,departureMargin:60,
 includeOutward:true,includeReturn:false};
const person={id:'P-001',first:'Michel',last:'Delpech',departure:'Brest',
 outwardDate:'',returnDate:''};
function source(trips){
 return {source:{id:'sncf',label:'SNCF',mode:'rail'},
  data:{meta:{first:'2026-11-20',last:'2026-12-15',timezone:'Europe/Paris'},
   stations:[['BRE','Brest',48.39,-4.48],['REN','Rennes',48.10,-1.67],
     ['PAR','Paris',48.85,2.35]],
   services:[Buffer.alloc(4,255).toString('base64')],trips
 }};
}
function trip(id,a,b,start,end){
 return [0,'TGV','',id,[
   [a,start,start,1,0],[b,end,end,0,1]
 ]];
}
const settings={mode:'rail',connections:'auto',buffer:'prudent',maxOptions:3};
test('normal event search finishes without a deadline even if wall time advances by several minutes',async()=>{
 const original=Date.now;
 let fake=original();
 Date.now=()=>{fake+=70000;return fake;};
 try{
   // Direct trips on two consecutive dates. Always return finished results
   // instead of prematurely claiming an incomplete search.
   const result=await planEvent(base,[person],
     [source([trip('404',0,2,9*3600,14*3600)])],settings);
   assert.equal(result.partial,false);
   assert.equal(result.plans.get(person.id).outward.length>0,true);
   assert.ok(!result.issues.some(x=>/limite de temps|partielle|incomplète/i.test(x)));
 }finally{Date.now=original;}
});
test('a caller can still opt into a deadline for diagnostics, not the public UI',async()=>{
 const result=await planEvent(base,[person],
   [source([trip('404',0,2,9*3600,14*3600)])],settings,
   new Map(),()=>{},{maxDurationMs:-1});
 assert.equal(result.partial,true);
});
test('public UI has no 6/18/35 second watchdog and retains a manual cancellation button',()=>{
 const code=readFileSync(new URL('../site/events-app.mjs',import.meta.url),'utf8');
 assert.match(code,/const limits=\{\};/);
 assert.doesNotMatch(code,/maxDurationMs:\s*18000|maxDirectionMs:\s*6000/);
 assert.doesNotMatch(code,/setTimeout\(\(\)=>finish\(new Error/);
 assert.match(code,/\$\('cancel-search'\)/);
});
