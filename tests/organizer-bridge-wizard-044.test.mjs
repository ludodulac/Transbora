import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createSearchHandoff} from '../site/organizer-bridge.mjs';

test('044: event search opens prefilled from organizer but never guesses presence time or price',async()=>{
 const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://transbora-ludo.netlify.app/events.html?from_organizer=1',
  pretendToBeVisual:true
 });
 const w=dom.window;w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.localStorage=w.localStorage;globalThis.sessionStorage=w.sessionStorage;
 Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
 globalThis.confirm=()=>true;
 createSearchHandoff(w.localStorage,{
  event:{id:'festival-demo',title:'Festival exemple',startDate:'2026-10-31',
   destination:'Mulhouse'},
  people:[{id:'sophie-demo',name:'Sophie Martin',departure:'Paris Gare de Lyon',
   reductionCards:'Carte Avantage',preferences:'Train calme'}],
  participations:[{eventId:'festival-demo',personId:'sophie-demo'}]
 });
 globalThis.fetch=async url=>{
  if(String(url).includes('manifest.json'))return {ok:true,json:async()=>({
   sources:[{id:'sncf',status:'ok',label:'SNCF'}]
  })};
  if(String(url).includes('stations.json'))return {ok:true,json:async()=>['Mulhouse','Paris Gare de Lyon']};
  throw Error('Unexpected request '+url);
 };
 await import('../site/events-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,75));
 const $=id=>w.document.getElementById(id);
 assert.equal($('event-title').value,'Festival exemple');
 assert.equal($('event-destination').value,'Mulhouse');
 assert.equal($('event-start-date').value,'2026-10-31');
 assert.equal($('event-end-date').value,'2026-10-31');
 assert.equal($('event-start-time').value,'','Do not invent the show arrival hour');
 assert.equal($('event-end-time').value,'','Do not invent the departure hour');
 assert.equal($('org-search-warning').hidden,false);
 assert.equal($('participants-total').textContent,'1');
 assert.match($('participants-list').textContent,/Carte Avantage/);
 assert.equal($('send-to-organizer').hidden,true,'Cannot import results before actually searching');
 assert.match($('global-status').textContent,/Renseignez les heures réelles/);
 w.close();
});
