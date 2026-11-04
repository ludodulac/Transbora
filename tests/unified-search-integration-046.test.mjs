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
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,80));
 const $=id=>w.document.getElementById(id);
 const button=[...$('events-output').querySelectorAll('button')].find(x=>
  x.textContent.includes('Rechercher les trajets'));
 assert.ok(button);
 button.click();
 assert.equal($('panel-search').hidden,false);
 const handoff=readSearchHandoff(w.localStorage);
 assert.equal(handoff.eventId,'festival-demo');
 assert.deepEqual(handoff.travelers.map(x=>x.personId),['sophie-demo','michel-demo']);
 assert.ok($('search-frame').getAttribute('src').includes('embedded=1'));
 const previousSrc=$('search-frame').getAttribute('src');
 $('tabs').querySelector('[data-tab=people]').click();
 $('tabs').querySelector('[data-tab=search]').click();
 assert.equal($('search-frame').getAttribute('src'),previousSrc,
  'Switching tabs must not destroy existing research');
 const row={personId:'sophie-demo',direction:'R',travelDate:'2026-11-01',
  sourceKey:'046-test-return-train',estimatedCents:null,
  legs:[{from:'Mulhouse',to:'Paris',departure:'16:30',arrival:'19:30',
   departureDate:'2026-11-01',arrivalDate:'2026-11-01',
   mode:'rail',operator:'SNCF'}]};
 writeSearchResults(w.localStorage,{eventId:'festival-demo',rows:[row]});
 w.dispatchEvent(new w.MessageEvent('message',{
  origin:w.location.origin,source:$('search-frame').contentWindow,
  data:{type:'transbora:routes-ready',eventId:'festival-demo'}
 }));
 await new Promise(r=>setTimeout(r,80));
 const api=createRehearsalApi(w.localStorage);
 const options=(await api('list',{type:'option'})).items;
 const imported=options.find(x=>x.sourceKey==='046-test-return-train');
 assert.ok(imported,'The returned timetable must be in the same organizer event');
 assert.equal(imported.estimatedCents,null);
 assert.equal(imported.direction,'R');
 assert.equal(imported.participationId,'ps-demo');
 assert.equal($('panel-search').hidden,false,'Search must remain available for link sharing');
 assert.match($('search-context').textContent,/enregistrés dans cet événement/);
 w.close();
});
