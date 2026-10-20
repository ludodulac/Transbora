import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {planEvent,eventForPerson} from '../site/event-planner.mjs';
import {optionLabel} from '../site/google-forms-export.mjs';
import {stationSuggestions} from '../site/station-suggestions.mjs';
import {appendReadableRoute} from '../site/route-label.mjs';
import {saveDraft,restoreDraft} from '../site/event-draft.mjs';
import {searchFeed} from '../site/search-multi.mjs';

const date='2026-11-25';
const clock=(h,m=0)=>h*3600+m*60;
const event={title:'Festival',destination:'Paris',startDate:date,startTime:'18:00',
  endDate:date,endTime:'23:00',arrivalMargin:60,departureMargin:60,
  includeOutward:true,includeReturn:false};
const source={id:'sncf',label:'SNCF Voyageurs',mode:'rail'};
const stationRows=[['Brest','Brest',48.39,-4.48],['Paris','Paris',48.85,2.35],
  ['Lyon','Lyon',45.75,4.85]];
const service=Buffer.from([255]).toString('base64');
function trip(from,to,start,end,id){
  return [0,'TGV','',id,[[from,start,start,1,0],[to,end,end,0,1]]];
}
const feed={source,data:{meta:{first:'2026-11-24',last:'2026-11-27',timezone:'Europe/Paris'},
  stations:stationRows,services:[service],trips:[
    trip(0,1,clock(8),clock(12),'BRE-PAR-8'),
    trip(0,1,clock(12),clock(16),'BRE-PAR-12'),
    trip(0,2,clock(11),clock(16),'BRE-LYO-11'),
    trip(1,0,clock(21,30),clock(25,30),'PAR-BRE-2130'),
    trip(1,0,clock(23,30),clock(27,30),'PAR-BRE-2330')
  ]}};
const settings={mode:'rail',connections:'auto',buffer:'very_cautious',maxOptions:3};
const basePerson={id:'P-001',first:'Sophie',last:'Test',departure:'Brest'};
test('one event can give two artists different PRESENCE times and arrival cities',async()=>{
  const early={...basePerson,arrivalTime:'14:00'};
  const other={id:'P-002',first:'Marc',last:'Test',departure:'Brest',
    outwardDestination:'Lyon',arrivalTime:'18:00'};
  const result=await planEvent(event,[early,other],[feed],settings);
  const a=result.plans.get(early.id).outward;
  const b=result.plans.get(other.id).outward;
  assert.ok(a.length>0&&b.length>0);
  assert.equal(a[0].to,'Paris');
  assert.equal(a[0].arrival,clock(12));
  assert.equal(b[0].to,'Lyon');
  assert.equal(b[0].arrival,clock(16));
  assert.equal(event.destination,'Paris','Do not mutate shared event');
});
test('individual release times change only that traveler’s return boundary',async()=>{
  const returning={...event,includeOutward:false,includeReturn:true,
    endTime:'20:00'};
  const early={...basePerson,releaseTime:'20:00'};
  const late={id:'P-002',first:'Marc',last:'Test',departure:'Brest',releaseTime:'22:00'};
  const result=await planEvent(returning,[early,late],[feed],settings);
  const a=result.plans.get(early.id).returning;
  const b=result.plans.get(late.id).returning;
  assert.equal(a[0].departure,clock(21,30));
  assert.equal(b[0].departure,clock(23,30));
  assert.equal(returning.endTime,'20:00');
});
test('invalid per-person chronology rejected before the search',()=>{
  assert.throws(()=>eventForPerson(event,{first:'Marc',arrivalTime:'23:30',releaseTime:'20:00'}),
    /Marc/);
  assert.equal(eventForPerson(event,basePerson).startTime,'18:00');
});
test('city suggestions rank plain Paris ahead of Disneyland and station names',()=>{
  const names=['Disneyland Paris - Chessy Sud','Paris (Bercy Seine)','Paris Orly Airport',
    'Gare de Paris Montparnasse','Lyon Perrache'];
  const result=stationSuggestions(names,'Paris');
  assert.equal(result[0].value,'Paris');
  assert.equal(result[0].kind,'ville');
  assert.ok(result.some(x=>x.value==='Paris (Bercy Seine)'));
  assert.ok(result.some(x=>x.value==='Disneyland Paris - Chessy Sud'));
});
test('editable personal values survive local seven-day draft',()=>{
  const storage=new Map(),fake={
    setItem(k,v){storage.set(k,v);},getItem(k){return storage.get(k)||null;},
    removeItem(k){storage.delete(k);}
  };
  const person={...basePerson,returnOrigin:'Lyon',outwardDestination:'Paris',
    arrivalDate:'2026-11-24',arrivalTime:'14:30',releaseDate:'2026-11-26',
    releaseTime:'21:45'};
  const now=Date.parse('2026-10-20T12:00:00Z');
  assert.equal(saveDraft(fake,{fields:{},participants:[person],step:2},now),true);
  const saved=restoreDraft(fake,now).participants[0];
  for(const key of ['returnOrigin','outwardDestination','arrivalDate','arrivalTime','releaseDate','releaseTime'])
    assert.equal(saved[key],person[key]);
});
test('choice labels prioritize stops, large date/time, and bus-access warning',()=>{
  const route={date,departure:clock(23),arrival:clock(32,15),mode:'bus',
    provider:'FlixBus',route:'N702',number:'',from:'Paris Orly Airport',
    to:'Brest',changes:0};
  const label=optionLabel(route,date,1);
  assert.ok(label.length<=390);
  assert.match(label,/23:00 → 08:15/);
  assert.match(label,/Départ : Paris Orly Airport/);
  assert.match(label,/Arrivée : Brest/);
  assert.match(label,/Direct/);
  assert.match(label,/Accès à cet arrêt/);
  assert.doesNotMatch(label,/0 changement/);
  const dom=new JSDOM('<div id="box"></div>');
  globalThis.document=dom.window.document;
  const target=document.getElementById('box');
  appendReadableRoute(target,label);
  assert.match(target.querySelector('.choice-times').textContent,/23:00/);
  assert.equal(target.querySelectorAll('.choice-station').length,2);
  assert.ok(target.querySelector('.choice-warning'));
  dom.window.close();
});
test('same GTFS autocar can depart from two Paris stops: keep two boardings and same tripKey',()=>{
  const coach={meta:{first:date,last:date,timezone:'Europe/Paris'},
    stations:[['C','Paris Charles de Gaulle Airport'],['B','Paris (Bercy Seine)'],['R','Brest']],
    services:[service],trips:[[0,'N702','','',[
      [0,clock(21),clock(21),1,0],[1,clock(22),clock(22),1,1],
      [2,clock(30),clock(30),0,1]]]]};
  const options=searchFeed(coach,{date,from:'Paris',to:'Brest',earliest:'00:00',latest:'23:59'},
    {id:'flixbus',label:'FlixBus',mode:'bus'});
  assert.equal(options.length,2);
  assert.equal(options[0].tripKey,options[1].tripKey);
  assert.notEqual(options[0].from,options[1].from);
});
