import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('054 UI: the shared organizer registers the native owner link and displays pushed rank 1/2 choices',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://transbora-ludo.netlify.app/organisation.html?connexion=1',
  pretendToBeVisual:true});
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;globalThis.FormData=w.FormData;
 const eventId='event-0123456789abcdefghijklmnopqrstuvwxyz';
 const personId='person-0123456789abcdefghijklmnopqrstuvwxyz';
 const participantId='part-0123456789abcdefghijklmnopqrstuvwxyz';
 const optionId1='option-0123456789abcdefghijklmnopqrstuvwxyz';
 const optionId2='option-9876543210abcdefghijklmnopqrstuvwxyz';
 const nativeEventId='native-0123456789abcdefghijklmnopqrstuvwxyz';
 const user={email:'jeanne@example.fr',role:'manager',organizationId:'org-example-12345',organizationName:'Compagnie Jeanne'};
 const data={
  person:[{id:personId,organizationId:user.organizationId,name:'Camille Martin',departure:'Brest'}],
  event:[{id:eventId,organizationId:user.organizationId,title:'Concert Nantes',
   destination:'Nantes',startDate:'2026-11-20',budgetCents:null}],
  participation:[{id:participantId,eventId,personId,organizationId:user.organizationId}],
  option:[
   {id:optionId1,organizationId:user.organizationId,participationId:participantId,
    direction:'A',travelDate:'2026-11-20',estimatedCents:null,
    legs:[{from:'Brest',to:'Nantes',departure:'08:00',arrival:'12:20'}]},
   {id:optionId2,organizationId:user.organizationId,participationId:participantId,
    direction:'A',travelDate:'2026-11-20',estimatedCents:null,
    legs:[{from:'Brest',to:'Nantes',departure:'09:00',arrival:'13:20'}]}
  ],choice:[],booking:[],note:[]
 };
 const requests=[],ack=[];
 let revision='initial',links=0;
 globalThis.fetch=async(url,opts)=>{
  if(url!=='/api/transbora-workspace')throw Error('Unexpected remote API');
  const body=JSON.parse(opts.body);
  requests.push(body);
  let result;
  switch(body.action){
   case 'me':result=user;break;
   case 'list':result={items:structuredClone(data[body.type]||[])};break;
   case 'event_budget':result={
    budgetCents:null,paidKnownCents:0,unpaidKnownEstimateCents:0,
    forecastCents:0,forecastComplete:false,paidUnknownCount:0
   };break;
   case 'sync_native_choices':result={linked:links,choicesRevision:revision,
    synced:0,conflicts:[]};break;
   case 'link_native_choices':
    assert.equal(body.eventId,eventId);
    assert.equal(body.ownerKey,'owner-capability-not-shown-to-artists');
    links=1;
    result={linked:true,eventId,synced:0,conflicts:[]};break;
   default:throw Error('Unexpected action '+body.action);
  }
  return {ok:true,status:200,json:async()=>result};
 };
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,80));
 const $=id=>w.document.getElementById(id);
 assert.equal($('private-panel').hidden,false);
 $('tabs').querySelector('[data-tab=events]').click();
 const btn=[...$('events-output').querySelectorAll('button')].find(b=>
  b.textContent.includes('Trouver les trajets'));
 assert.ok(btn);
 btn.click();
 assert.equal($('panel-search').hidden,false);
 const frame=$('search-frame');
 assert.match(frame.src,/from_shared=1/);
 frame.contentWindow.postMessage=(payload)=>ack.push(payload);
 const mapping={version:1,organizerEventId:eventId,nativeEventId,
  title:'Concert Nantes',destination:'Nantes',startDate:'2026-11-20',
  travelers:[{organizerPersonId:personId,nativePersonId:'P-001',options:{
   A:[{nativeOptionId:'train-1',sourceKey:'source-1'},
      {nativeOptionId:'train-2',sourceKey:'source-2'}],R:[]}}]};
 const signal=(origin,data)=>w.dispatchEvent(new w.MessageEvent('message',{
  origin,source:frame.contentWindow,data
 }));
 signal('https://unauthorized.example',{type:'transbora:shared-native-link',
  eventId,mapping,ownerKey:'fake-key'});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(requests.filter(x=>x.action==='link_native_choices').length,0);
 signal(w.location.origin,{type:'transbora:shared-native-link',
  eventId,mapping,ownerKey:'owner-capability-not-shown-to-artists'});
 await new Promise(resolve=>setTimeout(resolve,65));
 assert.equal(requests.filter(x=>x.action==='link_native_choices').length,1);
 assert.ok(ack.some(x=>x.type==='transbora:shared-native-link-result'&&x.ok));
 assert.ok(!JSON.stringify(ack).includes('owner-capability'));
 assert.ok(!w.document.body.textContent.includes('owner-capability'));
 const received={
  id:'choice-001',organizationId:user.organizationId,participationId:participantId,
  direction:'A',firstOptionId:optionId2,backupOptionId:optionId1,
  origin:'native',nativeEventId,updatedAt:Date.now()
 };
 data.choice.push(received);
 revision='after-artist-submit';
 $('tabs').querySelector('[data-tab=answers]').click();
 await new Promise(resolve=>setTimeout(resolve,85));
 assert.match($('answers-output').textContent,/Camille Martin/);
 assert.match($('answers-output').textContent,/choix nº 1/);
 assert.match($('answers-output').textContent,/choix nº 2/);
 assert.match($('answers-output').textContent,/09:00/);
 assert.match($('answers-output').textContent,/08:00/);
 assert.match($('shared-replies-hint').textContent,/automatiquement/);
 w.close();
});
