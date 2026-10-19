import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
function click(document,id){
  const el=document.getElementById(id);
  assert.ok(el,'Missing UI element '+id);
  el.click();
}
function set(document,id,value){
  const el=document.getElementById(id);
  assert.ok(el,'Missing input '+id);
  el.value=value;
  el.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));
}
async function settle(){
  await new Promise(r=>setTimeout(r,30));
}
test('four screen wizard, concise form, progress, search and separate replies',async()=>{
  const dom=new JSDOM(html,{url:'https://ludodulac.github.io/Transbora/events.html',pretendToBeVisual:true});
  const {window}=dom;window.scrollTo=()=>{};
  window.HTMLElement.prototype.scrollIntoView=()=>{};
  globalThis.window=window;
  globalThis.document=window.document;
  globalThis.location=window.location;
  globalThis.sessionStorage=window.sessionStorage;
  globalThis.localStorage=window.localStorage;
  Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
  globalThis.confirm=()=>true;

  const manifest={sources:[{id:'sncf',label:'SNCF Voyageurs',status:'ok',
    mode:'rail',file:'data/sncf.json'}]};
  const first='2026-11-25';
  const service=Buffer.alloc(2,255).toString('base64');
  const rail={
    meta:{first,last:first,timezone:'Europe/Paris'},
    stations:[['StopArea:OCE12345678','Brest',48.39,-4.48],
              ['StopArea:OCE23456789','Paris',48.85,2.35]],
    services:[service],
    trips:[
      [0,'TGV','','401',[[0,25200,25200,1,0],[1,36000,36000,0,1]]],
      [0,'TGV','','402',[[1,75600,75600,1,0],[0,85800,85800,0,1]]]
    ]
  };
  const apiCalls=[];
  globalThis.fetch=async (url,opts={})=>{
    const path=String(url);
    if(path==='/api/transbora'){
      const input=JSON.parse(opts.body||'{}');apiCalls.push(input);
      return {ok:true,status:201,json:async()=>({
        eventId:'event-from-server',ownerKey:'owner-private-key',
        links:[{token:'link-from-server-token-123456789',label:'Sophie Martin',personId:'P-001'}]
      })};
    }
    let data;
    if(path.includes('manifest.json'))data=manifest;
    else if(path.includes('stations.json'))data=['Brest','Paris'];
    else if(path.includes('sncf.json'))data=rail;
    else if(path.includes('mct.json'))data={trainRules:[],meta:{}};
    else throw Error('Unexpected mock URL: '+path);
    return {ok:true,json:async()=>data};
  };
  await import('../site/events-app.mjs');
  await settle();
  const $=id=>window.document.getElementById(id);
  assert.equal($('event-start-date').value,'');
  assert.equal($('event-end-date').value,'');
  assert.equal($('event-start-time').value,$('event-end-time').value);
  assert.equal($('arrival-margin').value,'60');
  assert.equal($('departure-margin').value,'60');
  assert.match($('etape-1').querySelector('details > summary').textContent,/Aller \+ retour/);
  assert.equal($('etape-1').hidden,false);
  for(let i=2;i<=4;i++)assert.equal($('etape-'+i).hidden,true);
  assert.equal($('step-progress').getAttribute('aria-valuenow'),'1');
  assert.equal($('help-open').getAttribute('aria-expanded'),'false');
  assert.equal($('wizard-next').hidden,false);
  assert.equal($('search-everyone').hidden,true);
  assert.ok(!$('global-status').classList.contains('has-error'));
  assert.equal(window.document.querySelectorAll('.wizard-screen').length,4);
  assert.equal(window.document.querySelectorAll('.wizard-screen:not([hidden])').length,1);

  // A validation error prevents skipping step one.
  click(window.document,'wizard-next');
  assert.equal($('etape-1').hidden,false);
  assert.ok($('global-status').classList.contains('has-error'));
  set(window.document,'event-title','Festival');
  set(window.document,'event-destination','Paris');
  set(window.document,'event-start-date',first);
  assert.equal($('event-end-date').value,first,'The event end defaults to the changed start, never to a stale date');
  assert.equal($('event-end-time').value,$('event-start-time').value,
    'End time must auto-copy from start time');
  set(window.document,'event-start-time','16:30');
  assert.equal($('event-end-time').value,'16:30','Changing start time must sync end time');
  set(window.document,'event-end-time','18:00');
  $('include-return').checked=false;
  $('include-return').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal($('departure-margin').disabled,true);
  assert.match($('etape-1').querySelector('details > summary').textContent,/Aller$/);
  $('include-return').checked=true;
  $('include-return').dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal($('departure-margin').disabled,false);
  click(window.document,'wizard-next');
  assert.equal($('etape-2').hidden,false);
  assert.equal($('etape-1').hidden,true);
  assert.equal($('step-progress').getAttribute('aria-valuenow'),'2');
  assert.equal($('wizard-next').hidden,false);

  set(window.document,'add-first','Sophie');
  set(window.document,'add-last','Martin');
  set(window.document,'add-from','Brest');
  $('manual-person').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('participants-total').textContent,'1');
  click(window.document,'wizard-next');
  assert.equal($('etape-3').hidden,false);
  assert.equal($('search-everyone').hidden,false);
  assert.equal($('wizard-next').hidden,true);
  assert.equal($('etape-1').hidden,true);
  assert.equal($('etape-2').hidden,true);
  assert.equal($('etape-4').hidden,true);
  // One click performs the batch search and reveals next.
  click(window.document,'search-everyone');
  await new Promise(r=>setTimeout(r,130));
  assert.equal($('search-everyone').hidden,true);
  assert.equal($('wizard-next').hidden,false);
  assert.ok($('journey-recap').textContent.includes('Sophie'));
  assert.match($('journey-recap').textContent,/Brest → Paris/,
    'Result should display actual departure and arrival station names');
  assert.equal($('global-status').classList.contains('has-error'),false,
    'A successful search must not be masked by an error from navigation');
  click(window.document,'wizard-next');
  assert.equal($('etape-4').hidden,false);
  assert.equal($('prepare-native-individual').hidden,false);
  assert.equal($('prepare-native-group').hidden,false);
  $('native-master-key').value='test-private-admin';
  click(window.document,'prepare-native-individual');
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(apiCalls.length,1);
  assert.equal(apiCalls[0].mode,'individual');
  assert.equal($('owner-code-setup').hidden,true,'Owner must not reenter fixed code after successful setup');
  assert.equal($('owner-code-remembered').hidden,false);
  assert.equal(window.localStorage.getItem('transbora_owner_activation_v1'),'test-private-admin');
  click(window.document,'forget-owner-code');
  assert.equal($('owner-code-setup').hidden,false);
  assert.equal(window.localStorage.getItem('transbora_owner_activation_v1'),null);
  assert.ok(apiCalls[0].people.some(p=>p.first==='Sophie'));
  assert.equal($('native-ready').hidden,false);
  assert.match($('native-status-link').href,/suivi\.html#event=/);
  assert.match($('native-share-links').textContent,/Sophie/);
  assert.equal($('export-organizer').hidden,false);
  assert.equal($('export-personal-zip').hidden,false);
  assert.equal($('wizard-next').hidden,true);
  assert.equal($('wizard-back').hidden,false);

  // Replies are not a fifth wizard step; menu restores the last step.
  click(window.document,'help-open');
  assert.equal($('help-open').getAttribute('aria-expanded'),'true');
  click(window.document,'menu-replies');
  assert.equal($('wizard-shell').hidden,true);
  assert.equal($('reply-screen').hidden,false);
  assert.equal($('step-progress').getAttribute('aria-valuenow'),'4');
  assert.equal($('help-open').getAttribute('aria-expanded'),'false');
  assert.ok($('import-replies'));
  assert.ok($('export-followup'));
  click(window.document,'back-to-wizard');
  assert.equal($('wizard-shell').hidden,false);
  assert.equal($('etape-4').hidden,false);
  assert.equal($('reply-screen').hidden,true);

  assert.ok($('download-template'));
  assert.ok($('import-participants'));
  assert.ok($('copy-invitation'));
  assert.ok($('individual-files'));
  dom.window.close();
});
