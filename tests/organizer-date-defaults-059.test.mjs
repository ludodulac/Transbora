import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('059: start date becomes the initial end date, while user-chosen later dates survive',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 });
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('No private server in a preview test');};
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 await api('save',{type:'event',record:{
  title:'Spectacle de deux jours',startDate:'2026-12-15',endDate:'2026-12-16',
  startTime:'20:00',endTime:'22:00',destination:'Rennes'
 }});
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,100));
 const $=id=>w.document.getElementById(id);
 $('tabs').querySelector('[data-tab=events]').click();
 $('add-event-btn').click();
 const form=$('event-form'),start=form.elements.startDate,end=form.elements.endDate;
 assert.equal(start.value,'');
 assert.equal(end.value,'');
 start.value='2026-12-15';
 start.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(end.value,'2026-12-15','the end picker opens on the selected day');
 assert.equal(end.min,'2026-12-15','earlier dates must not be offered for the end');
 start.value='2026-12-16';
 start.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(end.value,'2026-12-16','auto-filled end follows an edited start');
 end.value='2026-12-20';
 end.dispatchEvent(new w.Event('change',{bubbles:true}));
 start.value='2026-12-17';
 start.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(end.value,'2026-12-20','manual later end date must remain intact');
 start.value='2026-12-21';
 start.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(end.value,'2026-12-21','an end before the new start is corrected');
 $('event-editor-close').click();
 $('events-output').querySelector('button.directory-entry').click();
 assert.equal(start.value,'2026-12-15');
 assert.equal(end.value,'2026-12-16','existing multi-day events are preserved');
 assert.equal(end.min,'2026-12-15');
 $('event-editor-close').click();
 $('add-event-btn').click();
 assert.equal(start.value,'');
 assert.equal(end.value,'','new forms must not inherit a previous event');
 assert.equal(end.min,'');
 dom.window.close();
});
