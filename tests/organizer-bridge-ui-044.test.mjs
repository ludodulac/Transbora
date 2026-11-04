import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {writeSearchResults} from '../site/organizer-bridge.mjs';

test('044: organizer demo receives real search proposals, without contacting private API',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://transbora-ludo.netlify.app/organisation.html?import_search=1',
  pretendToBeVisual:true});
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;
 globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('The rehearsal must not call the private backend.');};
 writeSearchResults(w.localStorage,{
  eventId:'festival-demo',rows:[{
    personId:'sophie-demo',direction:'A',travelDate:'2026-10-31',
    sourceKey:'test-sncf-2026-10-31-09:22',estimatedCents:null,
    legs:[{from:'Paris Gare de Lyon',to:'Mulhouse',
      departureDate:'2026-10-31',arrivalDate:'2026-10-31',
      departure:'09:22',arrival:'12:21',mode:'rail',operator:'SNCF'}]
  }]
 });
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,100));
 const $=id=>w.document.getElementById(id);
 assert.equal($('private-panel').hidden,false);
 assert.equal($('login-panel').hidden,true);
 assert.equal($('panel-travels').hidden,false);
 assert.match($('journeys-output').textContent,/SNCF/);
 assert.match($('journeys-output').textContent,/Montant inconnu/);
 assert.match($('global-feedback').textContent,/1 trajet\(s\) ajouté\(s\)/);
 assert.equal(w.localStorage.getItem('transbora_demo_search_results_044'),null);
 assert.equal(w.location.search,'');
 assert.ok(w.document.querySelector('button.item-action'));
 w.close();
});
