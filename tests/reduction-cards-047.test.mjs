import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {FRENCH_RAIL_CARDS,packRailCards,unpackRailCards} from '../site/reduction-cards.mjs';
import {createRehearsalApi} from '../site/organizer-rehearsal.mjs';

test('047: named discount products are selectable without assuming a price',()=>{
 const names=FRENCH_RAIL_CARDS.map(c=>c.name);
 assert.ok(names.includes('Carte Avantage Jeune'));
 assert.ok(names.includes('Carte Avantage Senior'));
 assert.ok(names.includes('Carte Liberté'));
 assert.ok(names.includes('Abonnement TER BreizhGo mensuel'));
 assert.ok(names.includes('BreizhGo Solidaire'));
 assert.equal(packRailCards(['Carte Liberté','Carte Avantage Jeune','Carte Liberté']),
  'Carte Liberté | Carte Avantage Jeune');
 assert.deepEqual(unpackRailCards('Carte Liberté | Carte Avantage Jeune').known,
  ['Carte Liberté','Carte Avantage Jeune']);
 assert.equal(unpackRailCards('Ancienne carte régionale').other,
  'Ancienne carte régionale');
 assert.throws(()=>packRailCards([], 'x'.repeat(201)),/200 caractères/);
});
test('047: choose, save and re-edit card selections without losing legacy custom value',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const w=new JSDOM(html,{url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true}).window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Local demo must not call private API');};
 await import('../site/organisation-app.mjs');
 await new Promise(r=>setTimeout(r,70));
 const $=id=>w.document.getElementById(id);
 const form=$('person-form');
 const boxes=[...$('person-card-options').querySelectorAll('input[type=checkbox]')];
 assert.ok(boxes.length>=8);
 boxes.find(x=>x.value==='Carte Liberté').checked=true;
 boxes.find(x=>x.value==='Abonnement TER BreizhGo mensuel').checked=true;
 $('person-card-options').dispatchEvent(new w.Event('change',{bubbles:true}));
 $('person-card-other').value='Carte régionale personnelle';
 $('person-card-other').dispatchEvent(new w.Event('input',{bubbles:true}));
 form.querySelector('[name=name]').value='Camille Martin';
 form.querySelector('[name=departure]').value='Lorient';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(r=>setTimeout(r,55));
 const api=createRehearsalApi(w.localStorage);
 const person=(await api('list',{type:'person'})).items.find(x=>x.name==='Camille Martin');
 assert.ok(person,'Person should have been saved');
 assert.match(person.reductionCards,/Carte Liberté/);
 assert.match(person.reductionCards,/Abonnement TER BreizhGo mensuel/);
 assert.match(person.reductionCards,/Carte régionale personnelle/);
 assert.equal($('person-card-summary').textContent,'Aucun','After save picker resets');
 const card=[...$('people-output').children].find(x=>x.textContent.includes('Camille Martin'));
 assert.ok(card);
 card.click();
 assert.equal(boxes.find(x=>x.value==='Carte Liberté').checked,true);
 assert.equal(boxes.find(x=>x.value==='Abonnement TER BreizhGo mensuel').checked,true);
 assert.equal($('person-card-other').value,'Carte régionale personnelle');
 w.close();
});
test('047: interface avoids duplicated explanatory text before each work area',()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/Organisation · aperçu/);
 assert.doesNotMatch(html,/Événements, personnes, billets et notes au même endroit/);
 assert.doesNotMatch(html,/Choisissez un événement : sa liste de personnes/);
 assert.doesNotMatch(html,/Démonstration locale.*vos données restent/);
 assert.match(html,/<h2>Recherche de trajets pour un événement<\/h2>/);
 assert.match(html,/id="person-card-picker"/);
});
