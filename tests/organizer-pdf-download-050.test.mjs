import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {monthLedger,personMonthLedger} from '../site/organizer-monthly.mjs';
import {monthlyTravelPdf,travelPdfName} from '../site/organizer-monthly-pdf.mjs';

const data={
 people:[{id:'s',name:'Sophie Dûpré'},{id:'m',name:'Michel'}],
 events:[{id:'e1',title:'Concert Brest',startDate:'2026-11-14',destination:'Brest'},
 {id:'e2',title:'Festival Nantes',startDate:'2026-11-28',destination:'Nantes'}],
 participations:[{id:'p1',personId:'s',eventId:'e1'},{id:'p2',personId:'s',eventId:'e2'},
 {id:'p3',personId:'m',eventId:'e2'}],
 options:[
 {id:'o1',participationId:'p1',direction:'A',travelDate:'2026-11-14',estimatedCents:3400,
  legs:[{order:1,from:'Quimper',to:'Rennes',departure:'09:00',arrival:'10:00'},
   {order:2,from:'Rennes',to:'Brest',departure:'10:40',arrival:'12:30'}]},
 {id:'o2',participationId:'p2',direction:'A',travelDate:'2026-11-28',estimatedCents:null,
  legs:[{order:1,from:'Brest',to:'Nantes',departure:'08:00',arrival:'11:20'}]}
 ],
 choices:[{participationId:'p1',direction:'A',firstOptionId:'o1'}],
 bookings:[{optionId:'o1',inCartAt:10,paidAt:20,paidCents:3980},
 {optionId:'o2',inCartAt:30,paidAt:40,paidCents:null}]
};
const decode=b=>Buffer.from(b).toString('latin1');
function validatePdf(bytes){
 assert.ok(bytes instanceof Uint8Array,'PDF is already downloaded as bytes');
 const pdf=decode(bytes);
 assert.match(pdf,/^%PDF-1\.4\n/);
 assert.match(pdf,/%%EOF\n$/);
 const last=/startxref\n(\d+)\n%%EOF\n$/.exec(pdf);
 assert.ok(last);
 assert.equal(pdf.slice(Number(last[1]),Number(last[1])+4),'xref');
 const section=pdf.slice(Number(last[1]));
 const match=/^xref\n0 (\d+)\n/.exec(section);
 assert.ok(match);
 const n=Number(match[1]);
 const entries=section.split('\n').slice(2,2+n);
 assert.equal(entries[0],'0000000000 65535 f ');
 for(let i=1;i<n;i++){
  const position=Number(entries[i].slice(0,10));
  assert.ok(position>0 && position<pdf.length);
  assert.ok(pdf.slice(position).startsWith(i+' 0 obj\n'),'valid xref for PDF object '+i);
 }
 const pageCount=(pdf.match(/\/Type \/Page \/Parent/g)||[]).length;
 assert.ok(pageCount>=1);
 assert.match(pdf,new RegExp('/Count '+pageCount+'\\b'));
 return {pdf,pageCount};
}
test('050: PDF download is a real, internally consistent document, not HTML or a print dialog',()=>{
 const register=monthLedger(data,'2026-11');
 const {pdf}=validatePdf(monthlyTravelPdf(register));
 assert.match(pdf,/\/MediaBox \[0 0 841.89 595.28\]/);
 assert.match(pdf,/TRAN?SBORA|TRANSBORA/);
 assert.match(pdf,/Sophie/);
 assert.match(pdf,/Quimper/);
 assert.match(pdf,/Brest/);
 assert.match(pdf,/Prix pay/);
 assert.match(pdf,/398?0|39,80/);
 assert.match(pdf,/ATTENTION/,'unknown purchased amount must be shown');
 assert.match(pdf,/\\373/,'French accented name is WinAnsi-encoded, not lost');
 assert.equal(travelPdfName(register),'TRANSBORA_MOIS_2026-11.pdf');
 const individual=personMonthLedger(data,'2026-11','s');
 const {pdf:individualPdf}=validatePdf(monthlyTravelPdf(individual,{personName:individual.personName}));
 assert.match(individualPdf,/Concert Brest/);
 assert.match(individualPdf,/Festival Nantes/);
 assert.doesNotMatch(individualPdf,/Michel/,'individual file excludes other artists');
 assert.equal(travelPdfName(individual,{personName:individual.personName}),
  'TRANSBORA_FICHE_2026-11_Sophie_Dupre.pdf');
});
test('050: large month automatically paginates, repeats table headings and enumerates pages',()=>{
 const many={...data,
  options:Array.from({length:78},(_,i)=>({...data.options[0],
   id:'extra-'+i,travelDate:'2026-11-'+String(1+i%28).padStart(2,'0')})),
  bookings:[],choices:[]};
 const r=monthLedger(many,'2026-11');
 const {pdf,pageCount}=validatePdf(monthlyTravelPdf(r));
 assert.ok(pageCount>=4);
 assert.equal((pdf.match(/Chx/g)||[]).length,2*pageCount,
  'each page has both the legend and table heading');
 assert.match(pdf,/Page 1 \/ [0-9]+/);
 assert.match(pdf,new RegExp('Page '+pageCount+' \\/ '+pageCount));
});
test('050: users explicitly download PDF, optionally print, no Excel returned to the organizer UI',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 assert.match(html,/id="download-month-pdf"/);
 assert.match(html,/id="download-person-pdf"/);
 assert.match(html,/id="print-month"/);
 assert.match(html,/id="print-person"/);
 assert.doesNotMatch(html,/id="export-month-xlsx"/);
 const w=new JSDOM(html,{url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true}).window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('Private server must not be called in demo.');};
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let capturedBlob=null,downloadFilename='';
 URL.createObjectURL=blob=>{capturedBlob=blob;return 'blob:https://test.invalid/abc';};
 URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloadFilename=this.download;};
 try{
  await import('../site/organisation-app.mjs');
  await new Promise(resolve=>setTimeout(resolve,90));
  const $=id=>w.document.getElementById(id);
  $('month-filter').value='2026-10';
  $('month-filter').dispatchEvent(new w.Event('change'));
  $('download-month-pdf').click();
  assert.equal(downloadFilename,'TRANSBORA_MOIS_2026-10.pdf');
  assert.equal(capturedBlob.type,'application/pdf');
  validatePdf(new Uint8Array(await capturedBlob.arrayBuffer()));
  $('month-person').value='sophie-demo';
  $('month-person').dispatchEvent(new w.Event('change'));
  assert.equal($('person-sheet-actions').hidden,false);
  $('download-person-pdf').click();
  assert.match(downloadFilename,/TRANSBORA_FICHE_2026-10_Sophie_exemple\.pdf/);
  validatePdf(new Uint8Array(await capturedBlob.arrayBuffer()));
  assert.match($('print-person').textContent,/Imprimer/);
  assert.equal($('global-feedback').hidden,false);
  assert.match($('global-feedback').textContent,/PDF téléchargé/);
 }finally{
  URL.createObjectURL=originalCreate;
  URL.revokeObjectURL=originalRevoke;
  w.close();
 }
});
