import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvent,compareMultimodalJourneys} from '../site/event-planner.mjs';

const date='2026-11-25';
const event={title:'Spectacle',destination:'Paris',startDate:date,startTime:'16:00',
  endDate:date,endTime:'19:00',arrivalMargin:60,departureMargin:60,
  includeOutward:false,includeReturn:true};
const person={id:'P-001',first:'Camille',last:'Martin',departure:'Brest',
  outwardDate:'',returnDate:date};
const stations=[['PAR','Paris',48.8449,2.3734],
  ['REN','Rennes',48.1034,-1.672],['BRE','Brest',48.3904,-4.4861]];
const service=Buffer.from([255]).toString('base64');
function feed(id,mode,routes){
  return {source:{id,label:mode==='rail'?'SNCF Voyageurs':'Autocar Test',mode},
    data:{meta:{first:'2026-11-24',last:'2026-11-27',timezone:'Europe/Paris'},
      stations,services:[service],
      trips:routes.map(([a,b,start,end],i)=>[0,mode==='rail'?'TGV':'Bus','',String(i+1),
        [[a,start,start,1,0],[b,end,end,0,1]]])}};
}
const coaches=feed('coach','bus',[
  [0,2,20*3600,29*3600+25*60],
  [0,2,20*3600+15*60,29*3600+40*60],
  [0,2,20*3600+30*60,29*3600+55*60]
]);
const railDirect=feed('sncf','rail',[[0,2,20*3600+45*60,25*3600]]);
const railWithChange=feed('sncf','rail',[
  [0,1,20*3600+30*60,22*3600],
  [1,2,22*3600+50*60,25*3600+10*60]
]);
const settings={mode:'all',connections:'auto',buffer:'very_cautious',maxOptions:3};
async function choices(feeds,mode='all'){
  const r=await planEvent(event,[person],feeds,{...settings,mode});
  return r.plans.get(person.id).returning;
}
test('Train + bus still proposes fast rail against three direct coaches of 9h25',async()=>{
  const rail=await choices([coaches,railDirect],'rail');
  const both=await choices([coaches,railDirect],'all');
  assert.equal(rail[0].mode,'rail');
  assert.equal(both.length,3);
  assert.equal(both[0].mode,'rail');
  assert.ok(both.some(j=>j.providerId==='sncf'));
});
test('Direct coach cannot hide a faster TRAIN with one valid change',async()=>{
  const rail=await choices([coaches,railWithChange],'rail');
  const both=await choices([coaches,railWithChange],'all');
  assert.ok(rail.some(j=>j.changes===1));
  assert.ok(both.some(j=>j.changes===1&&j.legs.every(l=>l.mode==='rail')));
  assert.ok(both.some(j=>j.mode==='bus'));
});
test('Train-only filtering continues to exclude every bus',async()=>{
  const rail=await choices([coaches,railDirect],'rail');
  assert.ok(rail.length>0&&rail.every(j=>j.mode==='rail'));
});
test('Mixed mode keeps travel-date boundary and never assumes a seat or a price',async()=>{
  const r=await planEvent(event,[person],[coaches,railDirect],settings);
  const choices=r.plans.get(person.id).returning;
  assert.ok(choices.every(j=>j.departure>=20*3600));
  assert.ok(choices.every(j=>!('price' in j)&&!('availableSeats' in j)));
});
test('A slightly later but much shorter journey outranks a 9h25 coach',()=>{
  const coach={date,departure:20*3600,arrival:29*3600+25*60,transfers:[]};
  const train={date,departure:20*3600+45*60,arrival:25*3600,transfers:[]};
  const boundary=Date.parse(date+'T19:00:00Z')+3600000;
  assert.ok(compareMultimodalJourneys(train,coach,'R',boundary)<0);
});
