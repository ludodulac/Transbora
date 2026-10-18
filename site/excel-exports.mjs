/** Polished Excel exports built in the browser with ExcelJS 4.4.0.
 * No checkboxes requiring Excel-specific controls: the user types X in a large
 * yellow choice cell. Opens as ordinary XLSX on desktop and mobile.
 */
import {displayName, COLUMNS, MAX_PARTICIPANTS, plain} from './events-model.mjs';
import {parisDate,parisTime} from './time-zones.mjs';
import {durationText} from './engine.mjs';

const DEEP='15394D',MID='007F86',LIME='D8F3E9',PALE='EDF7F8',WHITE='FFFFFF',
  SOFT='F7FAFC',GOLD='FFF1BE',INK='163445',MUTED='5A7080',PINK='FCE8E3';
const header=(text)=>({font:{name:'Aptos',bold:true,size:11,color:{argb:'FF'+WHITE}},
  fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+MID}},
  alignment:{vertical:'middle',wrapText:true}});
const bg=(hex)=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+hex}});
const thin={style:'hair',color:{argb:'FFE2EAEE'}};
function ensureExcel(Excel=globalThis.ExcelJS) {
  if(!Excel?.Workbook)throw new Error('ExcelJS est indisponible. Vérifiez la connexion Internet et rechargez la page.');
  return Excel;
}
function workbook(Excel){
  const x=new (ensureExcel(Excel)).Workbook();
  x.creator='Transbora';x.lastModifiedBy='Transbora';
  x.created=new Date();x.modified=new Date();
  x.calcProperties.fullCalcOnLoad=true;
  return x;
}
function title(sheet,main,subtitle,through=8){
  sheet.mergeCells(1,1,1,through);
  const top=sheet.getCell(1,1);
  top.value=main;top.font={name:'Aptos Display',size:19,bold:true,color:{argb:'FF'+WHITE}};
  top.fill=bg(DEEP);top.alignment={vertical:'middle',indent:1};
  sheet.getRow(1).height=44;
  sheet.mergeCells(2,1,2,through);
  const sub=sheet.getCell(2,1);
  sub.value=subtitle;sub.font={name:'Aptos',size:11,color:{argb:'FF'+DEEP}};
  sub.fill=bg(PALE);sub.alignment={vertical:'middle',indent:1,wrapText:true};
  sheet.getRow(2).height=36;
}
function wideHeader(sheet,row,cols){
  const r=sheet.getRow(row);r.values=[,...cols];r.height=32;
  r.eachCell(cell=>Object.assign(cell,header()));
  sheet.autoFilter={from:{row,column:1},to:{row,column:cols.length}};
  sheet.views=[{state:'frozen',xSplit:2,ySplit:row,activeCell:'A'+(row+1)}];
}
function rowDecoration(sheet,row,editableColumn=1){
  const r=sheet.getRow(row);r.height=53;
  r.eachCell({includeEmpty:true},(cell,col)=>{
    cell.font={name:'Aptos',size:10,color:{argb:'FF'+INK}};
    cell.alignment={vertical:'middle',wrapText:true,horizontal:col===editableColumn?'center':'left'};
    cell.fill=bg(col===editableColumn?GOLD:row%2?WHITE:SOFT);
    cell.border={bottom:thin};
    if(col===editableColumn){cell.font={bold:true,size:15,color:{argb:'FF'+MID}};}
  });
  const chosen=sheet.getCell(row,editableColumn);
  chosen.dataValidation={
    type:'list',allowBlank:true,formulae:['"X,x"'],
    error:'Écrivez X pour retenir cette proposition',showErrorMessage:true
  };
}
function setWidths(sheet,widths){
  widths.forEach((width,i)=>sheet.getColumn(i+1).width=width);
}
function notesSheet(book){
  const s=book.addWorksheet('Aide');
  s.getColumn(1).width=5;s.getColumn(2).width=34;s.getColumn(3).width=74;
  title(s,'📘 MODE D’EMPLOI','Un fichier Excel pensé pour tous les téléphones et ordinateurs.',3);
  const instructions=[
    ['1 · Sélection','Dans les feuilles de propositions, inscrivez X dans la cellule jaune de votre trajet préféré.'],
    ['2 · Aller / Retour','Choisissez au maximum UN trajet pour chaque sens demandé (aller, retour ou les deux).'],
    ['3 · Enregistrement','Enregistrez le fichier Excel (.xlsx) sans effacer les colonnes masquées.'],
    ['4 · Retour','Renvoyez le fichier modifié à Jeanne par e-mail ou messagerie. Elle peut le réimporter dans Transbora.'],
    ['5 · Réservation','Les choix sont des demandes. Jeanne confirme prix, place et horaires avant d’acheter les billets.'],
    ['6 · Sécurité','Les horaires sont théoriques ; les marges de correspondance ne constituent pas une garantie.'],
    ['7 · Partage','Chaque fichier individuel ne contient que les choix de son destinataire.'],
    ['Compatibilité','Le X fonctionne dans Excel, Excel Mobile, Google Sheets et les autres lecteurs .xlsx, même sans case à cocher native.'],
  ];
  instructions.forEach((row,index)=>{
    const r=index+4;s.getCell(r,2).value=row[0];s.getCell(r,3).value=row[1];
    s.getRow(r).height=52;
    for(const c of [2,3]){
      const cell=s.getCell(r,c);
      cell.font={name:'Aptos',size:c===2?11:10,bold:c===2,color:{argb:'FF'+(c===2?MID:INK)}};
      cell.fill=bg(index%2?WHITE:SOFT);cell.alignment={vertical:'middle',wrapText:true};
    }
  });
  s.views=[{state:'frozen',ySplit:2}];
}
function serializeLeg(j,date){
  return (j.legs?.length?j.legs:[j]).map((l,index)=>{
    const line=(index+1)+'· '+l.from+' ('+parisTime(date,l.departure)+') → '+
      l.to+' ('+parisTime(date,l.arrival)+') · '+l.provider+(l.number?' n° '+l.number:'');
    return line;
  }).join('\n');
}
function transferText(j){
  const changes=j.transfers||(j.transfer?[j.transfer]:[]);
  return changes.length?changes.map((t,i)=>
    (i+1)+'· '+t.station+(t.departureStation!==t.station?' → '+t.departureStation:'')
    +' · attente '+durationText(t.waitingSeconds)+' (marge '+durationText(t.minimumSeconds)+')'
  ).join('\n'):'Direct · aucun changement';
}
function optionsSheet(book,name,rows,event,{individual=false}={}){
  const sheet=book.addWorksheet(name);
  sheet.properties.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1};
  setWidths(sheet,individual?[16,14,13,21,21,37,34,25,17,15,14,14]:[15,23,23,15,20,20,14,41,32,14,14,14]);
  const total=individual?9:12;
  title(sheet,individual?'🚆 MES PROPOSITIONS':'🚆 '+name.toUpperCase(),
    (event.title||'Événement')+' · Les cellules JAUNES se marquent avec X, une par sens.',total);
  if(individual){
    sheet.getCell('A3').value='Voyageur';sheet.getCell('B3').value=displayName(rows[0]?.participant||{});
    sheet.getCell('A4').value='Code';sheet.getCell('B4').value=rows[0]?.participant?.id||'';
    sheet.getCell('A5').value='Événement';sheet.getCell('B5').value=event.title;
    sheet.getCell('A6').value='Destination';sheet.getCell('B6').value=event.destination;
    sheet.getRow(3).height=24;sheet.getRow(4).height=24;sheet.getRow(5).height=24;sheet.getRow(6).height=24;
    for(const index of [3,4,5,6]){
      sheet.getCell('A'+index).font={bold:true,color:{argb:'FF'+MID}};
    }
  }else{
    sheet.mergeCells('A4:G4');sheet.getCell('A4').value='Indiquez X pour une proposition par voyageur et par sens.';
    sheet.getCell('A4').font={bold:true,color:{argb:'FF'+MID}};
  }
  const headers=individual?
    ['CHOIX X','Sens','Option','Départ','Arrivée','Trajet','Correspondances','Transporteurs','Durée','Code voyageur','Sens interne','ID trajet']:
    ['CHOIX X','Participant','Ville d’origine','Option','Départ','Arrivée','Durée','Trajet','Correspondances','Code voyageur','Sens interne','ID trajet'];
  wideHeader(sheet,8,headers);
  rows.forEach((entry,i)=>{
    const j=entry.option,day=entry.date,idx=i+9;
    const common=[entry.choice||'',displayName(entry.participant),entry.participant.departure,
      entry.number,parisDate(day,j.departure)+' '+parisTime(day,j.departure),
      parisDate(day,j.arrival)+' '+parisTime(day,j.arrival),
      durationText(j.arrival-j.departure),serializeLeg(j,day),transferText(j),
      entry.participant.id,entry.direction,entry.key];
    const personal=[entry.choice||'',entry.direction==='A'?'ALLER':'RETOUR',entry.number,
      parisDate(day,j.departure)+' '+parisTime(day,j.departure),
      parisDate(day,j.arrival)+' '+parisTime(day,j.arrival),
      serializeLeg(j,day),transferText(j),
      [...new Set((j.legs||[j]).map(x=>x.provider))].join(', '),
      durationText(j.arrival-j.departure),entry.participant.id,entry.direction,entry.key];
    sheet.getRow(idx).values=[,...(individual?personal:common)];
    rowDecoration(sheet,idx);
    sheet.getCell(idx,1).note='Marquez X pour choisir ce trajet. Un seul X par aller et par retour.';
  });
  const last=8+rows.length;
  sheet.autoFilter={from:{row:8,column:1},to:{row:Math.max(9,last),column:individual?9:9}};
  // Metadata cannot be deleted by a user; they are hidden but retained during reply import.
  [10,11,12].forEach(n=>sheet.getColumn(n).hidden=true);
  return sheet;
}
function rowsFor(participants,options,choices,direction){
  const out=[];
  for(const p of participants){
    const plan=options.get(p.id);if(!plan)continue;
    const items=direction==='A'?plan.outward:plan.returning;
    items.forEach((j,i)=>{
      const key=j.key;
      out.push({participant:p,option:j,number:i+1,direction,key,
        date:direction==='A'?plan.outwardDate:plan.returnDate,
        choice:choices?.[p.id]?.[direction]===key?'X':''});
    });
  }
  return out;
}
function statusTab(book,event,participants,options,choices){
  const sheet=book.addWorksheet('Réservations');
  setWidths(sheet,[14,24,21,22,24,25,21,23,28]);
  title(sheet,'📋 TABLEAU DE RÉSERVATION','Après réception des choix : vérifier horaires, disponibilité et prix avant chaque achat.',9);
  sheet.mergeCells('A4:I4');sheet.getCell('A4').value='Saisissez le statut en colonne H et le numéro de dossier en I. Ce fichier reste local à votre appareil.';
  const headers=['Code','Voyageur','Ville d’origine','Aller choisi','Retour choisi','Aller · date','Retour · date','Statut billet','Dossier / notes'];
  wideHeader(sheet,7,headers);
  participants.forEach((p,i)=>{
    const plan=options.get(p.id),ch=choices?.[p.id]||{};
    const outbound=plan?.outward.find(x=>x.key===ch.A),back=plan?.returning.find(x=>x.key===ch.R);
    const display=j=>j?parisDate(j.date,j.departure)+' '+parisTime(j.date,j.departure):'Non choisi';
    const departureDay=plan?.outwardDate||'—',returnDay=plan?.returnDate||'—';
    const row=i+8;
    const wantsA=event.includeOutward!==false,wantsR=event.includeReturn!==false;
    sheet.getRow(row).values=[,p.id,displayName(p),p.departure,
      !wantsA?'Non demandé':outbound?display({...outbound,date:departureDay}):plan?.outward.length?'Non choisi':'Aucun trajet',
      !wantsR?'Non demandé':back?display({...back,date:returnDay}):plan?.returning.length?'Non choisi':'Aucun trajet',
      wantsA?departureDay:'—',wantsR?returnDay:'—',
      (wantsA&&!outbound)||(wantsR&&!back)?'En attente':'À réserver',''];
    sheet.getRow(row).height=42;
    sheet.getRow(row).eachCell(cell=>{cell.font={name:'Aptos',size:10,color:{argb:'FF'+INK}};
      cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:thin};
      cell.fill=bg(i%2?WHITE:SOFT);});
    for(const col of [8,9])sheet.getCell(row,col).fill=bg(GOLD);
    sheet.getCell(row,8).dataValidation={
      type:'list',allowBlank:false,formulae:['"En attente,À réserver,Réservé,Annulé"']};
  });
  return sheet;
}
function titleSheet(book,event,n,covered,mode){
  const sheet=book.addWorksheet('Accueil');
  setWidths(sheet,[5,28,27,27,25,28,17,10]);
  title(sheet,'TRANSBORA · '+(mode==='organizer'?'DOSSIER ÉVÉNEMENT':'PROPOSITIONS PERSONNELLES'),
    'Prêt à envoyer · Consultez « Aide » puis sélectionnez vos trajets en marquant X.',8);
  const rows=[
    ['Événement',event.title],['Lieu',event.destination],['Participants',n],
    ['Début',event.startDate+' à '+event.startTime],
    ['Fin',event.endDate+' à '+event.endTime],
    ['Options disponibles',covered],
    ['Version','Horaires théoriques, prix et places non vérifiés'],
    ['Édition','Transbora · fichier .xlsx']
  ];
  rows.forEach(([k,v],i)=>{
    const at=4+i;sheet.mergeCells(at,2,at,3);sheet.mergeCells(at,4,at,7);
    sheet.getCell(at,2).value=k;sheet.getCell(at,4).value=v;
    sheet.getCell(at,2).font={name:'Aptos',bold:true,color:{argb:'FF'+MID},size:11};
    sheet.getCell(at,4).font={name:'Aptos',color:{argb:'FF'+INK},size:11};
    for(const col of [2,4])sheet.getCell(at,col).fill=bg(i%2?PALE:WHITE);
    sheet.getRow(at).height=35;
  });
  sheet.views=[{state:'frozen',ySplit:2}];
}
export function buildTemplate(Excel){
  const book=workbook(Excel),sheet=book.addWorksheet('Participants');
  title(sheet,'📥 MODÈLE PARTICIPANTS','Remplissez les trois premières colonnes. Dates au format AAAA-MM-JJ si différentes des dates de l’événement.',6);
  sheet.mergeCells('A3:F3');
  sheet.getCell('A3').value='1 ligne = 1 voyageur · prénom, nom et ville obligatoires · ne modifiez pas les intitulés de colonnes';
  sheet.getCell('A3').font={bold:true,color:{argb:'FF'+MID}};
  setWidths(sheet,[22,23,27,27,28,33]);
  wideHeader(sheet,5,COLUMNS);
  for(let row=6;row<=45;row++){
    sheet.getRow(row).height=28;
    for(let c=1;c<=6;c++){
      const cell=sheet.getCell(row,c);cell.fill=bg(row%2?WHITE:SOFT);cell.border={bottom:thin};
      cell.font={name:'Aptos',size:10,color:{argb:'FF'+INK}};
    }
  }
  const guide=book.addWorksheet('Exemple et aide');
  setWidths(guide,[24,24,28,27,27,37]);
  title(guide,'📝 UN EXEMPLE À COPIER','Cet exemple n’est pas importé : saisissez vos vraies personnes dans la feuille « Participants ».',6);
  guide.getRow(5).values=[,...COLUMNS];wideHeader(guide,5,COLUMNS);
  guide.getRow(6).values=[,'Sophie','Martin','Brest','2026-11-24','2026-11-26','Voyage en train souhaité'];
  guide.getRow(7).values=[,'Marc','Dubois','Nantes','','','Dates par défaut de l’événement'];
  for(let x of [6,7]){guide.getRow(x).height=40;rowDecoration(guide,x,1);}
  notesSheet(book);
  return book;
}
export function buildOrganizer(Excel,event,participants,options,choices={}){
  const book=workbook(Excel);
  const a=event.includeOutward===false?[]:rowsFor(participants,options,choices,'A');
  const r=event.includeReturn===false?[]:rowsFor(participants,options,choices,'R');
  titleSheet(book,event,participants.length,a.length+r.length,'organizer');
  statusTab(book,event,participants,options,choices);
  if(event.includeOutward!==false)optionsSheet(book,'Allers',a,event);
  if(event.includeReturn!==false)optionsSheet(book,'Retours',r,event);
  notesSheet(book);
  return book;
}
export function buildIndividual(Excel,event,participant,options,choices={}){
  const book=workbook(Excel);
  const a=event.includeOutward===false?[]:rowsFor([participant],options,choices,'A');
  const r=event.includeReturn===false?[]:rowsFor([participant],options,choices,'R');
  titleSheet(book,event,1,a.length+r.length,'individual');
  optionsSheet(book,'Mes choix',[...a,...r],event,{individual:true});
  notesSheet(book);
  return book;
}
export async function bytes(book){return book.xlsx.writeBuffer();}
export function fileName(text){
  return String(text||'transbora').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,85)||'transbora';
}
export function saveBytes(bytes,name,mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
  const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
  const link=document.createElement('a');link.href=url;link.download=name;link.style.display='none';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function parseWorksheetRows(sheet,max=250){
  const rows=[];
  const end=Math.min(sheet.rowCount,max);
  for(let row=1;row<=end;row++){
    const line=[];
    const r=sheet.getRow(row);
    for(let col=1;col<=Math.min(15,r.cellCount+1);col++)line.push(r.getCell(col).value);
    rows.push(line);
  }
  return rows;
}
export async function importTemplate(Excel,buffer){
  const book=workbook(Excel);await book.xlsx.load(buffer);
  const sheet=book.getWorksheet('Participants')||book.worksheets[0];
  if(!sheet)throw new Error('Le fichier Excel ne contient aucune feuille.');
  const {fromRows}=await import('./events-model.mjs');
  return fromRows(parseWorksheetRows(sheet,300),{max:MAX_PARTICIPANTS});
}
export async function readDecisions(Excel,buffer,existingParticipants,plans){
  const book=workbook(Excel);await book.xlsx.load(buffer);
  const chosen=[],warnings=[];
  const known=new Set(existingParticipants.map(p=>p.id));
  let sheets=['Allers','Retours'].map(name=>book.getWorksheet(name)).filter(Boolean);
  const personal=book.getWorksheet('Mes choix');
  if(personal)sheets=[personal];
  if(!sheets.length)throw new Error('Fichier non reconnu : aucune feuille Allers/Retours ou Mes choix.');
  for(const sheet of sheets){
    for(let r=9;r<=sheet.rowCount;r++){
      const row=sheet.getRow(r);
      if(plain(row.getCell(1).value).toUpperCase()!=='X')continue;
      const id=plain(row.getCell(10).value);
      const type=plain(row.getCell(11).value);
      const route=plain(row.getCell(12).value);
      if(!known.has(id) || !['A','R'].includes(type)){
        warnings.push('Ligne '+r+' ('+sheet.name+') : participant ou sens inconnu.');continue;
      }
      const options=plans.get(id);
      const list=type==='A'?options?.outward:options?.returning;
      if(!list?.some(item=>item.key===route)){
        warnings.push('Ligne '+r+' ('+sheet.name+') : proposition inconnue ou modifiée.');continue;
      }
      chosen.push({id,type,route});
    }
  }
  const duplicates=new Map(),choices={};
  for(const entry of chosen){
    const key=entry.id+':'+entry.type;
    duplicates.set(key,(duplicates.get(key)||0)+1);
    (choices[entry.id]||={})[entry.type]=entry.route;
  }
  for(const [key,count] of duplicates)if(count!==1){
    warnings.push('Plusieurs X pour '+key+' : choix ignorés.');
    const [id,type]=key.split(':');delete choices[id][type];
  }
  return {choices,warnings,chosen:chosen.length};
}
