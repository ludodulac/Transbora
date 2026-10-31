import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi,KEY as DEMO_KEY} from '../site/organizer-rehearsal.mjs';
import {registerNativeLink} from '../site/organizer-replies-bridge.mjs';
import {registerHistory} from '../site/event-history.mjs';

test('045: organizer shows linked native dossier and explicitly refreshes choices',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 }).window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;globalThis.FormData=w.FormData;
 const api=createRehearsalApi(w.localStorage);
 await api('import_search_results',{eventId:'festival-demo',rows:[{
  personId:'sophie-demo',direction:'A',travelDate:'2026-10-31',
  sourceKey:'preview-045-route',estimatedCents:null,
  legs:[{from:'Paris',to:'Mulhouse',departureDate:'2026-10-31',
    arrivalDate:'2026-10-31',departure:'08:10',arrival:'11:20',mode:'rail'}]
 }]});
 const nativeId='native-event-0123456789abcdefghij';
 const ownerKey='owner-code-0123456789abcdefghij';
 registerNativeLink(w.localStorage,{
  organizerHandoff:{eventId:'festival-demo',
   title:'Festival exemple — données fictives',destination:'Mulhouse',
   startDate:'2026-10-31',travelers:[{personId:'sophie-demo',name:'Sophie (exemple)'}]},
  nativeEventId:nativeId,
  participants:[{id:'P-001',organizerPersonId:'sophie-demo'}],
  plans:new Map(),
  choicePeople:[{id:'P-001',options:{A:[{id:'train-1',label:'Test'}],R:[]}}],
  routes:{rows:[{personId:'sophie-demo',direction:'A',
   nativeOptionId:'train-1',sourceKey:'preview-045-route'}]}
 });
 registerHistory(w.localStorage,{
  eventId:nativeId,ownerKey,
  event:{title:'Festival exemple — données fictives',destination:'Mulhouse',
   startDate:'2026-10-31',endDate:'2026-11-01'},peopleCount:1
 });
 const network=[];
 globalThis.fetch=async(url,opts)=>{
  network.push({url,body:JSON.parse(opts?.body||'{}')});
  if(url!=='/api/transbora')throw Error('Forbidden private API '+url);
  return {ok:true,json:async()=>({
    event:{title:'Festival exemple — données fictives',destination:'Mulhouse',
      startDate:'2026-10-31'},
    people:[{id:'P-001',first:'Sophie',last:'(exemple)',
      options:{A:[{id:'train-1',label:'Test'}],R:[]},
      answer:{A:'train-1',A2:null,R:null,R2:null},
      booking:{A:null,R:null}}],links:[]
  })};
 };
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,100));
 const sync=[...w.document.querySelectorAll('button')].find(x=>
  x.textContent.includes('Récupérer les réponses'));
 assert.ok(sync,'A visible refresh button should be present for the mapped event');
 sync.click();
 await new Promise(resolve=>setTimeout(resolve,90));
 assert.equal(network.length,1);
 assert.equal(network[0].body.action,'status');
 assert.equal(network[0].body.eventId,nativeId);
 assert.equal(network[0].body.ownerKey,ownerKey);
 assert.match(w.document.getElementById('global-feedback').textContent,/1 choix mis à jour/);
 const choice=(await api('list',{type:'choice'})).items.find(c=>
   c.participationId==='ps-demo'&&c.direction==='A');
 assert.equal(choice.origin,'native');
 assert.ok(!w.localStorage.getItem(DEMO_KEY).includes(ownerKey));
 assert.ok(!w.localStorage.getItem(DEMO_KEY).includes('train-1'));
 assert.deepEqual((await api('list',{type:'booking'})).items,[]);
 w.close();
});
