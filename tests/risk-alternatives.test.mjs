import test from 'node:test';
import assert from 'node:assert/strict';
import {findConnections,enumerate,dayNum,stationRecord,knownRiskyInterstation} from '../site/connections.mjs';
import {planEvent} from '../site/event-planner.mjs';
import {riskDetails} from '../site/risk-details.mjs';
import {optionLabel} from '../site/google-forms-export.mjs';

const day='2026-11-03';
const source={id:'sncf',label:'SNCF Voyageurs',mode:'rail'};
const stations=[
  ['BRE','Brest',48.39,-4.48],
  ['MON','Paris Montparnasse Hall 1 - 2',48.84,2.32],
  ['LYO','Paris Gare de Lyon',48.84,2.37],
  ['LPA','Lyon Part-Dieu',45.76,4.86]
];
const trip=(number,from,departure,to,arrival)=>[0,'TGV','',number,
  [[from,departure,departure,1,0],[to,arrival,arrival,0,1]]];
const feed=(names=stations,departure=57120)=>({source,data:{
  meta:{first:day,last:day,timezone:'Europe/Paris'},stations:names,
  services:[Buffer.from([255]).toString('base64')],
  trips:[trip('7612',0,40500,1,54000),trip('6621',2,departure,3,64800)]
}});
const query={from:'Brest',to:'Lyon',date:day,earliest:'00:00',latest:'23:59'};
const cautious={profile:'very_cautious',officialRules:new Map(),limit:20};
const event={title:'Spectacle',destination:'Lyon',startDate:day,startTime:'20:00',
  endDate:day,endTime:'23:00',arrivalMargin:120,departureMargin:60,
  includeOutward:true,includeReturn:false};
const participant={id:'P-001',first:'Test',last:'Martin',departure:'Brest'};
const settings={mode:'rail',buffer:'very_cautious',connections:'auto',maxOptions:5};

test('strict default never suggests a 52-minute Paris station change',()=>{
  assert.deepEqual(findConnections([feed()],query,cautious),[]);
});
test('explicit opt-in retains the real timetable and marks the station-change risk',()=>{
  const f=feed(),v={...f,rules:new Map()};
  const pairs=enumerate(v,query,0,86399,dayNum(day));
  console.log('RISK DEBUG',JSON.stringify({initial:pairs.initial.map(x=>[x.to,x.arrival]),final:pairs.final.map(x=>[x.from,x.departure]),known:knownRiskyInterstation(stationRecord(v,1),stationRecord(v,2))}));
  const routes=findConnections([feed()],query,{...cautious,allowRiskyInterstation:true});
  assert.equal(routes.length,1);
  const route=routes[0],transfer=route.transfer;
  assert.equal(route.riskAlternative,true);
  assert.equal(transfer.riskType,'paris_interstation');
  assert.equal(transfer.waitingSeconds,52*60);
  assert.equal(transfer.minimumSeconds,90*60);
  assert.equal(transfer.station,'Paris Montparnasse Hall 1 - 2');
  assert.equal(transfer.departureStation,'Paris Gare de Lyon');
  const risks=riskDetails({...route,date:day},day);
  assert.equal(risks.length,1);
  assert.match(risks[0].lines.join(' '),/7612/);
  assert.match(risks[0].lines.join(' '),/6621/);
  assert.match(risks[0].lines.join(' '),/15:00/);
  assert.match(risks[0].lines.join(' '),/15:52/);
  assert.match(risks[0].lines.join(' '),/Il manque 38 min/);
  const label=optionLabel({...route,date:day},day,1);
  assert.match(label,/ALTERNATIVE À RISQUE/);
  assert.match(label,/52 min/);
  assert.match(label,/non officiel/);
});
test('event planner: risk options only with explicit opt-in and still marked',async()=>{
  const without=(await planEvent(event,[participant],[feed()],settings)).plans.get(participant.id);
  assert.equal(without.outward.length,0);
  const withRisk=(await planEvent(event,[participant],[feed()],
    {...settings,allowRiskyInterstation:true})).plans.get(participant.id);
  assert.equal(withRisk.outward.length,1);
  assert.equal(withRisk.outward[0].riskAlternative,true);
  assert.equal(withRisk.outward[0].arrival,64800);
});
test('unknown Paris station pairs are NOT guessed as walking connections',()=>{
  const altered=stations.map(s=>[...s]);
  altered[2][1]='Paris Gare du Nord';
  const routes=findConnections([feed(altered)],query,{...cautious,allowRiskyInterstation:true});
  assert.equal(routes.length,0);
});
test('transfers under 30 minutes stay excluded even in risk mode',()=>{
  const routes=findConnections([feed(stations,55140)],query,
    {...cautious,allowRiskyInterstation:true});
  assert.equal(routes.length,0);
});
