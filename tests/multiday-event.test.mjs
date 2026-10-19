import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {travelDates,shiftDate,planEvent,compareJourneys,pickItineraries} from '../site/event-planner.mjs';
import {buildFormsRows} from '../site/google-forms-export.mjs';
import {buildOrganizer,buildIndividual,bytes} from '../site/excel-exports.mjs';
import {parisDate,parisInstant} from '../site/time-zones.mjs';
const d='2026-11-29';
const ev={title:'Spectacle le 29',destination:'Paris',
  startDate:d,startTime:'14:00',endDate:d,endTime:'23:00',
  outwardDate:'',returnDate:'',arrivalMargin:60,departureMargin:30,
  includeOutward:true,includeReturn:true};
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Brest',outwardDate:'',returnDate:'',notes:''};
function trip(direction,code,dtime,atime){
  const a=direction==='A'?0:1,b=direction==='A'?1:0;
  return [0,'TGV','',code,[[a,dtime,dtime,1,0],[b,atime,atime,0,1]]];
}
const feed={source:{id:'sncf',label:'SNCF Voyageurs',mode:'rail'},data:{
  meta:{first:'2026-11-20',last:'2026-12-15',timezone:'Europe/Paris'},
  stations:[['Brest','Brest'],['Paris','Paris']],
  services:[Buffer.alloc(5,255).toString('base64')],
  trips:[
    trip('A','NIGHT',23*3600+15*60,36*3600), // Previous day 23:15 → next day 12:00
    trip('A','MID',8*3600,11*3600+20*60),   // Same day 08:00 → 11:20
    trip('A','EARLY',5*3600,9*3600),         // Same day 05:00 → 09:00
    trip('R','LATE',23*3600+50*60,28*3600), // Leave 23:50; arrives tomorrow
    trip('R','NEXT',7*3600,12*3600)         // 07:00 next day
  ]
}};
const settings={mode:'rail',connections:'no',buffer:'very_cautious',maxOptions:3};
test('date shifts handle months and DST without fixed number of days',()=>{
 assert.equal(shiftDate(d,-10),'2026-11-19');
 assert.equal(shiftDate(d,10),'2026-12-09');
 assert.equal(shiftDate('2026-10-25',-1),'2026-10-24');
 assert.equal(shiftDate('2026-10-25',1),'2026-10-26');
 assert.deepEqual(travelDates(ev,person,'A'),[]);
 assert.deepEqual(travelDates(ev,person,'R'),[]);
 assert.deepEqual(travelDates({...ev,outwardDate:'2026-11-27'},person,'A'),['2026-11-27']);
 assert.deepEqual(travelDates(ev,{...person,returnDate:'2026-12-03'},'R'),['2026-12-03']);
});
test('arrival closest to required presence comes first, even when train departs the previous day',async()=>{
 const result=await planEvent(ev,[person],[feed],settings);
 const plan=result.plans.get('P-001');
 assert.ok(plan.outward.length>=2);
 assert.equal(plan.outward[0].date,'2026-11-28');
 assert.equal(parisDate(plan.outward[0].date,plan.outward[0].arrival),'29/11/2026');
 assert.equal(plan.outward[1].date,'2026-11-29');
 assert.ok(+parisInstant(plan.outward[0].date,plan.outward[0].arrival)>
   +parisInstant(plan.outward[1].date,plan.outward[1].arrival));
 const google=buildFormsRows(ev,[person],result.plans,'individuel',{batchId:'EV-NOVEMBER-29'});
 assert.match(google.rows.find(r=>r[7]==='A')[9],/28\/11\/2026.*29\/11\/2026/);
 const w=buildIndividual(ExcelJS,ev,person,result.plans);
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await bytes(w));
 assert.ok(reopened.getWorksheet('Mes choix'));
});
test('return options start with the FIRST departure after artist is free and venue-to-station margin',async()=>{
 const result=await planEvent(ev,[person],[feed],{...settings,maxOptions:4});
 const routes=result.plans.get('P-001').returning;
 assert.ok(routes.length>=2);
 assert.equal(routes[0].date,d);
 assert.equal(parisDate(routes[0].date,routes[0].arrival),'30/11/2026');
 assert.equal(routes[1].date,'2026-11-30');
 const google=buildFormsRows(ev,[person],result.plans,'individuel',{batchId:'EV-NOVEMBER-29'});
 assert.match(google.rows.find(r=>r[7]==='R')[9],/29\/11\/2026.*30\/11\/2026/);
 const excel=buildOrganizer(ExcelJS,ev,[person],result.plans);
 assert.equal(excel.getWorksheet('Retours').getCell('E9').value.includes('29/11/2026'),true);
});
test('with 1h access margin after 23h finish the 23:50 service is ruled out and 07:00 next day is offered',async()=>{
 const e={...ev,departureMargin:60};
 const result=await planEvent(e,[person],[feed],settings);
 const back=result.plans.get('P-001').returning;
 assert.ok(back.length>0);
 assert.equal(back[0].date,'2026-11-30');
 assert.equal(back[0].departure,7*3600);
});
test('search expands beyond 7 days if no closer journey is published',async()=>{
 const old={...ev,startDate:'2026-12-10',endDate:'2026-12-10',
   includeReturn:false,startTime:'09:00'};
 const distant={source:feed.source,data:{...feed.data,trips:[trip('A','DEPART',8*3600,12*3600)],
   services:[Buffer.from([1,0,0,0,0]).toString('base64')]}};
 const result=await planEvent(old,[person],[distant],settings);
 assert.equal(result.plans.get('P-001').outward.length,1);
 assert.equal(result.plans.get('P-001').outward[0].date,'2026-11-20');
});
test('an explicit traveler date is honored as the only eligible departure day',async()=>{
 const p={...person,outwardDate:'2026-11-29'};
 const res=await planEvent(ev,[p],[feed],settings);
 assert.ok(res.plans.get('P-001').outward.every(r=>r.date==='2026-11-29'));
});

test('last published GTFS service may depart at 25:00 on following calendar day',async()=>{
 const e={...ev,includeOutward:false,departureMargin:60,startDate:'2026-12-15',
   endDate:'2026-12-15',endTime:'23:00'};
 const finalFeed={source:feed.source,data:{...feed.data,meta:{...feed.data.meta,last:'2026-12-15'},
   trips:[[0,'TGV','','NIGHT-25',[[1,25*3600,25*3600,1,0],
     [0,29*3600,29*3600,0,1]]]],
   services:[Buffer.from([0,0,0,8]).toString('base64')]}};
 const res=await planEvent(e,[person],[finalFeed],settings);
 // Date index 25 relative to November 20: December 15.
 assert.equal(res.plans.get('P-001').returning.length,1);
 assert.equal(res.plans.get('P-001').returning[0].date,'2026-12-16');
 assert.equal(res.plans.get('P-001').returning[0].departure,3600);
});
