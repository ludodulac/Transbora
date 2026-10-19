import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvent} from '../site/event-planner.mjs';
const event={title:'Festival',destination:'Paris',startDate:'2026-11-25',startTime:'14:00',
 endDate:'2026-11-25',endTime:'18:00',arrivalMargin:60,departureMargin:60,includeOutward:true,includeReturn:true};
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',outwardDate:'',returnDate:''};
const feed={source:{id:'sncf',label:'SNCF',mode:'rail'},data:{
 meta:{first:'2026-10-01',last:'2027-03-01',timezone:'Europe/Paris'},
 stations:[['Brest','Brest'],['Paris','Paris']],services:['fw=='],trips:[]}};
const setting={mode:'rail',connections:'no',buffer:'prudent',maxOptions:3};
test('time-bounded search exits promptly and flags incomplete instead of falsely saying no trains',async()=>{
 const result=await planEvent(event,[person],[feed],setting,new Map(),()=>{},
   {maxDurationMs:-1,maxDirectionMs:-1});
 assert.equal(result.partial,true);
 assert.ok(result.issues.some(x=>/partielle|incomplète/.test(x)));
 assert.ok(result.plans.has('P-001'));
});
test('unknown origin terminates quickly without scanning all dates',async()=>{
 const p={...person,departure:'Atlantide'};
 const result=await planEvent(event,[p],[feed],setting,new Map(),()=>{},
   {maxDurationMs:10000,maxDirectionMs:10000});
 assert.equal(result.partial,false);
 assert.ok(result.issues.some(x=>/gare ou ville absente/i.test(x)));
 assert.equal(result.plans.get('P-001').outward.length,0);
});

test('different carrier feeds can cover the origin and destination without premature rejection',async()=>{
 const from={...feed,data:{...feed.data,
   stations:[['Brest','Brest']]}};
 const to={source:{id:'bus',label:'Bus',mode:'bus'},data:{...feed.data,
   stations:[['Paris','Paris']]}};
 const p={...person,outwardDate:'2026-11-25'};
 const onlyOut={...event,includeReturn:false};
 const res=await planEvent(onlyOut,[p],[from,to],{...setting,mode:'all'},
   new Map(),()=>{},{maxDurationMs:10000,maxDirectionMs:10000});
 assert.ok(!res.issues.some(x=>/gare ou ville absente/i.test(x)));
});
