import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('052 phase 1: monthly arrows, inline desktop details, mobile cards, and existing actions',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/organisation.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:770px\)/);
 assert.match(css,/\.month-table-wrap\{display:none\}/);
 assert.match(css,/\.month-mobile-cards\{display:grid/);
 assert.match(css,/\.month-stage\.detail-open\{grid-template-columns/);
 const w=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 }).window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('No private server in local preview');};
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const sophie=(await api('save',{type:'person',record:{name:'Sophie Martin',departure:'Paris'}})).item;
 const michel=(await api('save',{type:'person',record:{name:'Michel Dupont',departure:'Brest'}})).item;
 const e1=(await api('save',{type:'event',record:{
  title:'Festival Nantes',startDate:'2026-11-20',destination:'Nantes',budgetCents:30000
 }})).item;
 const e2=(await api('save',{type:'event',record:{
  title:'Concert à Lille',startDate:'2026-11-23',destination:'Lille',budgetCents:40000
 }})).item;
 const participation=(await api('save',{type:'participation',record:{
  eventId:e1.id,personId:sophie.id
 }})).item;
 await api('save',{type:'participation',record:{
  eventId:e2.id,personId:michel.id
 }});
 const option=(await api('save',{type:'option',record:{
  participationId:participation.id,direction:'A',travelDate:'2026-11-19',
  estimatedCents:8600,legs:[{from:'Brest',to:'Nantes',departure:'08:10',arrival:'11:42'}]
 }})).item;
 await api('save',{type:'choice',record:{
  participationId:participation.id,direction:'A',firstOptionId:option.id
 }});
 await api('save',{type:'booking',record:{
  optionId:option.id,stage:'PAID',paidCents:9800
 }});
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,100));
 const $=id=>w.document.getElementById(id);
 $('month-filter').value='2026-11';
 $('month-filter').dispatchEvent(new w.Event('change'));
 const table=$('month-register-body');
 assert.equal(table.rows.length,2);
 assert.match($('month-display').textContent,/Novembre 2026/);
 assert.equal($('month-mobile-cards').children.length,2);
 assert.match($('month-summary').textContent,/1 billet/);
 assert.match($('month-summary').textContent,/98,00/);
 const paid=[...table.rows].find(row=>row.textContent.includes('Sophie'));
 assert.ok(paid);
 assert.match(paid.textContent,/Billet acheté/);
 assert.equal(paid.querySelectorAll('button').length,0,'monthly rows open a detail, without duplicate controls');
 paid.cells[1].click();
 assert.equal($('month-detail').hidden,false);
 assert.match($('month-detail-title').textContent,/Sophie/);
 assert.match($('month-detail-body').textContent,/Festival Nantes/);
 assert.match($('month-detail-body').textContent,/98,00/);
 assert.equal($('month-detail-choice').hidden,false);
 assert.equal($('month-detail-backdrop').hidden,false);
 $('month-detail-close').click();
 assert.equal($('month-detail').hidden,true);
 const mobilePaid=[...$('month-mobile-cards').children].find(row=>row.textContent.includes('Sophie'));
 assert.ok(mobilePaid);
 assert.match(mobilePaid.textContent,/Brest/);
 mobilePaid.querySelector('button').click();
 assert.equal($('month-detail').hidden,false);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal($('month-detail').hidden,true);
 const pending=[...table.rows].find(row=>row.textContent.includes('Michel'));
 assert.ok(pending);
 assert.match(pending.textContent,/À rechercher/);
 pending.cells[1].click();
 assert.equal($('month-detail-choice').hidden,true);
 assert.equal($('month-detail-booking').hidden,true);
 assert.equal($('month-detail-event').hidden,false);
 $('month-detail-close').click();
 paid.cells[1].click();
 $('month-detail-choice').click();
 assert.equal($('panel-travels').hidden,false);
 assert.equal($('choice-form').elements.firstOptionId.value,option.id);
 $('tabs').querySelector('[data-tab=overview]').click();
 paid.cells[1].click();
 $('month-detail-booking').click();
 assert.equal($('booking-form').elements.optionId.value,option.id);
 assert.equal($('booking-form').elements.stage.value,'PAID');
 $('tabs').querySelector('[data-tab=overview]').click();
 $('month-filter').value='2026-12';
 $('month-filter').dispatchEvent(new w.Event('change'));
 $('month-next').click();
 assert.equal($('month-filter').value,'2027-01');
 assert.match($('month-display').textContent,/Janvier 2027/);
 assert.equal($('budget-month-filter').value,'2027-01');
 $('month-prev').click();
 assert.equal($('month-filter').value,'2026-12');
 assert.equal($('month-mobile-cards').children.length,1);
 assert.match($('month-mobile-cards').textContent,/Aucun déplacement/);
 $('month-filter').value='2026-11';
 $('month-filter').dispatchEvent(new w.Event('change'));
 $('month-person').value=sophie.id;
 $('month-person').dispatchEvent(new w.Event('change'));
 assert.equal($('month-mobile-cards').children.length,1);
 assert.equal($('month-register-body').rows.length,1);
 assert.equal($('person-sheet-actions').hidden,false);
 assert.ok($('download-month-pdf'));
 assert.ok($('download-person-pdf'));
 w.close();
});
