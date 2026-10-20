import test from 'node:test';
import assert from 'node:assert/strict';
import {practicalOutwardScore,selectPracticalOutward,planEvent} from '../site/event-planner.mjs';
import {parisInstant} from '../site/time-zones.mjs';

const day='2026-10-27',eventDate=day;
const deadline=+parisInstant(day,17*3600+30*60);
const clock=(value)=>{const [h,m]=value.split(':').map(Number);return h*3600+m*60;};
const journey=(id,depart,arrive,changes=0,routeDate=day,details={})=>{
  const legs=changes?[{from:'Bordeaux Saint-Jean',to:'Paris Montparnasse',
    mode:'rail',number:id+'-A'},{from:'Paris Montparnasse',to:'Nantes',
    mode:'rail',number:id+'-B'}]:[{from:'Bordeaux Saint-Jean',to:'Nantes',
    mode:'rail',number:id}];
  return {id,key:id,date:routeDate,departure:clock(depart),arrival:clock(arrive),
    changes,legs,...details};
};
const direct0904=journey('DIRECT-0904','09:04','13:35');
const direct0754=journey('DIRECT-0754','07:54','12:06');
const paris1047a=journey('PARIS-1047-A','10:47','16:53',1);
const paris1047b=journey('PARIS-1047-B','10:47','16:53',1);
const paris1017=journey('PARIS-1017','10:17','16:53',1);
const spdc1158=journey('SPDC-1158','11:58','16:13',1);
const roche0904=journey('ROCHE-0904','09:04','15:54',1);
const yesterday=journey('OLD','14:00','18:29',0,'2026-10-26');

test('five realistic Bordeaux–Nantes options preserve two same-day directs and a good one-change journey',()=>{
  const candidates=[paris1047a,paris1047b,paris1017,spdc1158,
    roche0904,direct0904,direct0754,yesterday];
  const selected=selectPracticalOutward(candidates,{deadline,eventDate,maximum:5});
  assert.equal(selected.length,5);
  const keys=new Set(selected.map(x=>x.key));
  assert.ok(keys.has('DIRECT-0904'));
  assert.ok(keys.has('DIRECT-0754'));
  assert.ok(keys.has('SPDC-1158'));
  assert.equal(Number(keys.has('PARIS-1047-A'))+Number(keys.has('PARIS-1047-B')),1,
    'Same clocks should get only one of five slots when varied alternatives exist');
  assert.ok(!keys.has('OLD'),'Earlier-day arrival should never crowd out five same-day journeys');
  assert.equal(selected[0].key,'SPDC-1158');
});
test('shorter journey can rank before an unnecessarily long change near the deadline',()=>{
  assert.ok(practicalOutwardScore(spdc1158,deadline)<
    practicalOutwardScore(paris1017,deadline));
  assert.ok(practicalOutwardScore(direct0904,deadline)<
    practicalOutwardScore(roche0904,deadline));
});
test('two real trains with equal clocks remain available when choices are sparse',()=>{
  const selected=selectPracticalOutward([paris1047a,paris1047b],{
    deadline,eventDate,maximum:5});
  assert.equal(selected.length,2);
  assert.deepEqual(new Set(selected.map(j=>j.key)),new Set(['PARIS-1047-A','PARIS-1047-B']));
});
test('do not impose an early direct if only one or two choices were requested',()=>{
  const candidates=[paris1047a,spdc1158,direct0754];
  const one=selectPracticalOutward(candidates,{deadline,eventDate,maximum:1});
  assert.equal(one.length,1);
  assert.equal(one[0].key,'SPDC-1158');
  const two=selectPracticalOutward(candidates,{deadline,eventDate,maximum:2});
  assert.equal(two.length,2);
  assert.ok(two.some(j=>j.key==='DIRECT-0754'));
});
test('an earlier-day direct does not replace a safe event-day connection',()=>{
  const selected=selectPracticalOutward([yesterday,paris1047a,spdc1158],
    {deadline,eventDate,maximum:2});
  assert.equal(selected.length,2);
  assert.ok(selected.every(j=>j.date===day));
});
test('integrated automatic search preserves direct trains without relaxing correspondence margins',async()=>{
  const source={id:'sncf',label:'SNCF Voyageurs',mode:'rail'};
  const stops=[['BOD','Bordeaux',44.83,-0.55],['SPDC','Saint-Pierre-des-Corps',47.39,0.72],
    ['NAN','Nantes',47.22,-1.55]];
  const trip=(id,from,to,dep,arr)=>[0,'TGV','',id,
    [[from,clock(dep),clock(dep),1,0],[to,clock(arr),clock(arr),0,1]]];
  const feed={source,data:{meta:{first:'2026-10-26',last:'2026-10-29',timezone:'Europe/Paris'},
    stations:stops,services:[Buffer.from([255]).toString('base64')],
    trips:[
      trip('DIRECT1',0,2,'09:04','13:35'),
      trip('DIRECT2',0,2,'07:54','12:06'),
      trip('FIRST',0,1,'11:58','13:35'),
      trip('SECOND',1,2,'14:51','16:13')
    ]}};
  const event={title:'Concert',destination:'Nantes',startDate:day,startTime:'18:30',
    endDate:day,endTime:'22:00',arrivalMargin:60,departureMargin:60,
    includeOutward:true,includeReturn:false};
  const person={id:'P-1',first:'Test',last:'Voyageur',departure:'Bordeaux',
    outwardDate:'',returnDate:''};
  const settings={mode:'rail',connections:'auto',buffer:'very_cautious',maxOptions:5};
  const plan=(await planEvent(event,[person],[feed],settings)).plans.get(person.id);
  assert.ok(plan.outward.some(j=>j.changes===1),'Expected safe same-day connection');
  assert.ok(plan.outward.some(j=>j.number==='DIRECT1'));
  assert.ok(plan.outward.some(j=>j.number==='DIRECT2'));
  assert.ok(plan.outward.every(j=>j.date===day));
  assert.ok(plan.outward.every(j=>j.arrival<=clock('17:30')));
  assert.ok(plan.outward.every(j=>j.changes===0||j.transfer?.waitingSeconds>=45*60));
});
