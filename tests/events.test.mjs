import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {COLUMNS,fromRows,isoDate,findHeader} from '../site/events-model.mjs';
import {eventBoundaries,pickItineraries,planEvent} from '../site/event-planner.mjs';
import {buildTemplate,buildIndividual,buildOrganizer,bytes,readDecisions,importTemplate} from '../site/excel-exports.mjs';

const event={title:'Journées test',destination:'Paris',startDate:'2026-11-25',
 startTime:'14:00',endDate:'2026-11-25',endTime:'19:00',
 outwardDate:'2026-11-25',returnDate:'2026-11-26',arrivalMargin:90,departureMargin:45};
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',
 outwardDate:'',returnDate:'',notes:''};
const route=(id,date,depart,arrive,from,to,extra={})=>({
  id,key:id,date,departure:depart,arrival:arrive,from,to,provider:'SNCF Voyageurs',
  mode:'rail',route:'TGV',number:id,changes:0,...extra});
const out1=route('OUT-1',event.outwardDate,7*3600,11*3600,'Brest','Paris');
const out2=route('OUT-2',event.outwardDate,8*3600,12*3600,'Brest','Paris');
const ret=route('RETURN-1',event.returnDate,9*3600,13*3600,'Paris','Brest');
const plans=new Map([[person.id,{outwardDate:event.outwardDate,returnDate:event.returnDate,
 outward:[out1,out2],returning:[ret]}]]);
test('participant import recognizes template columns and flexible headers',()=>{
  const rows=[[],[],[],[],COLUMNS,
    ['Sophie','Martin','Brest','2026-11-24','2026-11-26','avec bagages'],
    ['Marc','Dupont','Nantes','','',''],
    ['Sophie','Martin','Brest','','','']];
  const result=fromRows(rows);
  assert.equal(result.participants.length,2);
  assert.equal(result.participants[0].outwardDate,'2026-11-24');
  assert.equal(result.participants[0].returnDate,'2026-11-26');
  assert.equal(result.errors.length,1);
  assert.equal(isoDate('31/02/2026'),'');
  assert.equal(findHeader([['Prénom','Nom','Ville de départ']]).rowIndex,0);
});
test('Excel template really round-trips and imports to a structured traveler list',async()=>{
  const book=buildTemplate(ExcelJS);
  const template=book.getWorksheet('Participants');
  assert.equal(template.getCell('A5').value,COLUMNS[0]);
  template.getCell('A6').value='Sophie';template.getCell('B6').value='Martin';
  template.getCell('C6').value='Brest';template.getCell('D6').value='2026-11-24';
  const buf=await bytes(book);
  const result=await importTemplate(ExcelJS,buf);
  assert.equal(result.participants.length,1);
  assert.equal(result.participants[0].outwardDate,'2026-11-24');
});
test('event date boundaries and schedules enforce arrival/departure deadlines',()=>{
  assert.ok(eventBoundaries(event).end>eventBoundaries(event).start);
  const tripTooLate=route('LATE',event.outwardDate,10*3600,13*3600,'Brest','Paris');
  const options=pickItineraries([out1,out2,tripTooLate],
    {date:event.outwardDate},event,'A',{maximum:4});
  assert.deepEqual(options.map(x=>x.key).sort(),['OUT-1','OUT-2']);
  const impossible=route('EARLY',event.returnDate,0,4*3600,'Paris','Brest');
  assert.equal(pickItineraries([impossible],{date:event.returnDate},event,'R').length,0);
});
test('organizer export is readable, styled, with editable X and code metadata',async()=>{
  const w=buildOrganizer(ExcelJS,event,[person],plans,{});
  assert.ok(w.getWorksheet('Réservations'));
  const all=w.getWorksheet('Allers');assert.ok(all.getCell('A9').dataValidation);
  assert.equal(all.getCell('J9').value,person.id);
  assert.equal(all.getCell('L9').value,'OUT-1');
  assert.equal(all.getColumn(12).hidden,true);
  const buffer=await bytes(w);
  const recovered=new ExcelJS.Workbook();await recovered.xlsx.load(buffer);
  assert.equal(recovered.getWorksheet('Allers').getCell('H9').value.includes('Brest'),true);
  recovered.getWorksheet('Allers').getCell('A9').value='X';
  recovered.getWorksheet('Retours').getCell('A9').value='X';
  const reply=await readDecisions(ExcelJS,await bytes(recovered),[person],plans);
  assert.deepEqual(reply.choices[person.id],{A:'OUT-1',R:'RETURN-1'});
  assert.deepEqual(reply.warnings,[]);
});
test('individual file exposes only one passenger, and detects double X',async()=>{
  const w=buildIndividual(ExcelJS,event,person,plans);
  const s=w.getWorksheet('Mes choix');
  assert.equal(s.getCell('B4').value,'P-001');
  assert.equal(s.getCell('J9').value,'P-001');
  assert.equal(s.getCell('K9').value,'A');
  assert.equal(s.getCell('K11').value,'R');
  s.getCell('A9').value='X';s.getCell('A10').value='X';s.getCell('A11').value='X';
  const reply=await readDecisions(ExcelJS,await bytes(w),[person],plans);
  assert.equal(reply.choices[person.id].A,undefined);
  assert.equal(reply.choices[person.id].R,'RETURN-1');
  assert.ok(reply.warnings.some(t=>t.includes('Plusieurs X')));
});
test('individual XLSX files can be packed into a readable ZIP',async()=>{
  const a=await bytes(buildIndividual(ExcelJS,event,person,plans));
  const z=new JSZip();
  z.file('Sophie.xlsx',a);
  const output=await z.generateAsync({type:'uint8array'});
  const reader=await JSZip.loadAsync(output);
  assert.ok(reader.file('Sophie.xlsx'));
  const file=await reader.file('Sophie.xlsx').async('uint8array');
  const book=new ExcelJS.Workbook();await book.xlsx.load(file);
  assert.equal(book.getWorksheet('Mes choix').getCell('B4').value,'P-001');
});
