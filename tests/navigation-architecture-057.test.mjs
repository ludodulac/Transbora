import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=page=>readFileSync(new URL('../site/'+page,import.meta.url),'utf8');

test('057: one canonical entry point; legacy tracking pages are clearly distinct',()=>{
 const home=read('index.html'),history=read('mes-evenements.html'),wizard=read('events.html');
 assert.match(home,/http-equiv="refresh" content="0;url=\.\/organisation\.html"/);
 assert.match(home,/href="\.\/organisation\.html"/);
 assert.match(history,/<h1>Liens de suivi<\/h1>/);
 assert.doesNotMatch(history,/Nouvel espace d’organisation|bêta privée|＋ Nouvel événement/);
 assert.match(history,/href="\.\/organisation\.html"/);
 const w=new JSDOM(wizard);
 const menu=w.window.document.querySelector('#help-drawer .drawer-nav');
 assert.equal(menu.querySelectorAll('a,button').length,3);
 assert.ok(menu.querySelector('#clear-saved-draft'));
 assert.doesNotMatch(menu.textContent,/Brouillon en cours|Recherche rapide|Nouvel événement|Tableau organisateur/);
 assert.match(menu.textContent,/Tableau de bord/);
 assert.match(menu.textContent,/Liens de suivi/);
 w.window.close();
});

test('057: organizer navigation names match the page headings',()=>{
 const dom=new JSDOM(read('organisation.html'));
 const d=dom.window.document,nav=d.querySelector('#tabs');
 const headings={
  overview:'Tableau de bord',events:'Événements',people:'Artistes',
  search:'Recherche de trajets',travels:'Déplacements',answers:'Réponses',
  bookings:'Billets',budget:'Budgets',notes:'Notes',team:'Paramètres'
 };
 for(const [tab,title] of Object.entries(headings)){
  const btn=nav.querySelector('[data-tab="'+tab+'"]');
  assert.ok(btn,'missing nav item '+tab);
  assert.ok(btn.textContent.includes(title),'wrong label for '+tab);
  const panel=d.getElementById('panel-'+tab);
  assert.ok(panel.querySelector('h1,h2')?.textContent.includes(title),
   'heading does not match menu '+tab);
 }
 assert.equal(nav.querySelector('[data-tab=search]').hidden,true);
 assert.equal(nav.querySelectorAll(':scope > button:not([hidden])').length,6);
 assert.equal(nav.querySelectorAll('#nav-more button').length,3);
 assert.equal(d.querySelectorAll('#overview-create-event').length,1);
 dom.window.close();
});

test('057: empty workspace shows one first step instead of empty statistics and PDF controls',async()=>{
 const dom=new JSDOM(read('organisation.html'),{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 });
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;globalThis.location=w.location;
 globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Private service must not be accessed in preview');};
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,120));
 const $=id=>w.document.getElementById(id);
 assert.equal($('overview-empty').hidden,false);
 assert.equal($('panel-overview').classList.contains('is-empty'),true);
 assert.match($('overview-empty').textContent,/Créer un événement/);
 $('overview-create-event').click();
 assert.equal($('panel-events').hidden,false);
 assert.equal($('event-editor').hidden,false);
 assert.equal($('tabs').querySelector('[data-tab=events]').getAttribute('aria-current'),'page');
 $('event-editor-close').click();
 $('tabs').querySelector('[data-tab=people]').click();
 assert.equal($('panel-people').hidden,false);
 $('tabs').querySelector('[data-tab=budget]').click();
 assert.equal($('nav-more').open,true);
 assert.equal($('panel-budget').hidden,false);
 $('tabs').querySelector('[data-tab=overview]').click();
 assert.equal($('nav-more').open,false);
 dom.window.close();
});
