import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('traveler chooses one actual departure and return on mobile without external signup',async()=>{
 const html=readFileSync(new URL('../site/choix.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://transbora-ludo.netlify.app/choix.html#t=private-token',
   pretendToBeVisual:true});
 const {window}=dom;
 globalThis.window=window;
 globalThis.document=window.document;
 globalThis.location=window.location;
 window.scrollTo=()=>{};
 const calls=[];
 globalThis.fetch=async (_url,options)=>{
   const body=JSON.parse(options.body);
   calls.push(body);
   if(body.action==='view')return {ok:true,json:async()=>({
     event:{title:'Festival',destination:'Paris'},mode:'individual',
     people:[{id:'P-001',first:'Sophie',last:'Martin',departure:'Bordeaux',
       options:{A:[{id:'a-1',label:'Bordeaux 08:00 → Paris 11:00'}],
         R:[{id:'r-1',label:'Paris 20:00 → Bordeaux 23:00'}]}}]
   })};
   return {ok:true,json:async()=>({saved:true,count:1})};
 };
 await import('../site/choix-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(window.document.querySelectorAll('.route-choice input[type="radio"]').length,6);
 assert.match(window.document.querySelector('.rank-instruction').textContent,/Nº 1/);
 assert.match(window.document.querySelector('.rank-instruction').textContent,/Nº 2/);
 assert.match(window.document.body.textContent,/Sophie/);
 window.document.querySelector('input[name="p:P-001:A"][value="a-1"]').checked=true;
 window.document.querySelector('input[name="p:P-001:R"][value="r-1"]').checked=true;
 window.document.getElementById('choice-form').dispatchEvent(new window.Event('submit',{
   bubbles:true,cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(calls[1].action,'submit');
 assert.equal(calls[1].answers[0].A,'a-1');
 assert.equal(calls[1].answers[0].R,'r-1');
 assert.equal(window.document.getElementById('success').hidden,false);
 assert.match(window.document.getElementById('success').textContent,/Votre réponse a bien été transmise/);
 assert.match(window.document.getElementById('success-recap').textContent,/Aller.*option 1.*Retour.*option 1/);
 assert.equal(window.document.getElementById('choice-form').hidden,true);
 dom.window.close();
});
