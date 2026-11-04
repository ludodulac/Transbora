import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('048: a full month of two events and multiple artists stays editable from one register',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true}).window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Local demo should not touch private server.');};
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 const sophie=(await api('save',{type:'person',record:{name:'Sophie',departure:'Paris'}})).item;
 const michel=(await api('save',{type:'person',record:{name:'Michel',departure:'Brest'}})).item;
 const e1=(await api('save',{type:'event',record:{
  title:'Spectacle Nantes',startDate:'2026-11-20',destination:'Nantes',
  budgetCents:50000
 }})).item;
 const e2=(await api('save',{type:'event',record:{
  title:'Spectacle Tours',startDate:'2026-11-27',destination:'Tours',
  budgetCents:40000
 }})).item;
 const join=async(eventId,personId)=>(await api('save',{type:'participation',record:{eventId,personId}})).item;
 const a=await join(e1.id,sophie.id),b=await join(e1.id,michel.id),
  c=await join(e2.id,sophie.id);
 const make=async(p,from,to,date)=>{
  const result=await api('save',{type:'option',record:{participationId:p.id,direction:'A',
    travelDate:date,estimatedCents:null,legs:[{from,to,departure:'08:20',arrival:'11:00'}]}});
  return result.item;
 };
 const o1=await make(a,'Paris','Nantes','2026-11-20');
 await make(b,'Brest','Nantes','2026-11-20');
 await make(c,'Paris','Tours','2026-11-27');
 await api('save',{type:'choice',record:{
  participationId:a.id,direction:'A',firstOptionId:o1.id
 }});
 await api('save',{type:'booking',record:{
  optionId:o1.id,stage:'FILED',receiptReference:'NANTES-1',paidCents:7700
 }});
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,90));
 const $=id=>w.document.getElementById(id);
 $('month-filter').value='2026-11';
 $('month-filter').dispatchEvent(new w.Event('change'));
 assert.equal($('month-register-body').rows.length,3);
 assert.match($('month-summary').textContent,/3 trajet/);
 assert.match($('month-summary').textContent,/77,00/);
 assert.match($('month-register-body').textContent,/Spectacle Nantes/);
 assert.match($('month-register-body').textContent,/Spectacle Tours/);
 assert.match($('month-register-body').textContent,/Michel/);
 $('month-person').value=sophie.id;
 $('month-person').dispatchEvent(new w.Event('change'));
 assert.equal($('month-register-body').rows.length,2);
 assert.equal($('person-sheet-actions').hidden,false);
 $('view-person-month').click();
 await new Promise(r=>setTimeout(r,55));
 assert.match($('month-output').textContent,/Spectacle Nantes/);
 assert.match($('month-output').textContent,/Spectacle Tours/);
 const row=$('month-register-body').rows[0];
 assert.equal(row.querySelectorAll('button').length,0);
 row.cells[1].click();
 $('month-detail-choice').click();
 assert.equal($('panel-travels').hidden,false);
 assert.equal($('choice-form').elements.participationId.value,a.id);
 assert.equal($('choice-form').elements.firstOptionId.value,o1.id);
 $('tabs').querySelector('[data-tab=overview]').click();
 row.cells[1].click();
 $('month-detail-booking').click();
 assert.equal($('booking-form').elements.optionId.value,o1.id);
 assert.equal($('booking-form').elements.stage.value,'FILED');
 assert.equal($('booking-form').elements.paidEuros.value,'77');
 assert.equal($('booking-form').elements.receiptReference.value,'NANTES-1');
 w.close();
});
