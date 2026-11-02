/** TRANSBORA — small self-hosted PDF generator for monthly travel registers.
 *
 * Downloading is independent of the browser's Print/Save as PDF dialog.
 * No third-party scripts, network calls, account tokens, or personal data
 * stored outside the user's explicit PDF file download.
 *
 * A4 landscape, repeating table headings, automatic page breaks, built-in
 * WinAnsi fonts (French accents and EUR), and a visible unknown-price warning.
 */
import {fileName} from './organizer-monthly-export.mjs';

const WIDTH=841.89,HEIGHT=595.28,MARGIN=22;
const LEFT=MARGIN,RIGHT=WIDTH-MARGIN,TOP=23;
const BOTTOM=HEIGHT-51;
const COLS=[
 {name:'Date',width:60},
 {name:'Événement',width:116},
 {name:'Artiste',width:92},
 {name:'Sens',width:41},
 {name:'Itinéraire',width:196},
 {name:'Horaires',width:74},
 {name:'Chx',width:32},
 {name:'R',width:19},
 {name:'E',width:19},
 {name:'Prix payé',width:68},
 {name:'Statut',width:80}
];
const PAGE_PREFIX='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
const charCodes=new Map([
 [0x20ac,128],[0x201a,130],[0x0192,131],[0x201e,132],
 [0x2026,133],[0x2020,134],[0x2021,135],[0x02c6,136],
 [0x2030,137],[0x0160,138],[0x2039,139],[0x0152,140],
 [0x017d,142],[0x2018,145],[0x2019,146],[0x201c,147],
 [0x201d,148],[0x2022,149],[0x2013,150],[0x2014,151],
 [0x02dc,152],[0x2122,153],[0x0161,154],[0x203a,155],
 [0x0153,156],[0x017e,158],[0x0178,159]
]);
const fmtDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?
 s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):String(s||'');
const money=value=>value==null?'?':new Intl.NumberFormat('fr-FR',{
 minimumFractionDigits:2,maximumFractionDigits:2
}).format(value/100)+' EUR';
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const approxWidth=(value,size)=>[...String(value)].reduce((a,ch)=>
 a+(ch===' '?0.29:/[ilI1.,:;]/.test(ch)?0.25:/[mwMW@]/.test(ch)?0.8:0.53)*size,0);
function lineWrap(value,width,fontSize,maxLines=2){
 let text=clean(value);
 if(!text)return [''];
 const words=text.split(' ');
 const lines=[];
 let current='';
 for(const token of words){
  const next=current?current+' '+token:token;
  if(approxWidth(next,fontSize)<=width){current=next;continue;}
  if(current){lines.push(current);current='';}
  if(approxWidth(token,fontSize)<=width){current=token;continue;}
  // Very long references or proper nouns also fit inside the cell.
  let partial='';
  for(const ch of token){
   if(approxWidth(partial+ch,fontSize)>width&&partial){
    lines.push(partial);partial='';
   }
   partial+=ch;
  }
  current=partial;
 }
 if(current)lines.push(current);
 if(lines.length<=maxLines)return lines;
 const out=lines.slice(0,maxLines);
 let last=out[maxLines-1];
 while(last&&approxWidth(last+'...',fontSize)>width)last=last.slice(0,-1);
 out[maxLines-1]=last+'...';
 return out;
}
function octalLiteral(value){
 let result='';
 for(const char of String(value??'')){
  const cp=char.codePointAt(0);
  let code=cp>=32&&cp<=255?cp:charCodes.get(cp);
  if(code==null)code=63;
  if(code===40||code===41||code===92)
   result+='\\'+String.fromCharCode(code);
  else if(code<32||code>126)
   result+='\\'+code.toString(8).padStart(3,'0');
  else result+=String.fromCharCode(code);
 }
 return result;
}
function fmtNum(value){return Number(value.toFixed(2)).toString();}
function pagePainter(){
 let stream='';
 function colorRGB(hex){
  const n=hex.match(/[0-9a-fA-F]{2}/g).map(x=>parseInt(x,16)/255);
  return n.map(fmtNum).join(' ');
 }
 function rectangle(x,top,width,height,hex){
  stream+=colorRGB(hex)+' rg\n'+
   [x,HEIGHT-top-height,width,height].map(fmtNum).join(' ')+' re f\n';
 }
 function text(value,x,top,{size=7.6,bold=false,color='203e4b'}={}){
  const baseline=HEIGHT-top-size;
  stream+='BT /'+(bold?'F2':'F1')+' '+fmtNum(size)+
   ' Tf '+colorRGB(color)+' rg 1 0 0 1 '+
   fmtNum(x)+' '+fmtNum(baseline)+' Tm ('+
   octalLiteral(value)+') Tj ET\n';
 }
 function line(x,y,x2,y2,hex='dce7e9',thickness=0.6){
  stream+=colorRGB(hex)+' RG '+fmtNum(thickness)+' w '+
   [x,HEIGHT-y].map(fmtNum).join(' ')+' m '+
   [x2,HEIGHT-y2].map(fmtNum).join(' ')+' l S\n';
 }
 return {rectangle,text,line,source:()=>stream};
}
function pageHeading(p,register,label,{person=false}={}){
 const title=person?'FICHE DE DÉPLACEMENTS':'DÉPLACEMENTS DU MOIS';
 p.text('TRANSBORA',LEFT,TOP,{size:13.3,bold:true,color:'087f85'});
 p.text(title,LEFT,TOP+19,{size:18,bold:true,color:'15394d'});
 const subject=person?label:'Tous les artistes';
 p.text(subject,LEFT,TOP+44,{size:10.8,bold:true,color:'274d58'});
 p.text('Mois : '+register.month,RIGHT-103,TOP+46,{size:10,color:'274d58'});
 p.line(LEFT,TOP+66,RIGHT,TOP+66,'b6dcd7',1.25);
 const s=register.summary;
 p.text(s.travels+' proposition(s)  -  '+s.selected+' choix n°1  -  '+
  s.paid+' achat(s)  -  '+money(s.paidKnownCents)+' connus',
  LEFT,TOP+72,{size:9.4,bold:true,color:'245f60'});
 if(s.paidUnknown)p.text('ATTENTION : '+s.paidUnknown+
  ' billet(s) payé(s) sans prix enregistré.',LEFT,TOP+86,
  {size:8.8,bold:true,color:'a55319'});
 else p.text('Chx = rang du choix  |  R = panier  |  E = billet acheté',
  LEFT,TOP+86,{size:8.6,color:'54717a'});
}
function tableHeading(p,top){
 p.rectangle(LEFT,top,RIGHT-LEFT,25,'15394d');
 let x=LEFT;
 for(const col of COLS){
  p.text(col.name,x+4,top+8,{size:7.25,bold:true,color:'ffffff'});
  x+=col.width;
 }
}
function rowCells(row){
 const legs=row.legs||[];
 const from=clean(row.from||'—'),to=clean(row.to||'—');
 const via=legs.length>1?
  ' (via '+legs.slice(0,-1).map(l=>l.to).filter(Boolean).join(', ')+')':'';
 const itinerary=from+' > '+to+via;
 const departure=clean(row.departure),arrival=clean(row.arrival);
 const timetable=departure&&arrival?departure+' - '+arrival:departure||arrival||'—';
 return [
 fmtDate(row.date),row.event||'—',row.person||'—',row.direction||'—',
 itinerary,timetable,row.choiceRank||'—',row.cart?'X':'',row.paid?'X':'',
 row.paid?(row.paidCents==null?'?':money(row.paidCents)):'—',
 row.pending?'À rechercher':row.stage||'Proposé'
 ];
}
function paintRow(p,row,top,index){
 const values=rowCells(row);
 const wrapped=values.map((v,i)=>lineWrap(v,COLS[i].width-8,
  i===4?7.1:i===1||i===2?7.25:7.15, i===4?3:2));
 const lines=wrapped.reduce((m,l)=>Math.max(m,l.length),1);
 const h=Math.max(24,9+11*lines);
 p.rectangle(LEFT,top,RIGHT-LEFT,h,
  row.paid?'e9f7ed':row.pending?'fff3dc':index%2?'f3f8f9':'ffffff');
 let x=LEFT;
 for(let i=0;i<COLS.length;i++){
  const col=COLS[i],cellLines=wrapped[i];
  for(let n=0;n<cellLines.length;n++)
   p.text(cellLines[n],x+4,top+5+n*10.6,{
    size:i===4?7.1:7.15,bold:i===6&&Boolean(row.choiceRank),
    color:i===6&&row.choiceRank?'087f85':'203e4b'
   });
  x+=col.width;
 }
 p.line(LEFT,top+h,RIGHT,top+h,'e0e8ea',.4);
 return h;
}
function assemblePages(register,label,options){
 const pages=[];
 let painter=null,top=0,index=0;
 function newPage(){
  if(painter)pages.push(painter);
  painter=pagePainter();
  pageHeading(painter,register,label,options);
  top=TOP+104;
  tableHeading(painter,top);
  top+=25;
 }
 newPage();
 for(const row of register.rows){
  const cells=rowCells(row);
  const wrapped=cells.map((v,i)=>lineWrap(v,COLS[i].width-8,
    i===4?7.1:7.15,i===4?3:2));
  const lines=wrapped.reduce((m,l)=>Math.max(m,l.length),1);
  const height=Math.max(24,9+11*lines);
  if(top+height>BOTTOM)newPage();
  top+=paintRow(painter,row,top,index++);
 }
 if(!register.rows.length)painter.text('Aucun déplacement pour la période.',
  LEFT+10,top+15,{size:11,color:'58717b'});
 pages.push(painter);
 const count=pages.length;
 return pages.map((p,i)=>{
  p.line(LEFT,HEIGHT-38,RIGHT,HEIGHT-38,'b6dcd7',.65);
  p.text('Prix, places et horaires à vérifier auprès des transporteurs.',
   LEFT,HEIGHT-33,{size:7.4,color:'59747d'});
  p.text('Page '+(i+1)+' / '+count,RIGHT-73,HEIGHT-33,{size:7.4,color:'59747d'});
  return p.source();
 });
}
function pdfBytes(contentStreams){
 const count=contentStreams.length;
 const objects=4+2*count;
 const offsets=new Array(objects+1).fill(0);
 let size=0;
 const pieces=[];
 const push=s=>{pieces.push(s);size+=s.length;};
 const obj=(id,body)=>{offsets[id]=size;push(id+' 0 obj\n'+body+'\nendobj\n');};
 push(PAGE_PREFIX);
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 const kids=contentStreams.map((_,i)=>(5+i*2)+' 0 R').join(' ');
 obj(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+count+' >>');
 obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 for(let i=0;i<count;i++){
  const pageId=5+i*2,streamId=pageId+1,src=contentStreams[i];
  obj(pageId,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+
   WIDTH+' '+HEIGHT+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> '+
   '/Contents '+streamId+' 0 R >>');
  obj(streamId,'<< /Length '+src.length+' >>\nstream\n'+src+'endstream');
 }
 const xref=size;
 push('xref\n0 '+(objects+1)+'\n0000000000 65535 f \n');
 for(let id=1;id<=objects;id++)
  push(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Size '+(objects+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 // PDF source streams contain only ASCII escapes, except the PDF header bytes.
 const output=new Uint8Array(size);
 let position=0;
 for(const part of pieces){
  for(let i=0;i<part.length;i++)output[position++]=part.charCodeAt(i)&255;
 }
 return output;
}
export function monthlyTravelPdf(register,{personName=''}={}){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(register?.month||'')||
  !Array.isArray(register.rows)||!register.summary)
  throw Error('Tableau mensuel incomplet.');
 const label=personName||'Tous les artistes';
 const pages=assemblePages(register,label,{person:Boolean(personName)});
 return pdfBytes(pages);
}
export function travelPdfName(register,{personName=''}={}){
 return fileName(personName?'FICHE':'MOIS',register.month,personName,'pdf');
}
