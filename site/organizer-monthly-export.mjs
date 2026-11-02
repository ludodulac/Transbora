/** Private exports of Jeanne's monthly travel ledger. Client-side only.
 * Browser ExcelJS is already used by the existing event XLSX exports.
 * PDF option intentionally uses the browser print dialog / Save as PDF.
 */
const safeName=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'voyageur';
const money=v=>v==null?'Inconnu':(v/100).toFixed(2);
const fmtDate=v=>/^\d{4}-\d\d-\d\d$/.test(v||'')?
 v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):String(v||'');
export const fileName=(prefix,month,label='',ext='xlsx')=>
 'TRANSBORA_'+prefix+'_'+month+(label?'_'+safeName(label):'')+'.'+ext;
export const monthColumns=['Date','Événement','Artiste','Sens','Départ','Heure',
 'Arrivée','Heure arrivée','Chx','R','E','Statut','Prix payé (€)','Prix prévu (€)','Dossier'];
export function ledgerValues(row){
 return [fmtDate(row.date),row.event,row.person,row.direction,row.from,row.departure,
  row.to,row.arrival,row.choiceRank?String(row.choiceRank):'',
  row.cart?'X':'',row.paid?'X':'',row.stage,
  row.paid?row.paidCents==null?'?':row.paidCents/100:'',
  row.estimateCents==null?'':row.estimateCents/100,
  row.receiptReference||''];
}
export async function ledgerWorkbook(register,{label='',Excel=globalThis.ExcelJS}={}){
 if(!Excel?.Workbook)throw Error('Export Excel indisponible : rechargez la page avec une connexion Internet.');
 const wb=new Excel.Workbook();
 wb.creator='TRANSBORA';
 wb.calcProperties.fullCalcOnLoad=true;
 const sheet=wb.addWorksheet('Trajets du mois',{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1}});
 const columns=[14,27,24,11,22,12,22,14,8,7,7,16,17,17,23];
 columns.forEach((w,i)=>{sheet.getColumn(i+1).width=w;});
 for(const index of [13,14])sheet.getColumn(index).numFmt='#,##0.00 "€"';
 sheet.mergeCells(1,1,1,15);
 const t=sheet.getCell('A1');t.value=label?'TRANSBORA — '+label:'TRANSBORA — Déplacements';
 t.font={bold:true,size:18,color:{argb:'FFFFFFFF'}};
 t.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF15394D'}};
 sheet.getRow(1).height=35;
 sheet.mergeCells(2,1,2,15);
 const note=sheet.getCell('A2');
 note.value='Mois : '+register.month+' · Chx = option retenue (1 / 2) · R = panier · E = billet acheté · ? = montant payé inconnu';
 note.font={size:10,color:{argb:'FF15394D'}};
 sheet.getRow(2).height=28;
 sheet.addRow(monthColumns);
 sheet.getRow(3).height=31;
 sheet.getRow(3).eachCell(cell=>{
  cell.font={bold:true,color:{argb:'FFFFFFFF'}};
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF087F85'}};
  cell.alignment={wrapText:true,vertical:'middle'};
 });
 for(const row of register.rows){
  const line=sheet.addRow(ledgerValues(row));
  line.height=31;
  line.eachCell(cell=>{
   cell.alignment={wrapText:true,vertical:'middle'};
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+
    (row.paid?'E3F6EB':row.pending?'FFF3D6':line.number%2?'FFFFFF':'F3F8FA')}};
  });
  if(row.paid&&row.paidCents==null)
    line.getCell(13).font={color:{argb:'FFAB4D11'},bold:true};
  if(row.choiceRank===1)line.getCell(9).font={bold:true,color:{argb:'FF087F85'}};
 }
 sheet.autoFilter={from:'A3',to:'O'+Math.max(3,sheet.rowCount)};
 sheet.views=[{state:'frozen',xSplit:3,ySplit:3}];
 const total=sheet.addRow([]);
 sheet.mergeCells(total.number,1,total.number,12);
 total.getCell(1).value='Total billets achetés avec montant connu';
 total.getCell(1).font={bold:true};
 total.getCell(13).value={
  formula:'SUM(M4:M'+Math.max(4,total.number-1)+')',
  result:register.summary.paidKnownCents/100
 };
 total.getCell(13).numFmt='#,##0.00 "€"';
 total.getCell(13).font={bold:true};
 sheet.mergeCells(total.number+1,1,total.number+1,15);
 sheet.getCell(total.number+1,1).value=
  'Billets achetés avec prix inconnu : '+register.summary.paidUnknown+
  '. Ce total ne comprend pas les options non achetées ou les alternatives.';
 sheet.getCell(total.number+1,1).font={italic:true,color:{argb:'FF755818'}};
 return wb;
}
export async function ledgerXlsx(register,args={}){
 const wb=await ledgerWorkbook(register,args);
 return wb.xlsx.writeBuffer();
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
export function ledgerPrintHtml(register,{label='Déplacements'}={}){
 const rows=register.rows.map(row=>'<tr>'+ledgerValues(row)
  .map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('');
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
 <title>${escape(label)} — ${escape(register.month)}</title>
 <style>
  @page{size:A4 landscape;margin:11mm}
  body{font:10pt system-ui,Arial,sans-serif;color:#1a3845}
  h1{margin:0;font-size:20pt}
  .muted{color:#576c72;margin:6px 0 14px}
  table{border-collapse:collapse;width:100%;font-size:7.2pt}
  th,td{border-bottom:1px solid #d5e3e6;padding:5px 3px;overflow-wrap:anywhere}
  th{background:#087f85;color:white;text-align:left}
  tr:nth-child(even){background:#f1f8f8}
  thead{display:table-header-group}tr{break-inside:avoid}
  footer{font-size:8pt;margin-top:15px}
 </style></head><body>
 <h1>TRANSBORA · ${escape(label)}</h1>
 <p class="muted">${escape(register.month)} — Chx : 1er / 2e choix · R : panier · E : billet acheté</p>
 <table><thead><tr>${monthColumns.map(x=>'<th>'+escape(x)+'</th>').join('')}</tr></thead>
 <tbody>${rows||'<tr><td colspan="15">Aucun déplacement.</td></tr>'}</tbody></table>
 <footer>Total des achats à montant connu : ${escape(money(register.summary.paidKnownCents))} €.
 Achats sans prix connu : ${register.summary.paidUnknown}.
 Horaires et disponibilités à vérifier avant achat.</footer>
 </body></html>`;
}
