import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('058: event creation leads directly to artist creation and enrollment',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 });
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Preview must stay local');};
 await import('../site/organisation-app.mjs');
 await sleep(100);
 const $=id=>w.document.getElementById(id);
 $('overview-create-event').click();
 assert.equal($('event-editor').hidden,false);
 const form=$('event-form');
 for(const [name,value] of Object.entries({
  title:'Spectacle test Rennes',startDate:'2026-12-12',startTime:'20:00',
  endDate:'2026-12-12',endTime:'22:00',destination:'Rennes'
 }))form.elements[name].value=value;
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await sleep(150);
 assert.equal($('event-editor').hidden,false);
 assert.equal($('event-participation-region').hidden,false);
 assert.equal($('participation-form').querySelector('select[name=eventId]').closest('label').classList.contains('sr-only'),true);
 $('event-create-person').click();
 assert.equal($('panel-people').hidden,false);
 assert.equal($('person-editor').hidden,false);
 const person=$('person-form');
 person.elements.name.value='Camille Martin';
 person.elements.departure.value='Brest';
 person.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await sleep(220);
 assert.equal($('panel-events').hidden,false);
 assert.equal($('event-editor').hidden,false);
 assert.match($('event-participants-list').textContent,/Camille Martin/);
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const people=(await api('list',{type:'person'})).items;
 const events=(await api('list',{type:'event'})).items;
 const enrollments=(await api('list',{type:'participation'})).items;
 assert.equal(people.length,1);
 assert.equal(events.length,1);
 assert.equal(enrollments.length,1);
 assert.equal(enrollments[0].personId,people[0].id);
 assert.equal(enrollments[0].eventId,events[0].id);
 dom.window.close();
});
