import test from 'node:test';
import assert from 'node:assert/strict';
import {findTwoChanges} from '../site/connections-two.mjs';
import {findConnections,officialIndex,assessTransfer} from '../site/connections.mjs';
import {proposalText} from '../site/search-multi.mjs';

const DATE='2026-11-24';
const stops=[
 ['StopArea:OCE11111111','Lorient',47.75,-3.36],
 ['StopArea:OCE22222222','Rennes',48.11,-1.68],
 ['StopArea:OCE33333333','Le Mans',48.01,0.19],
 ['StopArea:OCE44444444','Strasbourg',48.58,7.73],
];
const leg=(number,indices,times)=>{
  const events=indices.map((index,i)=>[index,times[i],times[i],i===0?1:0,i===indices.length-1?1:0]);
  return [0,'TGV','',number,events];
};
const A=leg('101',[0,1],[28800,32400]);
const B=leg('202',[1,2],[35700,41400]);
const SHORT_B=leg('222',[1,2],[33000,39600]);
const C=leg('303',[2,3],[45000,50400]);
const base=(trips,transfers=[])=>[{
  source:{id:'sncf',label:'SNCF Voyageurs',mode:'rail'},
  data:{meta:{first:DATE,last:'2026-11-25',timezone:'Europe/Paris'},
    stations:stops,services:['Aw=='],trips,transfers}
}];
const q={from:'Lorient',to:'Strasbourg',date:DATE,earliest:'06:00',latest:'23:59'};
test('two safe real train changes produce exact 3 legs and 2 waits',()=>{
  const choices=findTwoChanges(base([A,B,C]),q,{profile:'very_cautious'});
  assert.equal(choices.length,1);
  assert.equal(choices[0].legs.length,3);
  assert.deepEqual(choices[0].transfers.map(t=>t.waitingSeconds),[3300,3600]);
  const text=proposalText(choices,q);
  assert.match(text,/2 correspondance/);
  assert.match(text,/Changement 1 à Rennes/);
  assert.match(text,/Changement 2 à Le Mans/);
  assert.match(text,/n° 303/);
});
test('no false itinerary with missed train, same train or forbidden GTFS stop',()=>{
  assert.equal(findTwoChanges(base([A,SHORT_B,C]),q).length,0);
  assert.equal(findTwoChanges(base([A,B]),q).length,0);
  assert.equal(findTwoChanges(base([A,B,C],[[1,1,3,0]]),q).length,0);
});
test('official SNCF train pair -1 forbids change even if scheduled buffer is wide',()=>{
  const index=officialIndex({trainRules:[
    ['2222222','2222222','101','202',-1,'2026-01-01','2027-01-01'],
  ]});
  assert.equal(index.size,1);
  assert.equal(findTwoChanges(base([A,B,C]),q,{officialRules:index}).length,0);
  const expired=officialIndex({trainRules:[['2222222','2222222','101','202',-1,'2024-01-01','2024-12-31']]});
  assert.equal(findTwoChanges(base([A,B,C]),q,{officialRules:expired}).length,1);
});
test('uses official minimum when greater than the conservative baseline',()=>{
  const index=officialIndex({trainRules:[['2222222','2222222','101','202',60,'2026-01-01','2027-01-01']]});
  assert.equal(findTwoChanges(base([A,B,C]),q,{officialRules:index}).length,0);
  // One-change direct leg: first and second connected at Rennes.
  const simple=base([A,leg('303',[1,3],[35700,50400])]);
  const result=findConnections(simple,{...q}, {officialRules:officialIndex({trainRules:[
    ['2222222','2222222','101','303',-1,'2026-01-01','2027-01-01']
  ]})});
  assert.equal(result.length,0);
});
test('two-change search refuses transfers at different disconnected stops',()=>{
  const changed=base([A,B,C]);
  changed[0].data.stations[2]=['StopArea:OCE33333333','Le Mans distant',45,3];
  assert.equal(findTwoChanges(changed,q).length,1); // same station within same feed remains valid
  // But strict source GTFS transfer ban applies even with identical station IDs.
  changed[0].data.transfers=[[2,2,3,0]];
  assert.equal(findTwoChanges(changed,q).length,0);
});
