import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvent} from '../site/event-planner.mjs';
import {serviceDescription,serviceSummary,sameClockOptions} from '../site/journey-display.mjs';
import {riskDetails} from '../site/risk-details.mjs';
import {optionLabel} from '../site/google-forms-export.mjs';

const date='2026-10-27';
const event={title:'Concert',destination:'Nantes',startDate:date,startTime:'18:30',
  endDate:date,endTime:'22:00',arrivalMargin:60,departureMargin:60,
  includeOutward:true,includeReturn:false};
const person={id:'P-001',first:'Test',last:'Martin',departure:'Bordeaux',
  outwardDate:'',returnDate:''};
const stations=[['BOD','Bordeaux Saint-Jean',44.83,-0.55],
  ['POI','Poitiers',46.58,0.34],['NAN','Nantes',47.22,-1.55]];
const trip=(id,a,b,dep,arr)=>[0,'Train','',id,
  [[a,dep,dep,1,0],[b,arr,arr,0,1]]];
const source={id:'sncf',label:'SNCF Voyageurs',mode:'rail'};
const feed={source,data:{meta:{first:'2026-10-25',last:'2026-10-29',timezone:'Europe/Paris'},
  stations,services:[Buffer.from([255]).toString('base64')],
  trips:[
    trip('DIRECT-MORNING',0,2,9*3600,13*3600+30*60),
    trip('DIRECT-LATE',0,2,18*3600+6*60,22*3600+16*60),
    trip('SAFE-1',0,1,11*3600+58*60,13*3600+20*60),
    trip('SAFE-2',1,2,14*3600+15*60,16*3600+10*60),
    trip('SHORT-1',0,1,12*3600+50*60,14*3600+10*60),
    trip('SHORT-2',1,2,14*3600+35*60,16*3600+40*60)
  ]}};
const settings={mode:'rail',connections:'auto',buffer:'very_cautious',maxOptions:5};

test('safe same-day change beats a direct that would require arriving the previous day',async()=>{
  const result=await planEvent(event,[person],[feed],settings);
  const options=result.plans.get(person.id).outward;
  assert.ok(options.some(x=>x.date===date&&x.changes===1),'Expected a safe change on event day');
  assert.equal(options[0].date,date);
  assert.equal(options[0].arrival,16*3600+10*60);
  assert.equal(options[0].changes,1);
  assert.ok(options.filter(x=>x.changes===1).every(x=>
    (x.transfer?.waitingSeconds||0)>=45*60),
    'Every proposed connection must respect the 45-minute very cautious buffer');
  assert.equal(options.some(x=>x.marginReduced),false);
});

test('manual journey day stays strict even if previous-day directs exist',async()=>{
  const p={...person,outwardDate:'2026-10-26'};
  const results=(await planEvent(event,[p],[feed],settings)).plans.get(p.id).outward;
  assert.ok(results.length>0);
  assert.ok(results.every(x=>x.date==='2026-10-26'));
});

test('same departure and arrival does not imply same train',()=>{
  const first={date,departure:36000,arrival:43200,from:'Nantes',to:'Paris',
    number:'12472',provider:'SNCF Voyageurs',route:'TGV INOUI',mode:'rail'};
  const second={...first,id:'second',number:'8922'};
  assert.equal(sameClockOptions(first,second),true);
  assert.match(serviceSummary(first),/12472/);
  assert.match(serviceSummary(second),/8922/);
  assert.match(optionLabel(second,date,2),/8922/);
  assert.match(serviceDescription({...first,number:''}),/numéro non renseigné/);
  assert.doesNotMatch(serviceDescription({...first,number:''}),/n° 12472/);
});

test('52min high risk differs from 157min unverified station change',()=>{
  const base={riskAlternative:true,date:'2026-11-03',
    legs:[{provider:'SNCF Voyageurs',route:'OUIGO',number:'7612',
      mode:'rail',arrival:15*3600},
      {provider:'SNCF Voyageurs',route:'TGV INOUI',number:'6621',
        mode:'rail',departure:15*3600+52*60}]};
  const transfer={riskType:'paris_interstation',station:'Paris Montparnasse',
    departureStation:'Paris Gare de Lyon',waitingSeconds:52*60,minimumSeconds:90*60};
  const high=riskDetails({...base,transfer},base.date)[0];
  assert.equal(high.severity,'high');
  assert.match(high.shortTitle,/très serrée/);
  assert.match(high.lines.join(' '),/Il manque 38 min/);
  assert.match(high.lines.join(' '),/7612/);
  const long=riskDetails({...base,transfer:{...transfer,waitingSeconds:157*60}},base.date)[0];
  assert.equal(long.severity,'unverified');
  assert.match(long.shortTitle,/non vérifié/);
  assert.match(long.lines.join(' '),/Marge supérieure de 67 min/);
  assert.doesNotMatch(long.lines.join(' '),/Il manque 38 min/);
});
