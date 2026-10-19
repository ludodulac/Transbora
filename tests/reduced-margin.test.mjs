import test from 'node:test';
import assert from 'node:assert/strict';
import {planEvent} from '../site/event-planner.mjs';
import {optionLabel} from '../site/google-forms-export.mjs';
import {buildChoicePeople} from '../site/native-choices.mjs';
const day='2026-11-25';
const f={source:{id:'sncf',label:'SNCF Voyageurs',mode:'rail'},data:{
  meta:{first:'2026-11-24',last:'2026-11-26',timezone:'Europe/Paris'},
  stations:[['BRE','Brest'],['PAR','Paris']],
  services:[Buffer.from([255]).toString('base64')],
  trips:[
    [0,'TGV','','101',[[0,32400,32400,1,0],[1,52800,52800,0,1]]],
    [0,'TGV','','102',[[0,36000,36000,1,0],[1,54300,54300,0,1]]],
    [0,'TGV','','103',[[0,39600,39600,1,0],[1,54900,54900,0,1]]],
    [0,'TGV','','104',[[0,43200,43200,1,0],[1,56100,56100,0,1]]],
    [0,'TGV','','201',[[1,69900,69900,1,0],[0,86400,86400,0,1]]],
    [0,'TGV','','202',[[1,71100,71100,1,0],[0,88200,88200,0,1]]],
    [0,'TGV','','203',[[1,72300,72300,1,0],[0,90000,90000,0,1]]]
  ]}};
const e={title:'Concert',destination:'Paris',startDate:day,startTime:'16:00',
  endDate:day,endTime:'19:00',arrivalMargin:60,departureMargin:60,
  includeOutward:true,includeReturn:true};
const p={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',outwardDate:day,returnDate:day};
const c={mode:'rail',connections:'auto',buffer:'very_cautious',maxOptions:3};
async function run(allowReducedMargin,event=e){
  return (await planEvent(event,[p],[f],{...c,allowReducedMargin})).plans.get(p.id);
}
test('ordinary mode respects the requested 60-minute margin without exceptions',async()=>{
  const a=await run(false);
  assert.ok(a.outward.every(j=>j.arrival<=54000));
  assert.ok(a.returning.every(j=>j.departure>=72000));
  assert.ok(![...a.outward,...a.returning].some(j=>j.marginReduced));
});
test('optional 55-minute arrival is clearly marked for organizer and artist',async()=>{
  const a=await run(true),j=a.outward.find(j=>j.marginReduced);
  assert.ok(j);assert.equal(j.actualMarginMinutes,55);
  assert.equal(j.requestedMarginMinutes,60);
  assert.ok(!a.outward[0].marginReduced);
  assert.match(optionLabel(j,day,2),/Marge réduite : 55 min au lieu de 60 min/);
  const people=buildChoicePeople(e,[p],new Map([[p.id,a]]));
  assert.ok(people[0].options.A.some(x=>x.label.includes('⚠ Marge réduite')));
});
test('optional 45-minute return is accepted, but 25-minute return is excluded',async()=>{
  const a=await run(true);
  assert.ok(a.returning.some(j=>j.marginReduced&&j.actualMarginMinutes===45));
  assert.ok(a.returning.every(j=>j.departure>=70200));
  assert.ok(a.outward.every(j=>j.arrival<=55800));
});
test('a requested margin of 30 minutes is never loosened',async()=>{
  const a=await run(true,{...e,arrivalMargin:30,departureMargin:30});
  assert.ok(![...a.outward,...a.returning].some(j=>j.marginReduced));
});
