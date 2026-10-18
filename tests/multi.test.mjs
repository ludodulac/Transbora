import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesStop,searchFeed,proposalText} from '../site/search-multi.mjs';

const dataset={
  meta:{first:'2026-11-24',last:'2026-11-26'},
  stations:[['L','Gare de Lorient'],['P','Paris Montparnasse'],['X','Paris Porte de Maillot']],
  services:['BQ==','Ag=='],
  trips:[
    [0,'TGV','Paris','123',[[0,28800,28800,1,0],[1,39600,39600,0,1]]],
    [1,'Bus','Paris','456',[[0,36000,36000,1,0],[2,46800,46800,0,1]]],
    [0,'Night','Paris','999',[[0,90000,90000,1,0],[1,99000,99000,0,1]]],
    [0,'NoPickup','','888',[[0,42000,42000,0,0],[1,50000,50000,0,1]]]
  ]
};
const source={id:'test',label:'Opérateur test',mode:'rail'};
test('accent and stop words match, not arbitrary substrings',()=>{
  assert.equal(matchesStop('Gare de Lorient','Lorient'),true);
  assert.equal(matchesStop('Échirolles','Echirolles'),true);
  assert.equal(matchesStop('Montparnasse','par'),false);
  assert.equal(matchesStop('Paris Montparnasse','Paris'),true);
});
test('date/calendar exceptions, midnight, pickup flags',()=>{
  const q={from:'Lorient',to:'Paris',date:'2026-11-25',earliest:'00:00',latest:'23:59'};
  const matches=searchFeed(dataset,q,source);
  assert.deepEqual(matches.map(j=>j.number),['999','456']);
  assert.equal(matches[0].departure,3600);
  assert.equal(matches[0].from,'Gare de Lorient');
  assert.equal(matches[1].to,'Paris Porte de Maillot');
  assert.equal(searchFeed(dataset,{...q,date:'2027-01-01'},source).length,0);
  assert.equal(searchFeed(dataset,{...q,earliest:'12:00'},source).length,0);
});
test('proposal always cites operator, exact stop and source caveat',()=>{
  const journey=searchFeed(dataset,{from:'Lorient',to:'Paris',date:'2026-11-24'},source)[0];
  const proposal=proposalText([journey],{from:'Lorient',to:'Paris',date:'2026-11-24'});
  assert.match(proposal,/Opérateur test/);
  assert.match(proposal,/Gare de Lorient/);
  assert.match(proposal,/Vérifier les horaires/);
});
