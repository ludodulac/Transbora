import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('group travelers confirm separately and second preference is retained',async()=>{
 const html=readFileSync(new URL('../site/choix.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/choix.html#t=private-group-token'});
 const {window}=dom;
 globalThis.window=window;globalThis.document=window.document;
 globalThis.location=window.location;window.scrollTo=()=>{};
 const calls=[];
 globalThis.fetch=async(_url,opt)=>{
   const body=JSON.parse(opt.body);
   calls.push(body);
   if(body.action==='view')return {ok:true,json:async()=>({
     event:{title:'Festival',destination:'Paris'},mode:'group',people:[
       {id:'P-001',first:'Michel',last:'Test',departure:'Nancy',answered:false,
        options:{A:[{id:'M1',label:'Train 1'},{id:'M2',label:'Train 2'}],R:[]}},
       {id:'P-002',first:'Sophie',last:'Test',departure:'Brest',answered:false,
        options:{A:[{id:'S1',label:'Train A'}],R:[]}}
     ]
   })};
   return {ok:true,json:async()=>({saved:true,count:1})};
 };
 await import('../site/choix-app.mjs');
 await new Promise(r=>setTimeout(r,60));
 const cards=[...window.document.querySelectorAll('.traveler')];
 assert.equal(cards.length,2);
 assert.equal(window.document.getElementById('save').hidden,true);
 cards[0].querySelector('input[name="p:P-001:A"][value="M1"]').checked=true;
 cards[0].querySelector('input[name="p:P-001:A:backup"][value="M2"]').checked=true;
 cards[0].querySelector('.person-confirm').click();
 await new Promise(r=>setTimeout(r,40));
 assert.equal(calls.at(-1).action,'submit');
 assert.deepEqual(calls.at(-1).answers,[{personId:'P-001',A:'M1',A2:'M2',R:null,R2:null}]);
 assert.match(cards[0].querySelector('.traveler-status').textContent,/enregistrés/);
 assert.match(cards[1].querySelector('.traveler-status').textContent,/attente/);
 assert.equal(cards[0].querySelector('.traveler-editor').hidden,true,
   'Michel editor closes only after the successful server response');
 assert.equal(cards[0].querySelector('.traveler-saved').hidden,false);
 assert.match(cards[0].querySelector('.saved-choices-summary').textContent,
   /choix nº 1 = option 1.*choix nº 2 = option 2/);
 assert.equal(cards[1].querySelector('.traveler-editor').hidden,false,
   'Sophie can continue choosing without reopening the form');
 cards[0].querySelector('.traveler-saved .link-button').click();
 assert.equal(cards[0].querySelector('.traveler-editor').hidden,false,
   'Already confirmed traveler can explicitly edit their choice');
 assert.equal(cards[0].querySelector('.traveler-saved').hidden,true);
 cards[1].querySelector('input[value="S1"]').checked=true;
 cards[1].querySelector('.person-confirm').click();
 await new Promise(r=>setTimeout(r,40));
 assert.deepEqual(calls.at(-1).answers,[{personId:'P-002',A:'S1',A2:null,R:null,R2:null}]);
 assert.match(cards[0].querySelector('.traveler-status').textContent,/enregistrés/);
 dom.window.close();
});
