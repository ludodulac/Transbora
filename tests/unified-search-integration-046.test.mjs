import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {readSearchHandoff,writeSearchResults} from '../site/organizer-bridge.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('046: real organizer event opens its same person registry inline; results automatically update that event',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html?ntl-drawer-state=hidden',
  pretendToBeVisual:true
 });
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Only local demo can be used.');};
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const sophie=(await api('save',{type:'person',record:{name:'Sophie Martin',departure:'Paris'}})).item;
 const michel=(await api('save',{type:'person',record:{name:'Michel Petit',departure:'Brest'}})).item;
 const event=(await api('save',{type:'event',record:{title:'Festival Mulhouse',
  startDate:'2026-10-31',destination:'Mulhouse',budgetCents:10000}})).item;
 const participation=(await api('save',{type:'participation',record:{
  eventId:event.id,personId:sophie.id
 }})).item;
 await api('save',{type:'participation',record:{eventId:event.id,personId:michel.id}});
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,80));
 const $=id=>w.document.getElementById(id);
 const button=[...$('events-output').querySelectorAll('button')].find(x=>
  x.textContent.includes('Trouver les trajets'));
 assert.ok(button);
 button.click();
 assert.equal($('panel-search').hidden,false);
 assert.equal($('search-select-area').hidden,true,
   'The selected event should not be requested a second time');
 const handoff=readSearchHandoff(w.localStorage);
 assert.equal(handoff.eventId,event.id);
 assert.deepEqual(handoff.travelers.map(x=>x.personId),[sophie.id,michel.id]);
 assert.ok($('search-frame').getAttribute('src').includes('embedded=1'));
 const previousSrc=$('search-frame').getAttribute('src');
 $('tabs').querySelector('[data-tab=people]').click();
 $('tabs').querySelector('[data-tab=search]').click();
 assert.equal($('search-frame').getAttribute('src'),previousSrc,
  'Switching tabs must not destroy existing research');
 const row={personId:sophie.id,direction:'R',travelDate:'2026-11-01',
  sourceKey:'046-test-return-train',estimatedCents:null,
  legs:[{from:'Mulhouse',to:'Paris',departure:'16:30',arrival:'19:30',
   departureDate:'2026-11-01',arrivalDate:'2026-11-01',
   mode:'rail',operator:'SNCF'}]};
 writeSearchResults(w.localStorage,{eventId:event.id,rows:[row]});
 w.dispatchEvent(new w.MessageEvent('message',{
  origin:w.location.origin,source:$('search-frame').contentWindow,
  data:{type:'transbora:routes-ready',eventId:event.id}
 }));
 await new Promise(r=>setTimeout(r,80));
 const options=(await api('list',{type:'option'})).items;
 const imported=options.find(x=>x.sourceKey==='046-test-return-train');
 assert.ok(imported,'The returned timetable must be in the same organizer event');
 assert.equal(imported.estimatedCents,null);
 assert.equal(imported.direction,'R');
 assert.equal(imported.participationId,participation.id);
 assert.equal($('panel-search').hidden,false,'Search must remain available for link sharing');
 assert.match($('search-context').textContent,/enregistrés dans cet événement/);
 w.close();
});
