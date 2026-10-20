import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFormsRows,googleSheetTSV,optionLabel,cleanCell,FORM_HEADERS} from '../site/google-forms-export.mjs';

const event={title:'Colloque test',destination:'Paris',includeOutward:true,includeReturn:true};
const participants=[
 {id:'P-001',first:'Sophie',last:'Martin',departure:'Toulouse'},
 {id:'P-002',first:'Marc',last:'Dupont',departure:'Brest'}
];
const route={id:'TGV:123',key:'TGV:123',departure:32400,arrival:43200,from:'Toulouse',to:'Paris',
 provider:'SNCF Voyageurs',number:'123',mode:'rail'};
const planned=new Map([
 ['P-001',{outwardDate:'2026-10-29',returnDate:'2026-10-30',outward:[route],returning:[]}],
 ['P-002',{outwardDate:'2026-10-29',returnDate:'2026-10-30',outward:[],returning:[]}],
]);
test('Google Sheets export has exact headers and records both date directions',()=>{
 const d=buildFormsRows(event,participants,planned,'individuel',{batchId:'EV-TEST-001'});
 assert.equal(d.rows.length,4);
 assert.equal(d.rows[0][10],'2026-10-29');
 assert.equal(d.rows[1][7],'R');
 assert.equal(d.rows[1][8],'NONE');
 assert.equal(d.rows[2][3],'P-002');
 const text=googleSheetTSV(d);
 assert.equal(text.split('\n').length,5);
 assert.equal(text.split('\n')[0],FORM_HEADERS.join('\t'));
 assert.match(text,/Sophie/);
 assert.match(text,/SNCF Voyageurs/);
});
test('only outbound requested emits no return in organizer group export',()=>{
 const d=buildFormsRows({...event,includeReturn:false},participants,planned,'collectif',{batchId:'EV-TEST-002'});
 assert.equal(d.rows.length,2);
 assert.equal(d.rows.every(x=>x[7]==='A'),true);
 assert.equal(d.rows[0][2],'collectif');
});
test('rejects spreadsheet formula injection and tab/newline injection',()=>{
 assert.equal(cleanCell('=HYPERLINK("http://bad")').startsWith("'="),true);
 assert.equal(cleanCell('+SUM(1,2)').startsWith("'+"),true);
 assert.equal(cleanCell('@meta').startsWith("'@"),true);
 assert.equal(cleanCell('hello\tworld\nhi'),'hello world hi');
});
test('keeps event travel date and provides human-readable options',()=>{
 const label=optionLabel(route,'2026-10-29',1);
 assert.match(label,/SNCF Voyageurs/);
 assert.match(label,/09:00/);
 assert.match(label,/Direct/);
  assert.doesNotMatch(label,/0 changement/);
 assert.throws(()=>buildFormsRows(event,participants,planned,'invalid'),/non reconnu/);
});
