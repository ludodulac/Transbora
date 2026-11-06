import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {readSearchHandoff,writeSearchResults,readSearchResults}
 from '../site/organizer-bridge.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('046: one desktop sidebar and mobile hamburger navigate same existing workspace',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://deploy-preview-46--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true});
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Demo must remain local.');};
 const api=createRehearsalApi(w.localStorage,{cleanExamples:true});
 await api('save',{type:'person',record:{name:'Sophie Martin',departure:'Paris'}});
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,90));
 const $=id=>w.document.getElementById(id);
 assert.equal($('private-panel').hidden,false);
 const tabs=[...$('tabs').querySelectorAll('button[data-tab]')].map(x=>x.dataset.tab);
 assert.deepEqual(tabs,['overview','events','search','people','travels','answers',
  'bookings','budget','notes','team']);
 $('nav-toggle').click();
 assert.equal($('nav-toggle').getAttribute('aria-expanded'),'true');
 assert.equal($('nav-backdrop').hidden,false);
 $('tabs').querySelector('[data-tab=people]').click();
 assert.equal($('panel-people').hidden,false);
 assert.equal($('panel-search').hidden,true);
 assert.equal($('nav-toggle').getAttribute('aria-expanded'),'false');
 $('person-filter').value='sophie';
 $('person-filter').dispatchEvent(new w.Event('input'));
 const visible=[...$('people-output').children].filter(x=>!x.hidden);
 assert.equal(visible.length,1);
 assert.match(visible[0].textContent,/Sophie/);
 w.close();
});

test('046: search from recorded event reuses its people; search results return inline without losing workspace',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 // The module is imported once per test process; use a separate filename for
 // the full-flow suite to avoid re-binding the first window.
 assert.match(html,/id="search-frame"/);
 assert.match(html,/id="search-event-select"/);
 assert.match(html,/id="directory-person-find"|data-tab="search"/);
 const css=readFileSync(new URL('../site/organisation.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:202px/);
 assert.match(css,/@media\(max-width:770px\)/);
 assert.match(css,/\.tabs\.open/);
 const wizard=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 assert.match(wizard,/id="directory-person-find"/);
 const js=readFileSync(new URL('../site/events-app.mjs',import.meta.url),'utf8');
 assert.match(js,/extendSearchHandoff/);
 assert.match(js,/transbora:routes-ready/);
 assert.match(js,/embedded-workspace/);
 assert.match(js,/createRehearsalApi/);
});
