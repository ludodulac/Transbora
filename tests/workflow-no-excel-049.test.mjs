import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('049: main organizer workflow has no XLSX/download prompts, but still has in-app sheets and an optional backup in Settings',async()=>{
 const html=readFileSync(new URL('../site/organisation.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../site/organisation-app.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/events.css',import.meta.url),'utf8');
 assert.doesNotMatch(html,/ExcelJS|exceljs|Fiche Excel|Excel du mois|export-month-xlsx|export-person-xlsx/i);
 assert.doesNotMatch(js,/downloadMonth|ledgerXlsx|export-month-xlsx|export-person-xlsx/i);
 assert.match(css,/\.embedded-workspace \.secondary-import/);
 assert.match(css,/\.embedded-workspace \.legacy-excel/);
 assert.match(html,/id="print-person"/);
 assert.match(html,/id="export-backup"/);
 assert.match(html,/id="restore-demo-file"/);
 const dom=new JSDOM(html,{
  url:'https://deploy-preview-45--transbora-ludo.netlify.app/organisation.html',
  pretendToBeVisual:true
 });
 const w=dom.window;
 globalThis.window=w;globalThis.document=w.document;
 globalThis.location=w.location;globalThis.history=w.history;
 globalThis.FormData=w.FormData;
 globalThis.fetch=async()=>{throw Error('The local rehearsal must not call a private server.');};
 await import('../site/organisation-app.mjs');
 await new Promise(resolve=>setTimeout(resolve,80));
 const $=id=>w.document.getElementById(id);
 assert.equal($('panel-overview').hidden,false);
 $('month-filter').value='2026-10';
 $('month-filter').dispatchEvent(new w.Event('change'));
 $('month-person').value='sophie-demo';
 $('month-person').dispatchEvent(new w.Event('change'));
 assert.equal($('person-sheet-actions').hidden,false);
 assert.match($('person-sheet-title').textContent,/Sophie/);
 assert.match($('month-register-body').textContent,/Sophie/);
 $('view-person-month').click();
 await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal($('month-output').hidden,false);
 assert.match($('month-output').textContent,/Mulhouse/);
 $('tabs').querySelector('[data-tab=team]').click();
 assert.equal($('panel-team').hidden,false);
 assert.equal($('export-backup').hidden,false);
 w.close();
});
