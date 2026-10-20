import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planEvent,practicalReturnScore,selectPracticalReturn} from '../site/event-planner.mjs';
import {serviceDescription} from '../site/journey-display.mjs';
import {parisInstant} from '../site/time-zones.mjs';

const day='2026-10-31';
const clock=str=>{const [h,m]=str.split(':').map(Number);return 3600*h+60*m;};
const direct=(id,dep,arr)=>({
  id,key:id,date:day,departure:clock(dep),arrival:clock(arr),
  from:'Paris Montparnasse',to:'Nantes',provider:'SNCF',mode:'rail',
  route:'411A',number:id,changes:0
});
const routes=[
  direct('SLOW-0712','07:12','11:09'),
  direct('FAST-0744','07:44','09:59'),
  direct('FAST-0748','07:48','09:54'),
  direct('DUP-0939-A','09:39','11:54'),
  direct('DUP-0939-B','09:39','11:54'),
  direct('LATE-1000','10:00','12:20')
];
const deadline=+parisInstant(day,0);

test('return after late show favors 07:48 to 09:54 over much slower 07:12 to 11:09',()=>{
  assert.ok(practicalReturnScore(routes[2],deadline)<practicalReturnScore(routes[0],deadline));
  const shortlisted=selectPracticalReturn(routes,{deadline,maximum:5});
  assert.equal(shortlisted[0].id,'FAST-0748');
  assert.ok(shortlisted.some(j=>j.id==='SLOW-0712'));
  assert.ok(shortlisted.every(j=>+parisInstant(j.date,j.departure)>=deadline));
});
test('diversify five returns before repeating identical timetable, retain distinct trains when space exists',()=>{
  const five=selectPracticalReturn(routes,{deadline,maximum:5});
  assert.equal(five.length,5);
  assert.equal(five.filter(j=>j.departure===clock('09:39')).length,1);
  const six=selectPracticalReturn(routes,{deadline,maximum:6});
  assert.equal(six.filter(j=>j.departure===clock('09:39')).length,2);
});
test('integrated return planning keeps midnight margin, chooses shorter daytime train first',async()=>{
  const source={id:'sncf',label:'SNCF Voyageurs',mode:'rail'};
  const stops=[['PAR','Paris Montparnasse',48.84,2.32],['NAN','Nantes',47.22,-1.55]];
  const trips=routes.map(j=>[0,'TGV','',j.number,[
    [0,j.departure,j.departure,1,0],[1,j.arrival,j.arrival,0,1]
  ]]);
  const feed={source,data:{meta:{first:'2026-10-29',last:'2026-11-02',timezone:'Europe/Paris'},
    stations:stops,services:[Buffer.from([255]).toString('base64')],trips}};
  const event={title:'Spectacle',destination:'Paris',startDate:'2026-10-30',
    startTime:'20:00',endDate:'2026-10-30',endTime:'23:00',
    arrivalMargin:60,departureMargin:60,includeOutward:false,includeReturn:true};
  const person={id:'P-001',first:'Test',last:'Martin',departure:'Nantes'};
  const settings={mode:'rail',buffer:'very_cautious',connections:'auto',maxOptions:5};
  const result=await planEvent(event,[person],[feed],settings);
  const back=result.plans.get(person.id).returning;
  assert.equal(back.length,5);
  assert.equal(back[0].departure,clock('07:48'));
  assert.ok(back.every(j=>+parisInstant(j.date,j.departure)>=+parisInstant(day,0)));
  assert.equal(back.filter(j=>j.departure===clock('09:39')).length,1);
});
test('GTFS line code 411A is explicitly labeled, never claimed as a train number',()=>{
  const label=serviceDescription({mode:'rail',route:'411A',provider:'SNCF Voyageurs'});
  assert.match(label,/code de ligne 411A/);
  assert.match(label,/numéro non renseigné/);
  assert.doesNotMatch(label,/n° 411A/);
  assert.match(serviceDescription({mode:'rail',route:'TGV',number:'8604'}),/n° 8604/);
});
test('wizard has correct red/orange, yellow/green, blue/indigo, violet colors',()=>{
  const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../site/events.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../site/events-app.mjs',import.meta.url),'utf8');
  assert.match(html,/id="wizard-shell" data-step="1"/);
  assert.match(js,/dataset\.step=String\(activeStep\)/);
  for(const selector of [
    '#etape-1 .wizard-fields>label','#etape-1 .journey-selection',
    '#etape-2 .wizard-manual','#etape-2 .people-list',
    '#etape-3 .screen-heading h1','#etape-3>.settings-fold',
    '#etape-4 .native-setup','#reply-screen .reply-panel'
  ])assert.ok(css.includes(selector),selector+' missing');
  assert.match(css,/#wizard-shell\[data-step="4"\]/);
});
