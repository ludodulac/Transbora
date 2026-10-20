import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvent,allOptions} from '../site/event-planner.mjs';

const date='2026-11-25';
const event={title:'Concert',destination:'Paris',startDate:date,startTime:'16:00',
  endDate:date,endTime:'19:00',arrivalMargin:60,departureMargin:60,
  includeOutward:true,includeReturn:false};
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',
  outwardDate:date,returnDate:''};
const stops=[
  ['BRE','Brest',48.3904,-4.4861],
  ['REN','Rennes',48.1034,-1.672],
  ['LEM','Le Mans',47.9956,0.1921],
  ['PAR','Paris',48.8449,2.3734]
];
const make=(name,parts)=>{
  const trips=parts.map(([from,to,start,end],i)=>
    [0,'TGV','',String(i+1),[
      [from,start,start,1,0],[to,end,end,0,1]
    ]]);
  return {source:{id:name,label:'SNCF Voyageurs',mode:'rail'},
    data:{meta:{first:'2026-11-24',last:'2026-11-27',timezone:'Europe/Paris'},
      stations:stops,services:[Buffer.from([255]).toString('base64')],trips}};
};
const settings={mode:'rail',connections:'auto',buffer:'very_cautious',maxOptions:3};
async function go(parts){
  const result=await planEvent(event,[person],[make('sncf',parts)],settings);
  return result.plans.get(person.id);
}
test('direct journey remains first, same-day safe alternatives may outrank day-before directs',async()=>{
  const result=await go([
    [0,3,9*3600,14*3600],
    [0,1,8*3600,10*3600],
    [1,3,11*3600,13*3600],
  ]);
  assert.equal(result.levels.A,'no');
  assert.ok(result.outward.length>0);
  assert.equal(result.outward[0].changes||0,0,
    'The best same-day direct should remain first when it is closer to the arrival margin');
  assert.ok(result.outward.every(x=>x.date==='2026-11-25'),
    'A safe same-day transfer must displace earlier-day departures when available');
});
test('without a direct train, an eligible one-change route is found automatically',async()=>{
  const result=await go([
    [0,1,8*3600,10*3600],
    [1,3,11*3600,13*3600]
  ]);
  assert.equal(result.levels.A,'only_one');
  assert.equal(result.outward.length>0,true);
  assert.equal(result.outward[0].changes,1);
});
test('without zero- or one-change solutions, two transfers are attempted automatically',async()=>{
  const result=await go([
    [0,1,7*3600,9*3600],
    [1,2,10*3600,11*3600],
    [2,3,12*3600,14*3600]
  ]);
  assert.equal(result.levels.A,'only_two');
  assert.equal(result.outward.length>0,true);
  assert.equal(result.outward[0].changes,2);
  assert.equal(result.outward[0].legs.length,3);
});
test('manual legacy connection limits still work for existing exports and custom API clients',()=>{
  const feeds=[make('sncf',[[0,3,9*3600,14*3600]])];
  const query={date,from:'Brest',to:'Paris',earliest:'00:00',latest:'23:59'};
  assert.equal(allOptions(feeds,query,{...settings,connections:'no'}).some(x=>(x.changes||0)===0),true);
});
