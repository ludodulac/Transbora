import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {planEvent} from '../site/event-planner.mjs';
import {buildOrganizer,buildIndividual,bytes} from '../site/excel-exports.mjs';

const date='2026-10-29';
const person={id:'P-001',first:'Sophie',last:'Martin',departure:'Toulouse',
  outwardDate:'',returnDate:'',notes:''};
const baseEvent={title:'Rencontre du 29',destination:'Paris',
  startDate:date,startTime:'14:00',endDate:date,endTime:'18:00',
  outwardDate:date,returnDate:date,arrivalMargin:90,departureMargin:45};
const feed={
  source:{id:'sncf',label:'SNCF Voyageurs',mode:'rail'},
  data:{meta:{first:'2026-10-25',last:'2026-10-31',timezone:'Europe/Paris'},
    stations:[['s1','Toulouse'],['s2','Paris']],
    services:['fw=='],
    trips:[
      [0,'TGV','Paris','101',[[0,25200,25200,1,0],[1,36000,36000,0,1]]],
      [0,'TGV','Toulouse','102',[[1,72000,72000,1,0],[0,82800,82800,0,1]]]
    ]}
};
const settings={mode:'all',connections:'no',buffer:'very_cautious',maxOptions:3};
test('same-day 29 event searches 29, never arbitrary initial 25',async()=>{
  const event={...baseEvent,includeOutward:true,includeReturn:true};
  const result=await planEvent(event,[person],[feed],settings);
  const plan=result.plans.get('P-001');
  assert.equal(plan.outwardDate,date);
  assert.equal(plan.returnDate,date);
  assert.ok(plan.outward.length);
  assert.ok(plan.returning.length);
  assert.ok(plan.outward.every(x=>x.date===date));
  assert.ok(plan.returning.every(x=>x.date===date));
});
test('outbound only means no return search and no return Excel sheet',async()=>{
  const event={...baseEvent,includeOutward:true,includeReturn:false};
  const result=await planEvent(event,[person],[feed],settings);
  const plan=result.plans.get('P-001');
  assert.ok(plan.outward.length);
  assert.equal(plan.returning.length,0);
  const book=buildOrganizer(ExcelJS,event,[person],result.plans);
  assert.ok(book.getWorksheet('Allers'));
  assert.equal(book.getWorksheet('Retours'),undefined);
  assert.equal(book.getWorksheet('Réservations').getCell('E8').value,'Non demandé');
  const individual=buildIndividual(ExcelJS,event,person,result.plans);
  assert.equal(individual.getWorksheet('Mes choix').rowCount,8+plan.outward.length);
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await bytes(individual));
  assert.equal(reopened.getWorksheet('Mes choix').getCell('K9').value,'A');
});
test('return only means no outbound search or outbound sheet',async()=>{
  const event={...baseEvent,includeOutward:false,includeReturn:true};
  const result=await planEvent(event,[person],[feed],settings);
  const plan=result.plans.get('P-001');
  assert.equal(plan.outward.length,0);
  assert.ok(plan.returning.length);
  const book=buildOrganizer(ExcelJS,event,[person],result.plans);
  assert.equal(book.getWorksheet('Allers'),undefined);
  assert.ok(book.getWorksheet('Retours'));
  assert.equal(book.getWorksheet('Réservations').getCell('D8').value,'Non demandé');
});
