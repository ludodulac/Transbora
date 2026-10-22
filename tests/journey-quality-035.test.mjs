import test from 'node:test';
import assert from 'node:assert/strict';
import {curateJourneys} from '../site/journey-quality.mjs';
import {stationPair} from '../site/traveler-stations.mjs';

const trip=(key,date,departure,arrival,mode)=>({
  key,date,departure,arrival,mode,legs:[{mode,from:'Brest',to:'Mulhouse'}]
});
test('long coach filler suggestions pruned, but one alternative transport kept',()=>{
 const routes=[
  trip('train','2026-10-30',11*3600,24*3600+22*60,'rail'), // 13h22
  trip('coachA','2026-10-30',10*3600,30*3600,'bus'), // 20h
  trip('coachB','2026-10-30',9*3600,30*3600,'bus'), // 21h
  trip('coachC','2026-10-30',8*3600,29*3600,'bus') // 21h
 ];
 const chosen=curateJourneys(routes,'A');
 assert.equal(chosen.length,2);
 assert.equal(chosen[0].key,'train');
 assert.equal(chosen[1].key,'coachA');
});
test('first return remains earliest arrival; shorter train shown as second choice',()=>{
 const routes=[
  trip('overnight','2026-10-31',23*3600+5*60,42*3600+14*60,'bus'),
  trip('coach2','2026-10-31',22*3600+45*60,42*3600+14*60,'bus'),
  trip('coach3','2026-10-31',22*3600+45*60,44*3600+11*60,'bus'),
  trip('train','2026-11-01',7*3600+52*60,20*3600+35*60,'rail')
 ];
 const out=curateJourneys(routes,'R');
 assert.deepEqual(out.map(x=>x.key),['overnight','train']);
 assert.equal(out[1].efficientAlternative,true);
});
test('older dossiers infer customized return stations from saved route labels',()=>{
 const p={departure:'Brest',options:{
  A:[{id:'1',label:'Option 1 | 🚆 Train | 10:00 | Départ : Brest | Arrivée : Mulhouse | Direct'}],
  R:[{id:'2',label:'Option 1 | 🚆 Train | 10:00 | Départ : Mulhouse | Arrivée : Cahors | Direct'}]
 }};
 assert.deepEqual(stationPair(p,'R','Mulhouse'),{from:'Mulhouse',to:'Cahors'});
});
