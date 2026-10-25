import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('M2 organizer UI is private, displays month and personal notes with no html injection',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{
   url:'https://transbora-ludo.netlify.app/organisation.html',pretendToBeVisual:true
 });
 const {window}=dom;
 globalThis.window=window;globalThis.document=window.document;
 globalThis.location=window.location;globalThis.history=window.history;
 globalThis.FormData=window.FormData;
 const payload={
   person:[{id:'p-person-identifier',organizationId:'our-organization-id',
     name:'Sophie <script>alert(1)</script>',departure:'Paris'}],
   event:[{id:'e-event-identifier',organizationId:'our-organization-id',
     title:'Festival',startDate:'2026-10-31',destination:'Mulhouse',
     budgetCents:75000}],
   participation:[{id:'pa-participation',organizationId:'our-organization-id',
     eventId:'e-event-identifier',personId:'p-person-identifier'}],
   option:[],choice:[],booking:[],
   note:[{id:'n-note-identifier',organizationId:'our-organization-id',
     targetType:'person',targetId:'p-person-identifier',
     content:'Contenu privé de Sophie',updatedBy:'jeanne@example.fr',updatedAt:1792840000000}]
 };
 const requests=[];
 globalThis.fetch=async(url,opt)=>{
   assert.equal(url,'/api/transbora-workspace');
   const body=JSON.parse(opt.body);requests.push(body.action);
   let result;
   if(body.action==='me')
     result={email:'jeanne@example.fr',organizationId:'our-organization-id',
       role:'manager',organizationName:'Compagnie Bora-Bora'};
   else if(body.action==='list')result={items:payload[body.type]};
   else if(body.action==='event_budget')result={
     budgetCents:75000,paidKnownCents:12500,
     unpaidKnownEstimateCents:5000,forecastCents:17500,
     forecastComplete:true,paidUnknownCount:0};
   else if(body.action==='person_month')
     result={events:[{eventTitle:'Festival',journeys:[{selectedRank:1,
       direction:'A',travelDate:'2026-10-31',stage:'CHOSEN',
       paidCents:null,estimatedCents:5000,legs:[{
         from:'Paris',to:'Mulhouse',departure:'09:22',arrival:'12:21'}]}]}]};
   else result={};
   return {ok:true,json:async()=>result};
 };
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,90));
 assert.equal(window.document.getElementById('private-panel').hidden,false);
 assert.equal(window.document.getElementById('login-panel').hidden,true);
 assert.match(window.document.body.textContent,/Compagnie Bora-Bora/);
 assert.equal(window.document.querySelectorAll('script').length,1,
   'untrusted artist name must never create script elements');
 assert.match(window.document.getElementById('people-output').textContent,/<script>alert/);
 assert.match(window.document.getElementById('notes-output').textContent,/Contenu privé/);
 assert.ok(requests.includes('event_budget'));
 const month=window.document.getElementById('month-filter');
 month.value='2026-10';
 const person=window.document.getElementById('month-person');
 person.value='p-person-identifier';
 window.document.getElementById('view-person-month').click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(window.document.getElementById('month-output').textContent,/09:22 Paris → 12:21 Mulhouse/);
 assert.match(window.document.getElementById('month-output').textContent,/Choix nº 1/);
 dom.window.close();
});
