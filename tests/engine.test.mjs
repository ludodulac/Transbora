import test from 'node:test';
import assert from 'node:assert/strict';
import {findDirect,timeText,dateText} from '../site/engine.mjs';

const example={
  meta:{first:'2026-11-24',last:'2026-11-26'},
  stations:[['L','Lorient'],['P','Paris']],
  services:['BQ==','Ag=='],
  trips:[
    [0,'TGV','Paris','123',[[0,28800,28800,1,0],[1,39600,39600,0,1]]],
    [1,'TGV','Paris','456',[[0,36000,36000,1,0],[1,46800,46800,0,1]]],
    [0,'Nuit','Paris','999',[[0,90000,90000,1,0],[1,99000,99000,0,1]]],
    [0,'Interdit','Paris','X',[[0,40000,40000,0,0],[1,50000,50000,0,1]]]
  ]
};
test('service dates, direct trains and midnight',()=>{
  assert.deepEqual(findDirect(example,0,1,'2026-11-24').map(t=>t.number),['123']);
  assert.deepEqual(findDirect(example,0,1,'2026-11-25').map(t=>t.number),['999','456']);
  assert.equal(findDirect(example,0,1,'2026-11-25')[0].departure,3600);
  assert.equal(findDirect(example,0,1,'2026-11-25','09:00').length,1);
});
test('no fabricated dates or forbidden boarding',()=>{
  assert.equal(findDirect(example,1,0,'2026-11-24').length,0);
  assert.equal(findDirect(example,0,0,'2026-11-24').length,0);
  assert.equal(findDirect(example,0,1,'2027-05-01').length,0);
  assert.equal(timeText(90000),'01:00');
  assert.equal(dateText('2026-11-25',99000),'26/11/2026');
});
