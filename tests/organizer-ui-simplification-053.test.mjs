import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi,stripFictionalExamples} from '../site/organizer-rehearsal.mjs';

const load=async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true}).window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('No private server in preview');};
 return w;
};
test('053: clearing built-in fictional records retains an independently created user',async()=>{
 const w=await load();
 const oldApi=createRehearsalApi(w.localStorage);
 const person=(await oldApi('save',{type:'person',record:{name:'Camille',departure:'Paris'}})).item;
 const emptyApi=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const people=(await emptyApi('list',{type:'person'})).items;
 assert.deepEqual(people.map(x=>x.name),['Camille']);
 assert.equal(people[0].id,person.id);
 assert.deepEqual((await emptyApi('list',{type:'event'})).items,[]);
 assert.deepEqual((await emptyApi('list',{type:'participation'})).items,[]);
 assert.deepEqual((await emptyApi('list',{type:'option'})).items,[]);
 w.close();
});
test('053: a sample identity renamed into a real person is not irreversibly erased',async()=>{
 const w=await load();
 const api=createRehearsalApi(w.localStorage);
 await api('save',{type:'person',record:{
  id:'sophie-demo',name:'Jeanne Martin',departure:'Rennes'
 }});
 const clean=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const names=(await clean('list',{type:'person'})).items.map(p=>p.name);
 assert.deepEqual(names,['Jeanne Martin']);
 assert.deepEqual((await clean('list',{type:'event'})).items,[]);
 w.close();
});

test('053: one-screen list-first flows, event search and permanent site search',async()=>{
 const w=await load();const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const p=(await api('save',{type:'person',record:{name:'Camille Martin',departure:'Brest',
  preferences:'train direct'}})).item;
 const e=(await api('save',{type:'event',record:{title:'Concert Nantes',startDate:'2026-11-20',
  destination:'Nantes',budgetCents:20000}})).item;
 const part=(await api('save',{type:'participation',record:{personId:p.id,eventId:e.id}})).item;
 const route=(await api('save',{type:'option',record:{
  participationId:part.id,direction:'A',travelDate:'2026-11-19',estimatedCents:7200,
  legs:[{from:'Brest',to:'Nantes',departure:'09:10',arrival:'12:40'}]
 }})).item;
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,100));
 const $=id=>w.document.getElementById(id);
 assert.equal($('person-editor').hidden,true);
 assert.equal($('event-editor').hidden,true);
 assert.equal($('travel-work-panel').hidden,true);
 assert.equal($('tabs').querySelector('[data-tab=search]').hidden,true);
 assert.ok($('site-search-input'));
 $('tabs').querySelector('[data-tab=people]').click();
 assert.equal($('people-output').children.length,1);
 $('people-output').querySelector('button.directory-entry').click();
 assert.equal($('person-editor').hidden,false);
 assert.equal($('person-form').elements.name.value,'Camille Martin');
 $('person-editor-close').click();
 assert.equal($('person-editor').hidden,true);
 $('tabs').querySelector('[data-tab=events]').click();
 assert.match($('events-output').textContent,/Concert Nantes/);
 $('events-output').querySelector('button.directory-entry').click();
 assert.equal($('event-editor').hidden,false);
 assert.match($('event-participants-list').textContent,/Camille/);
 $('event-editor-close').click();
 $('events-output').querySelector('button.secondary').click();
 assert.equal($('panel-search').hidden,false);
 assert.equal($('search-event-select').value,e.id);
 $('search-back-event').click();
 assert.equal($('panel-events').hidden,false);
 $('tabs').querySelector('[data-tab=travels]').click();
 assert.equal($('travel-work-panel').hidden,true);
 assert.equal($('journeys-output').querySelectorAll('.directory-entry').length,1);
 $('journeys-output').querySelector('button.directory-entry').click();
 assert.equal($('travel-work-panel').hidden,false);
 assert.equal($('travel-form-wrap').hidden,true);
 $('travel-choose').click();
 assert.equal($('travel-choice-wrap').hidden,false);
 assert.equal($('choice-form').elements.participationId.value,part.id);
 $('travel-book').click();
 assert.equal($('travel-book-wrap').hidden,false);
 assert.equal($('booking-form').elements.optionId.value,route.id);
 $('travel-panel-close').click();
 assert.equal($('travel-work-panel').hidden,true);
 $('site-search-input').value='Brest Nantes';
 $('site-search-input').dispatchEvent(new w.Event('input'));
 assert.equal($('site-search-results').hidden,false);
 assert.match($('site-search-results').textContent,/Camille/);
 $('site-search-results').querySelector('button').click();
 assert.equal($('panel-travels').hidden,false);
 assert.equal($('travel-work-panel').hidden,false);
 $('tabs').querySelector('[data-tab=overview]').click();
 $('month-filter').value='2026-11';
 $('month-filter').dispatchEvent(new w.Event('change'));
 assert.equal($('month-summary').querySelectorAll('.month-metric').length,3);
 assert.equal($('month-register-body').rows.length,1);
 assert.equal($('month-register-body').querySelectorAll('button').length,0);
 $('month-register-body').rows[0].cells[1].click();
 assert.equal($('month-detail').hidden,false);
 $('month-detail-close').click();
 assert.equal($('month-detail').hidden,true);
 $('month-jump-toggle').click();
 assert.equal($('month-picker-row').hidden,false);
 w.close();
});
