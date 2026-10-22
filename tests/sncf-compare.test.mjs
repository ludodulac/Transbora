import test from 'node:test';
import assert from 'node:assert/strict';
import {officialJourney,mergeOfficialJourneys} from '../site/sncf-compare.mjs';
import {parisInstant} from '../site/time-zones.mjs';

const event={title:'Concert',destination:'Toulouse',startDate:'2026-10-30',
 startTime:'10:00',endDate:'2026-10-30',endTime:'18:00',
 arrivalMargin:60,departureMargin:60};
const journey={departure:'20261030T194500',arrival:'20261031T010000',
 legs:[
  {from:'Toulouse Matabiau',to:'Massy TGV',departure:'20261030T194500',
   arrival:'20261030T221500',route:'TGV',line:'123'},
  {from:'Massy TGV',to:'Nancy',departure:'20261030T230500',
   arrival:'20261031T010000',route:'TGV',line:'456'}
 ]};
test('SNCF alternatives have safe transfers and overnight arrival, no seat claim',()=>{
 const route=officialJourney(journey,'R',event,'very_cautious');
 assert.ok(route);
 assert.equal(route.changes,1);
 assert.equal(route.date,'2026-10-30');
 assert.equal(route.arrival,25*3600);
 assert.equal(route.transfers[0].waitingSeconds,50*60);
 assert.equal(route.officialAlternative,true);
 assert.equal('availableSeats' in route,false);
});
test('SNCF transfer across different stations or too short is rejected',()=>{
 assert.equal(officialJourney({...journey,legs:[
  {...journey.legs[0],to:'Paris Montparnasse'},
  {...journey.legs[1],from:'Paris Gare de Lyon'}
 ]},'R',event),null);
 assert.equal(officialJourney({...journey,legs:[
  {...journey.legs[0],arrival:'20261030T224500'},
  {...journey.legs[1],departure:'20261030T230500'}
 ]},'R',event),null);
});
test('SNCF never proposes travel before artist release and margin',()=>{
 const first={...journey,departure:'20261030T183000',
  legs:[{...journey.legs[0],departure:'20261030T183000'},journey.legs[1]]};
 assert.equal(officialJourney(first,'R',event),null);
});
test('earliest actual home arrival wins even if other train departs earlier',()=>{
 const slow=officialJourney({...journey,departure:'20261030T193000',
  arrival:'20261031T050000',legs:[
   {...journey.legs[0],departure:'20261030T193000'},
   {...journey.legs[1],arrival:'20261031T050000'}
 ]},'R',event);
 const fast=officialJourney(journey,'R',event);
 assert.ok(slow&&fast);
 const result=mergeOfficialJourneys([slow],[fast],'R',event,
  {first:'Michel',departure:'Nancy'},3);
 assert.equal(result[0].key,fast.key);
 assert.equal(+parisInstant(result[0].date,result[0].arrival),
  +parisInstant('2026-10-31',3600));
});

test('official API and GTFS equivalent Paris–Mulhouse direct trains are one option',()=>{
 const concert={...event,destination:'Mulhouse',startDate:'2026-10-31',
   startTime:'14:00',endDate:'2026-10-31',endTime:'20:00'};
 const official=officialJourney({
   departure:'20261031T092200',arrival:'20261031T122100',
   legs:[{from:'Paris - Gare de Lyon - Hall 1 & 2 (Paris)',to:'Mulhouse (Mulhouse)',
     departure:'20261031T092200',arrival:'20261031T122100',route:'TGV INOUI'}]
 },'A',concert);
 assert.ok(official);
 const gtfs={
   date:'2026-10-31',departure:9*3600+22*60,arrival:12*3600+21*60,
   legs:[{from:'Paris Gare de Lyon Hall 1 - 2',to:'Mulhouse',mode:'rail'}],
   changes:0,key:'gtfs-611b'
 };
 const merged=mergeOfficialJourneys([gtfs],[official],'A',concert,{departure:'Paris'},5);
 assert.equal(merged.length,1,'same exact train must not occupy both preferred slots');
 assert.equal(merged[0].officialAlternative,true);
 const otherStation={
   ...gtfs,legs:[{...gtfs.legs[0],from:'Paris Est'}],key:'independent-paris-est'
 };
 const distinct=mergeOfficialJourneys([gtfs,otherStation],[official],
   'A',concert,{departure:'Paris'},5);
 assert.equal(distinct.length,2,'different Paris departure stations cannot be silently merged');
 const bus={...gtfs,key:'different-coach',
   legs:[{from:'Paris Gare de Lyon Hall 1 - 2',to:'Mulhouse (bus station)',mode:'bus'}],
   mode:'bus'};
 const withCoach=mergeOfficialJourneys([gtfs,bus],[official],
   'A',concert,{departure:'Paris'},5);
 assert.equal(withCoach.length,2,'bus station and train options must remain separate');
});
