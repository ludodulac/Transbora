import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftToParis,gtfsMidnightUtc,parisDate,parisTime} from '../site/time-zones.mjs';
import {searchFeed} from '../site/search-multi.mjs';

const date='2026-11-25';
test('Paris GTFS agency time is unchanged in reference clock',()=>{
  assert.equal(shiftToParis(date,date,'Europe/Paris'),0);
  assert.equal(parisTime(date,8*3600),'08:00');
  assert.equal(parisDate(date,86400),'26/11/2026');
});
test('UTC feed times convert correctly to winter and summer Paris hours',()=>{
  assert.equal(shiftToParis(date,date,'UTC'),3600);
  assert.equal(shiftToParis('2026-07-01','2026-07-01','UTC'),7200);
  assert.equal(shiftToParis(date,date,'Europe/Brussels'),0);
});
test('cross-date conversion compares actual instants, not just wall clock',()=>{
  const france=gtfsMidnightUtc('2026-10-25','Europe/Paris');
  const utc=gtfsMidnightUtc('2026-10-25','UTC');
  assert.equal((utc-france)/60000,60); // noon-12 GTFS DST-change-day reference
  assert.equal(gtfsMidnightUtc('2026-10-25','Europe/Paris')-gtfsMidnightUtc('2026-10-24','Europe/Paris'),25*3600*1000);
});
test('the direct search also converts an agency-UTC departure to Paris time',()=>{
  const data={meta:{first:date,last:date,timezone:'UTC'},
    stations:[['a','Lorient'],['b','Paris']],
    services:['AQ=='],
    trips:[[0,'TGV','','101',[[0,28800,28800,1,0],[1,39600,39600,0,1]]]]};
  const journeys=searchFeed(data,{from:'Lorient',to:'Paris',date,
    earliest:'00:00',latest:'23:59'}, {id:'utc',label:'UTC Rail',mode:'rail'});
  assert.equal(journeys.length,1);
  assert.equal(parisTime(date,journeys[0].departure),'09:00');
  assert.equal(parisTime(date,journeys[0].arrival),'12:00');
});
