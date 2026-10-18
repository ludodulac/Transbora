import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {travelDates,shiftDate,planEvent} from '../site/event-planner.mjs';
import {buildFormsRows,optionLabel} from '../site/google-forms-export.mjs';
import {buildOrganizer,buildIndividual,bytes} from '../site/excel-exports.mjs';
import {parisDate} from '../site/time-zones.mjs';

const d='2026-11-29';
const ev={title:'Spectacle le 29',destination:'Paris',
  startDate:d,startTime:'14:00',endDate:d,endTime:'23:00',
  outwardDate:'',returnDate:'',daysBefore:2,daysAfter:2,
  arrivalMargin:90,departureMargin:45,includeOutward:true,includeReturn:true};
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',outwardDate:'',returnDate:'',notes:''};
const feed={source:{id:'sncf',label:'SNCF Voyageurs',mode:'rail'},data:{
  meta:{first:'2026-11-27',last:'2026-12-03',timezone:'Europe/Paris'},
  stations:[['Brest','Brest'],['Paris','Paris']],
  services:[Buffer.alloc(2,255).toString('base64')],
  trips:[
    [0,'TGV','Paris','A',[[0,83700,83700,1,0],[1,97200,97200,0,1]]],  // prev 23:15 → next 03:00
    [0,'TGV','Paris','B',[[0,28800,28800,1,0],[1,40800,40800,0,1]]], // same-day 08:00 → 11:20
    [0,'TGV','Brest','C',[[1,25200,25200,1,0],[0,43200,43200,0,1]]], // 07:00 next day
    [0,'TGV','Brest','D',[[1,85800,85800,1,0],[0,100800,100800,0,1]]] // end-day 23:50 → next 04:00
  ]
}};
const settings={mode:'rail',connections:'no',buffer:'very_cautious',maxOptions:5};
test('calendar shifts across months and Europe/Paris daylight-saving changes',()=>{
 assert.equal(shiftDate(d,-2),'2026-11-27');
 assert.equal(shiftDate(d,2),'2026-12-01');
 assert.equal(shiftDate('2026-10-25',-1),'2026-10-24');
 assert.equal(shiftDate('2026-10-25',1),'2026-10-26');
 assert.deepEqual(travelDates(ev,person,'A'),['2026-11-27','2026-11-28','2026-11-29']);
 assert.deepEqual(travelDates(ev,person,'R'),['2026-11-29','2026-11-30','2026-12-01']);
});
test('late event automatically offers next-day return, and previous-day midnight-crossing outward',async()=>{
 const result=await planEvent(ev,[person],[feed],settings);
 const plan=result.plans.get('P-001');
 assert.ok(plan.outward.some(r=>r.date==='2026-11-28'&&parisDate(r.date,r.arrival)==='29/11/2026'),
   'previous evening outbound that arrives on event day was lost');
 assert.ok(plan.returning.some(r=>r.date==='2026-11-30'),'next-day return option must be visible');
 assert.ok(plan.returning.some(r=>r.date==='2026-11-29'&&parisDate(r.date,r.arrival)==='30/11/2026'),
   'late return departing after the show and arriving the next morning');
 const google=buildFormsRows(ev,[person],result.plans,'individuel',{batchId:'EV-NOVEMBER-29'});
 const next=google.rows.find(row=>row[7]==='R'&&row[10]==='2026-11-30');
 assert.ok(next,'Google form must preserve the real departure date');
 assert.match(next[9],/30\/11\/2026/);
 const overnight=google.rows.find(row=>row[7]==='A'&&row[10]==='2026-11-28');
 assert.match(overnight[9],/28\/11\/2026.*29\/11\/2026/);
 const excel=buildOrganizer(ExcelJS,ev,[person],result.plans);
 const back=excel.getWorksheet('Retours');
 const values=[];
 for(let row=9;row<=back.rowCount;row++)values.push(back.getCell('E'+row).value);
 assert.ok(values.some(x=>String(x).includes('30/11/2026')),JSON.stringify(values));
 const personal=buildIndividual(ExcelJS,ev,person,result.plans);
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await bytes(personal));
 assert.ok(reopened.getWorksheet('Mes choix'));
});
test('explicit dates are intentionally exact and bypass automatic date expansion',async()=>{
 assert.deepEqual(travelDates({...ev,outwardDate:'2026-11-27'},person,'A'),['2026-11-27']);
 assert.deepEqual(travelDates(ev,{...person,returnDate:'2026-12-01'},'R'),['2026-12-01']);
 const e={...ev,outwardDate:'2026-11-29',returnDate:'2026-11-29'};
 const result=await planEvent(e,[person],[feed],settings);
 const p=result.plans.get('P-001');
 assert.ok(p.outward.every(x=>x.date==='2026-11-29'));
 assert.ok(p.returning.every(x=>x.date==='2026-11-29'));
});
test('return following day is allowed even if no train runs after 23h',async()=>{
 const nextDayOnly={...feed,data:{...feed.data,trips:[feed.data.trips[2]]}};
 const result=await planEvent(ev,[person],[nextDayOnly],settings);
 const plan=result.plans.get('P-001');
 assert.equal(plan.returning.length>0,true);
 assert.ok(plan.returning.some(x=>x.date==='2026-11-30'));
});

test('three available days remain visible in a three-option shortlist',async()=>{
 const result=await planEvent(ev,[person],[feed],{...settings,maxOptions:3});
 const plan=result.plans.get('P-001');
 assert.deepEqual([...new Set(plan.outward.map(r=>parisDate(r.date,r.departure)))].sort(),
   ['27/11/2026','28/11/2026','29/11/2026']);
 assert.deepEqual([...new Set(plan.returning.map(r=>parisDate(r.date,r.departure)))].sort(),
   ['29/11/2026','30/11/2026','01/12/2026'].sort());
});
