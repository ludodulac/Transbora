import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {HELP_ENABLED,mountContextHelp,ORGANIZER_HELP} from '../site/context-help.mjs';
import {WIZARD_HELP} from '../site/help-topics-wizard.mjs';

const html=path=>readFileSync(new URL('../site/'+path,import.meta.url),'utf8');
const dom=(file)=>new JSDOM(html(file),{
 url:'https://deploy-preview-45--transbora-ludo.netlify.app/'+file,
 pretendToBeVisual:true
});

test('051: one central switch and one removable script per page',()=>{
 assert.equal(HELP_ENABLED,true);
 for(const page of ['organisation.html','events.html']){
  assert.match(html(page),/src="\.\/context-help\.mjs"/);
  assert.equal((html(page).match(/src="\.\/context-help\.mjs"/g)||[]).length,1);
 }
 const app=html('organisation-app.mjs'),wizard=html('events-app.mjs');
 assert.doesNotMatch(app,/tb-help-trigger|mountContextHelp/);
 assert.doesNotMatch(wizard,/tb-help-trigger|mountContextHelp/);
 assert.ok(ORGANIZER_HELP.length>=50);
 assert.ok(WIZARD_HELP.length>=15);
});
test('051: help appears next to relevant headings, fields and each core tab',()=>{
 const d=dom('organisation.html');
 const {document,KeyboardEvent,MouseEvent}=d.window;
 const mounted=mountContextHelp(document,{page:'organizer'});
 assert.ok(mounted.count>=45,'the organizer has contextual help in its main areas');
 for(const id of ['panel-overview','panel-people','panel-events','panel-search',
  'panel-travels','panel-answers','panel-bookings','panel-budget','panel-notes','panel-team']){
  assert.ok(document.querySelector(id==='panel-overview'?'#panel-overview .month-intro > h2 .tb-help-trigger':'#'+id+' > h2 .tb-help-trigger'),'missing '+id);
 }
 const input=document.querySelector('#person-form [name="departure"]');
 const label=input.closest('label');
 assert.ok(label.querySelector('.tb-help-trigger'));
 assert.equal(input.value,'');
 label.querySelector('.tb-help-trigger').click();
 assert.equal(input.value,'','help does not overwrite a form field');
 const overlay=document.querySelector('.tb-help-overlay');
 const title=document.getElementById('tb-help-title');
 assert.equal(overlay.hidden,false);
 assert.match(title.textContent,/Départ habituel/);
 assert.equal(document.activeElement.className,'tb-help-close');
 assert.equal(label.querySelector('.tb-help-trigger').getAttribute('aria-expanded'),'true');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(overlay.hidden,true);
 assert.equal(label.querySelector('.tb-help-trigger').getAttribute('aria-expanded'),'false');
 assert.equal(document.activeElement,label.querySelector('.tb-help-trigger'));
 const headingHelp=document.querySelector('#panel-overview .month-intro > h2 .tb-help-trigger');
 headingHelp.click();
 assert.match(document.getElementById('tb-help-text').textContent,/trajets proposés/);
 overlay.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 assert.equal(overlay.hidden,true,'clicking dark backdrop closes help');
 const originalCount=document.querySelectorAll('.tb-help-trigger').length;
 assert.equal(mountContextHelp(document,{page:'organizer'}).alreadyMounted,true);
 assert.equal(document.querySelectorAll('.tb-help-trigger').length,originalCount);
 mounted.dispose();
 assert.equal(document.querySelectorAll('.tb-help-trigger').length,0);
 assert.equal(document.querySelector('.tb-help-overlay'),null);
 assert.equal(document.querySelector('[data-transbora-context-help]'),null);
 d.window.close();
});
test('051: disable help without touching any core form or source file',()=>{
 const d=dom('organisation.html');
 const mounted=mountContextHelp(d.window.document,{enabled:false,page:'organizer'});
 assert.equal(mounted.count,0);
 assert.equal(d.window.document.querySelector('.tb-help-trigger'),null);
 assert.equal(d.window.document.querySelector('[data-transbora-context-help]'),null);
 assert.ok(d.window.document.getElementById('booking-form'));
 d.window.close();
});
test('051: search wizard explanations cover all four steps and do not toggle checkboxes',()=>{
 const d=dom('events.html');
 const {document}=d.window;
 const result=mountContextHelp(document,{page:'wizard'});
 assert.ok(result.count>=15);
 for(const id of ['step-one-heading','step-two-heading',
  'step-three-heading','step-four-heading']){
  const heading=document.getElementById(id);
  assert.ok(heading.querySelector('.tb-help-trigger'),'missing '+id);
 }
 const field=document.getElementById('arrival-margin');
 const before=field.value;
 field.closest('label').querySelector('.tb-help-trigger').click();
 assert.equal(field.value,before);
 assert.match(document.getElementById('tb-help-text').textContent,/Marge prévue/);
 assert.equal(document.querySelector('.tb-help-overlay').hidden,false);
 document.querySelector('.tb-help-close').click();
 assert.equal(document.querySelector('.tb-help-overlay').hidden,true);
 result.dispose();
 d.window.close();
});
test('051: reactive heading labels can change without removing question marks',()=>{
 const d=dom('organisation.html');const doc=d.window.document;
 mountContextHelp(doc,{page:'organizer'});
 const title=doc.getElementById('auth-title');
 title.textContent='Connexion';
 assert.ok(doc.querySelector('#auth-title + .tb-help-trigger'));
 const name=doc.getElementById('person-sheet-title');
 name.textContent='Sophie';
 assert.ok(name.nextElementSibling.classList.contains('tb-help-trigger'));
 d.window.close();
});
