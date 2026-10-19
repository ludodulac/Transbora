import test from 'node:test';
import assert from 'node:assert/strict';
import {canBeDirect,canBeOneChange} from '../site/route-topology.mjs';

const date='2026-11-29';
const stops=[
  ['BRE','Brest',48.3904,-4.4861],
  ['REN','Rennes',48.1034,-1.672],
  ['LEM','Le Mans',47.9956,0.1921],
  ['PAR','Paris',48.8449,2.3734],
  ['SBR','Saint-Brieuc',48.51,-2.766]
];
function feed(legs,source='sncf'){
 return {
  source:{id:source,mode:'rail',label:source},
  data:{meta:{first:date,last:'2026-12-05',timezone:'Europe/Paris'},
   stations:stops,services:[Buffer.from([255,255]).toString('base64')],
   trips:legs.map(([a,b],i)=>[0,'TER','','train-'+i,
     [[a,8*3600,8*3600,1,0],[b,10*3600,10*3600,0,1]]])}
 };
}
const cfg={mode:'rail'};
test('direct topology finds same-train arrival even when stations are intermediate',()=>{
 const direct=feed([[0,3]]);
 assert.equal(canBeDirect([direct],'Brest','Paris',cfg),true);
 assert.equal(canBeDirect([direct],'Brest','Saint-Brieuc',cfg),false);
});
test('one-change topology detects station joining two scheduled train legs',()=>{
 const f=feed([[0,1],[1,3]]);
 assert.equal(canBeDirect([f],'Brest','Paris',cfg),false);
 assert.equal(canBeOneChange([f],'Brest','Paris',cfg),true);
});
test('two changes are necessary: direct and one-change tiers can be skipped without dates',()=>{
 const f=feed([[0,1],[1,2],[2,3]]);
 assert.equal(canBeDirect([f],'Brest','Paris',cfg),false);
 assert.equal(canBeOneChange([f],'Brest','Paris',cfg),false);
});
test('valid cross-feed interchanges sharing nearby coordinates are not pruned',()=>{
 const a=feed([[0,1]],'local');
 const b=feed([[1,3]],'express');
 assert.equal(canBeOneChange([a,b],'Brest','Paris',cfg),true);
});
