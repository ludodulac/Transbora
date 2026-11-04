import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('048: authenticated shared timetable does not persist artist names, dates or roster in a local demo draft',async()=>{
 const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{url:'https://transbora-ludo.netlify.app/events.html?from_shared=1&embedded=1',
  pretendToBeVisual:true}).window;
 w.scrollTo=()=>{};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.localStorage=w.localStorage;
 globalThis.sessionStorage=w.sessionStorage;
 Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
 globalThis.confirm=()=>true;
 globalThis.fetch=async url=>{
  if(String(url).includes('manifest.json'))return {ok:true,json:async()=>({sources:[{id:'sncf',status:'ok',label:'SNCF'}]})};
  if(String(url).includes('stations.json'))return {ok:true,json:async()=>['Brest','Paris']};
  throw Error('Unexpected fetch '+url);
 };
 await import('../site/events-app.mjs');
 await new Promise(r=>setTimeout(r,80));
 const $=id=>w.document.getElementById(id);
 assert.equal($('manual-person').hidden,true);
 assert.equal($('directory-select').hidden,true);
 const input={version:1,createdAt:Date.now(),eventId:'secure-event-abcdefghijklmnopqrstuvwxyz',
  title:'Spectacle test',destination:'Paris',startDate:'2026-11-24',
  travelers:[{personId:'person-abcdefghijklmnopqrstuvwxyz',name:'Sophie Martin',
   departure:'Brest',reductionCards:'Carte Avantage Adulte',preferences:'Près fenêtre'}]};
 w.dispatchEvent(new w.MessageEvent('message',{
  origin:w.location.origin,source:w.parent,
  data:{type:'transbora:shared-handoff',handoff:input}
 }));
 assert.equal($('event-title').value,'Spectacle test');
 assert.equal($('event-start-date').value,'2026-11-24');
 assert.equal($('event-start-date').readOnly,true);
 assert.equal($('participants-total').textContent,'1');
 assert.match($('participants-list').textContent,/Sophie Martin/);
 assert.equal($('directory-person-find').value,'');
 assert.ok(!Object.values(w.localStorage).some(value=>
  typeof value==='string'&&value.includes('Sophie Martin')),'Shared identity must not be serialized into local storage');
 w.close();
});
