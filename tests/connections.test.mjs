import test from 'node:test';
import assert from 'node:assert/strict';
import {findConnections} from '../site/connections.mjs';

const date='2026-11-24', mask='Aw==';
const params={from:'Lorient',to:'Bordeaux',date,earliest:'06:00',latest:'23:59'};
const point=(id,name,lat,lon)=>[id,name,lat,lon];
const stations=[
  point('o','Lorient',47.755,-3.365),
  point('h','Nantes',47.2184,-1.542),
  point('d','Bordeaux Saint Jean',44.825,-0.556)
];
const times=(trip,stops)=>[0,'TER','',trip,stops];
const stop=(i,a,d=a,pickup=1,dropoff=1)=>[i,a,d,pickup,dropoff];
const A=times('A',[stop(0,28800),stop(1,32400)]);
const TOO_SHORT=times('B',[stop(1,33000),stop(2,37800)]); // 10 mins wait
const GOOD=times('C',[stop(1,35100),stop(2,39600)]);  // 45 mins wait
const LATE=times('D',[stop(1,42000),stop(2,46800)]); // > 4h wait
const data=(trips,transfers=[],overrideStations=stations)=>({
  meta:{first:date,last:'2026-11-25',timezone:'Europe/Paris'},
  stations:overrideStations,services:[mask],trips,transfers
});
const feed=(trips,sourceId='sncf',type='rail',transfers=[],overrideStations=stations,zone='Europe/Paris')=>({
  source:{id:sourceId,label:sourceId,mode:type},
  data:{...data(trips,transfers,overrideStations),
    meta:{first:date,last:'2026-11-25',timezone:zone}}
});
test('finds a genuine same-station transfer but rejects a 10-minute rush',()=>{
  const options=findConnections([feed([A,TOO_SHORT,GOOD])],params);
  assert.equal(options.length,1);
  assert.equal(options[0].legs[0].number,'A');
  assert.equal(options[0].legs[1].number,'C');
  assert.equal(options[0].transfer.waitingSeconds,2700);
  assert.equal(options[0].transfer.minimumSeconds,1800);
});
test('GTFS forbids selected transfers despite enough time',()=>{
  assert.equal(findConnections([feed([A,GOOD],'sncf','rail',[[1,1,3,0]])],params).length,0);
  assert.equal(findConnections([feed([A,GOOD],'sncf','rail',[[1,1,2,3600]])],params).length,0);
});
test('must respect boarding and alighting, and not change on same physical trip',()=>{
  const noBoard=times('N',[stop(1,35100,35100,0,1),stop(2,39600)]);
  const noAlight=times('M',[stop(0,28800),stop(1,32400,32400,1,0)]);
  const through=times('THROUGH',[stop(0,28800),stop(1,32400),stop(2,39600)]);
  assert.equal(findConnections([feed([A,noBoard,noAlight])],params).length,0);
  assert.equal(findConnections([feed([through])],params).length,0);
});
test('different Paris stations are not interchangeable',()=>{
  const distant=[stations[0],point('h','Nantes (other station)',47.23,-1.60),stations[2]];
  const result=findConnections([feed([A],'sncf'),feed([GOOD],'trenitalia','rail',[],distant)],params);
  assert.equal(result.length,0);
});
test('only geolocated same-zone cross-carrier transfers are allowed',()=>{
  const close=[stations[0],point('x','Nantes TGV',47.2185,-1.542),stations[2]];
  assert.equal(findConnections([feed([A]),feed([GOOD],'trenitalia','rail',[],close)],params).length,1);
  assert.equal(findConnections([feed([A]),feed([GOOD],'trenitalia','rail',[],close,'Europe/London')],params).length,1); // London GTFS time is converted to Paris before matching
  assert.equal(findConnections([feed([A]),feed([GOOD],'trenitalia','rail',[],[
    stations[0],point('x','Nantes TGV',null,null),stations[2]])],params).length,0);
});
test('coach changes require a longer buffer than rail-to-rail',()=>{
  const coachAt55=times('BUS',[stop(1,35700),stop(2,40500)]); // 55 minutes
  const coachAt65=times('BUS2',[stop(1,36300),stop(2,41100)]); // 65 minutes
  const common=[stations[0],point('h2','Nantes station routière',47.2184,-1.542),stations[2]];
  const result=findConnections([feed([A]),feed([coachAt55,coachAt65],'flixbus','bus',[],common)],params);
  assert.deepEqual(result.map(j=>j.legs[1].number),['BUS2']);
  assert.equal(result[0].transfer.minimumSeconds,3600);
});
test('next-day service is used for overnight changes; service calendar matters',()=>{
  const nightA=times('N1',[stop(0,82800),stop(1,84600)]); // 23:00 -> 23:30
  const nightB=times('N2',[stop(1,1800),stop(2,7200)]);   // 00:30 next day
  const nextDayFeed=feed([nightA], 'sncf');
  const secondFeed=feed([nightB], 'trenitalia');
  secondFeed.data.services=['Ag==']; // only 25 Nov
  const q={...params,earliest:'22:00',latest:'23:59'};
  assert.equal(findConnections([nextDayFeed,secondFeed],q).length,1);
  secondFeed.data.services=['AQ==']; // only 24 Nov
  assert.equal(findConnections([nextDayFeed,secondFeed],q).length,0);
});
test('Eurostar incoming journeys receive extra security/check-in buffer',()=>{
  const eurostar=times('EU',[stop(1,36000),stop(2,43200)]); // 60min wait
  const result=findConnections([feed([A]),feed([eurostar],'eurostar')],params);
  assert.equal(result.length,0);
});
