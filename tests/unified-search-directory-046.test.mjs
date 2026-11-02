import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';
import {createSearchHandoff,readSearchHandoff} from '../site/organizer-bridge.mjs';

test('046: search participant dropdown uses saved person, stable ID and event participation',async()=>{
 const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/events.html?from_organizer=1&embedded=1',
  pretendToBeVisual:true
 });
 const w=dom.window;
 w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.localStorage=w.localStorage;
 globalThis.sessionStorage=w.sessionStorage;
 Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
 globalThis.confirm=()=>true;
 const api=createRehearsalApi(w.localStorage);
 const saved=await api('save',{type:'person',record:{
  name:'Claire Dubois',departure:'Lorient',
  reductionCards:'Carte Avantage',preferences:'Voyage tôt'
 }});
 createSearchHandoff(w.localStorage,{
  event:{id:'festival-demo',title:'Festival exemple — données fictives',
   startDate:'2026-10-31',destination:'Mulhouse'},
  people:(await api('list',{type:'person'})).items,
  participations:(await api('list',{type:'participation'})).items
 });
 globalThis.fetch=async url=>{
  if(String(url).includes('manifest.json'))return {ok:true,json:async()=>({
   sources:[{id:'sncf',status:'ok',label:'SNCF'}]
  })};
  if(String(url).includes('stations.json'))return {ok:true,json:async()=>['Mulhouse','Lorient']};
  throw Error('Unexpected fetch '+url);
 };
 await import('../site/events-app.mjs');
 await new Promise(r=>setTimeout(r,60));
 const $=id=>w.document.getElementById(id);
 assert.equal($('manual-person').hidden,true);
 assert.equal($('event-title').readOnly,true);
 assert.equal($('event-start-date').readOnly,true);
 assert.equal($('participants-total').textContent,'2');
 $('directory-person-find').value='Claire Dubois · Lorient';
 $('add-directory-person').click();
 await new Promise(r=>setTimeout(r,50));
 assert.equal($('participants-total').textContent,'3');
 assert.match($('participants-list').textContent,/Claire Dubois/);
 assert.match($('participants-list').textContent,/Carte Avantage/);
 const members=(await api('list',{type:'participation'})).items;
 assert.ok(members.some(x=>x.personId===saved.item.id&&x.eventId==='festival-demo'));
 assert.ok(readSearchHandoff(w.localStorage).travelers.some(x=>x.personId===saved.item.id));
 assert.equal((await api('list',{type:'person'})).items.find(x=>x.id===saved.item.id).departure,
  'Lorient','The original profile must remain unchanged');
 w.close();
});
