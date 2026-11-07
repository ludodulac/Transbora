import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createSearchHandoff} from '../site/organizer-bridge.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('060: saved event launches timetable search directly, without a second event form',async()=>{
 const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/events.html?from_organizer=1&embedded=1',
  pretendToBeVisual:true
 });
 const w=dom.window;
 w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.sessionStorage=w.sessionStorage;globalThis.localStorage=w.localStorage;
 Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
 globalThis.confirm=()=>true;

 createSearchHandoff(w.localStorage,{
  event:{id:'saved-event',title:'Concert test',startDate:'2026-12-15',
   startTime:'20:00',endDate:'2026-12-15',endTime:'22:00',
   arrivalLeadMinutes:60,destination:'Rennes'},
  people:[{id:'p-1',name:'Artiste test',departure:'Brest'}],
  participations:[{eventId:'saved-event',personId:'p-1',active:true}]
 });
 const service=Buffer.from([255]).toString('base64');
 const feed={
  meta:{first:'2026-12-15',last:'2026-12-16',timezone:'Europe/Paris'},
  stations:[['BRE','Brest',48.39,-4.48],['REN','Rennes',48.11,-1.67]],
  services:[service],
  trips:[
   [0,'TER','','A',[[0,17*3600,17*3600,1,0],
                     [1,18*3600+15*60,18*3600+15*60,0,1]]],
   [0,'TER','','R',[[1,23*3600+20*60,23*3600+20*60,1,0],
                     [0,24*3600+40*60,24*3600+40*60,0,1]]]
  ]
 };
 const fetched=[];
 globalThis.fetch=async url=>{
  const path=String(url);fetched.push(path);
  if(path.includes('manifest.json'))return {ok:true,json:async()=>({
   sources:[{id:'sncf',label:'SNCF Voyageurs',mode:'rail',
    file:'data/sncf.json',status:'ok'}]
  })};
  if(path.includes('stations.json'))return {ok:true,json:async()=>['Brest','Rennes']};
  if(path.includes('sncf.json'))return {ok:true,json:async()=>feed};
  if(path.includes('mct.json'))return {ok:true,json:async()=>({meta:{},trainRules:[]})};
  throw Error('Unsupported mock request: '+path);
 };
 await import('../site/events-app.mjs');
 await sleep(800);
 const $=id=>w.document.getElementById(id);
 assert.equal($('event-title').value,'Concert test');
 assert.equal($('event-destination').value,'Rennes');
 assert.equal($('event-start-date').value,'2026-12-15');
 assert.equal($('event-start-time').value,'20:00');
 assert.equal($('event-end-time').value,'22:00');
 assert.equal($('participants-total').textContent,'1');
 assert.equal($('etape-1').hidden,true,'event form must not be shown again');
 assert.equal($('etape-2').hidden,true,'participants form must not be shown again');
 assert.equal($('etape-3').hidden,false,'show timetable results directly');
 assert.ok($('wizard-shell').classList.contains('organizer-direct-search'));
 assert.equal($('org-search-warning').hidden,true);
 assert.equal($('wizard-next').hidden,false,'search should launch without a second click');
 assert.match($('journey-recap').textContent,/Artiste test/);
 assert.match($('journey-recap').textContent,/Brest/);
 assert.ok(fetched.some(x=>x.includes('sncf.json')),
  'published timetable data should be queried');
 assert.doesNotMatch($('global-status').textContent,/Indiquez le nom, le lieu, le début/);
 w.close();
});
