import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {monthLedger,personMonthLedger} from '../site/organizer-monthly.mjs';
import {ledgerXlsx,ledgerPrintHtml,fileName} from '../site/organizer-monthly-export.mjs';
const data={
 people:[{id:'p1',name:'Sophie'},{id:'p2',name:'Michel',departure:'Brest'}],
 events:[{id:'e1',title:'Concert Paris',startDate:'2026-11-18',destination:'Paris'},
 {id:'e2',title:'Festival Lille',startDate:'2026-11-25',destination:'Lille'},
 {id:'e3',title:'Concert Dijon',startDate:'2026-11-20',destination:'Dijon'}],
 participations:[{id:'p-e1',personId:'p1',eventId:'e1'},
 {id:'p-e2',personId:'p1',eventId:'e2'},
 {id:'p-e3',personId:'p2',eventId:'e3'}],
 options:[
 {id:'o1',participationId:'p-e1',travelDate:'2026-11-17',direction:'A',estimatedCents:12000,
 legs:[{order:1,from:'Brest',to:'Rennes',departure:'09:30',arrival:'10:50'},
 {order:2,from:'Rennes',to:'Paris',departure:'11:20',arrival:'13:40'}]},
 {id:'o2',participationId:'p-e1',travelDate:'2026-11-17',direction:'A',estimatedCents:14000,
 legs:[{order:1,from:'Brest',to:'Paris',departure:'12:00',arrival:'16:00'}]},
 {id:'o3',participationId:'p-e2',travelDate:'2026-11-24',direction:'A',estimatedCents:null,
 legs:[{order:1,from:'Paris',to:'Lille',departure:'14:05',arrival:'15:12'}]},
 {id:'outside',participationId:'p-e2',travelDate:'2026-12-01',direction:'R',estimatedCents:null,
 legs:[{order:1,from:'Lille',to:'Brest',departure:'10:30',arrival:'15:35'}]}
 ],
 choices:[{participationId:'p-e1',direction:'A',firstOptionId:'o1',backupOptionId:'o2'},
 {participationId:'p-e2',direction:'A',firstOptionId:'o3'}],
 bookings:[{optionId:'o1',inCartAt:10,paidAt:20,paidCents:13500,filedAt:30,receiptReference:'A103'},
 {optionId:'o3',inCartAt:15,paidAt:25,paidCents:null}]
};
test('048: month table preserves two alternatives, two events, real payment and unknown-price integrity',()=>{
 const reg=monthLedger(data,'2026-11');
 assert.equal(reg.rows.length,4);
 assert.deepEqual(reg.rows.map(x=>x.optionId),['o1','o2',null,'o3']);
 assert.equal(reg.rows[0].choiceRank,1);
 assert.equal(reg.rows[1].choiceRank,2);
 assert.equal(reg.rows[0].from,'Brest');
 assert.equal(reg.rows[0].to,'Paris');
 assert.equal(reg.rows[0].cart,true);
 assert.equal(reg.rows[0].filed,true);
 assert.equal(reg.rows[2].stage,'À rechercher');
 assert.equal(reg.rows[3].paidCents,null);
 assert.equal(reg.summary.paid,2);
 assert.equal(reg.summary.paidKnownCents,13500);
 assert.equal(reg.summary.paidUnknown,1);
 assert.equal(reg.summary.pending,1);
 assert.equal(reg.summary.selected,2);
 const sophie=personMonthLedger(data,'2026-11','p1');
 assert.equal(sophie.rows.length,3);
 assert.equal(sophie.personName,'Sophie');
 assert.deepEqual([...new Set(sophie.rows.map(x=>x.event))],
  ['Concert Paris','Festival Lille']);
 assert.equal(monthLedger(data,'2026-12').rows.length,1);
 assert.throws(()=>monthLedger(data,'2026-13'),/Mois invalide/);
});
test('048: Xlsx preserves columns, purchased amounts and explicit unknown fare',async()=>{
 const reg=monthLedger(data,'2026-11');
 const buffer=await ledgerXlsx(reg,{Excel:ExcelJS,label:'Transport du mois'});
 const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(buffer);
 const sheet=wb.getWorksheet('Trajets du mois');
 assert.ok(sheet);
 assert.equal(sheet.getCell('A1').value,'TRANSBORA — Transport du mois');
 assert.equal(sheet.getCell('C4').value,'Sophie');
 assert.equal(sheet.getCell('I4').value,'1');
 assert.equal(sheet.getCell('J4').value,'X');
 assert.equal(sheet.getCell('K4').value,'X');
 assert.equal(sheet.getCell('M4').value,135);
 const lilleRow=Array.from({length:sheet.rowCount},(_,i)=>sheet.getRow(i+1))
  .find(x=>x.getCell(2).value==='Festival Lille');
 assert.equal(lilleRow?.getCell(13).value,'?');
 assert.equal(sheet.getCell('M'+(sheet.rowCount-1)).value,135);
 assert.match(fileName('FICHE','2026-11','Sophie Test'),/Sophie_Test.xlsx/);
});
test('048: printable PDF markup escapes user content without leaking HTML/script',()=>{
 const reg=monthLedger({...data,
  events:data.events.map(e=>e.id==='e1'?{...e,title:'<script>alert(1)</script>'}:e)
 },'2026-11');
 const html=ledgerPrintHtml(reg,{label:'Sophie & autres'});
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/Chx/);
 assert.match(html,/print|A4 landscape/);
});
