/** Pure helpers for event planning & imports; never store client data remotely. */
export const COLUMNS=['Prénom','Nom','Ville de départ','Date aller (AAAA-MM-JJ)','Date retour (AAAA-MM-JJ)','Notes (facultatif)'];
const HEADER_ALIASES=[
  ['prenom','first name','firstname','prénom'],
  ['nom','last name','lastname','family name'],
  ['ville de depart','depart','ville','origine','gare de depart','point de depart'],
  ['date aller aaaa mm jj','date aller','aller le','depart le'],
  ['date retour aaaa mm jj','date retour','retour le'],
  ['notes facultatif','notes','commentaires','remarques']
];
export function plain(value){
  if(value===undefined||value===null)return '';
  if(typeof value==='object'){
    if(value instanceof Date)return value.toISOString().slice(0,10);
    if(typeof value.text==='string')return value.text;
    if(Array.isArray(value.richText))return value.richText.map(x=>x.text||'').join('');
    if(value.result!==undefined)return plain(value.result);
  }
  return String(value).trim().replace(/[\u0000-\u001F]/g,' ').trim();
}
export function normalize(value){
  return plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
/** Some Android keyboards append the chosen autocomplete place name to
 * its previous value, e.g. "Villefranche-de-Rouergue" repeated twice.
 * Repair ONLY exact, back-to-back repetitions; never guess a different city.
 */
export function deduplicateStopName(value){
  const text=plain(value);
  if(text.length<8 || text.length%2!==0)return text;
  const middle=text.length/2;
  const first=text.slice(0,middle),second=text.slice(middle);
  return first.toLocaleLowerCase('fr-FR')===second.toLocaleLowerCase('fr-FR')?first:text;
}

export function isoDate(value){
  if(value instanceof Date && Number.isFinite(value.getTime()))return value.toISOString().slice(0,10);
  let str=plain(value);
  if(!str)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)){
    const x=new Date(str+'T12:00:00Z');
    return !isNaN(+x)&&x.toISOString().slice(0,10)===str?str:'';
  }
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(str)){
    const [d,m,y]=str.split('/');return isoDate(y+'-'+m+'-'+d);
  }
  return '';
}
export function findHeader(rows){
  for(let at=0;at<Math.min(12,rows.length);at++){
    const row=rows[at]||[];
    const used=new Set(),cols=HEADER_ALIASES.map(aliases=>{
      for(let i=0;i<row.length;i++){
        if(used.has(i))continue;
        if(aliases.includes(normalize(row[i]))){used.add(i);return i;}
      }
      return -1;
    });
    if(cols[0]>=0&&cols[1]>=0&&cols[2]>=0)return {rowIndex:at,cols};
  }
  throw new Error('En-têtes manquants : Prénom, Nom, Ville de départ. Téléchargez le modèle proposé.');
}
export function fromRows(rows,{startId=1,max=100}={}){
  const header=findHeader(rows);
  const participants=[],errors=[],seen=new Set();
  for(let i=header.rowIndex+1;i<rows.length;i++){
    const row=rows[i]||[];
    const read=c=>c<0?'':plain(row[c]);
    const [firstCol,lastCol,departureCol,outCol,backCol,noteCol]=header.cols;
    const first=read(firstCol),last=read(lastCol),departure=read(departureCol);
    const rawAller=outCol<0?'':row[outCol],rawRetour=backCol<0?'':row[backCol];
    const atLeastOne=[first,last,departure,read(outCol),read(backCol),read(noteCol)].some(Boolean);
    if(!atLeastOne)continue;
    const issues=[];
    if(!first||!last||!departure)issues.push('prénom, nom et départ obligatoires');
    if(rawAller!==undefined && plain(rawAller)&&!isoDate(rawAller))issues.push('date aller invalide');
    if(rawRetour!==undefined && plain(rawRetour)&&!isoDate(rawRetour))issues.push('date retour invalide');
    const idPart=normalize(first+' '+last+' '+departure);
    if(seen.has(idPart))issues.push('doublon possible');
    if(issues.length){errors.push('Ligne '+(i+1)+' : '+issues.join(', '));continue;}
    if(participants.length>=max){errors.push('Limite de '+max+' participants atteinte.');break;}
    seen.add(idPart);
    participants.push({id:'P-'+String(startId+participants.length).padStart(3,'0'),
      first:first.slice(0,90),last:last.slice(0,90),departure:departure.slice(0,140),
      outwardDate:isoDate(rawAller),returnDate:isoDate(rawRetour),
      notes:read(noteCol).slice(0,300)});
  }
  if(!participants.length)throw new Error('Aucun participant exploitable. Vérifiez les trois colonnes obligatoires.');
  return {participants,errors};
}
export function displayName(p){return [p.first,p.last].filter(Boolean).join(' ');}
export function queryKey(query,settings){
  return [query.from,query.to,query.date,query.earliest,query.latest,
    settings.mode,settings.connections,settings.buffer].join('|').toLowerCase();
}
export function itineraryKey(leg){
  if(leg.legs?.length>=2)return leg.legs.map(x=>x.id).join(' + ');
  return leg.id;
}
export function timeSpec(day,hour,zone='Europe/Paris'){
  if(!day||!/^\d\d:\d\d$/.test(hour))throw new Error('Horaire invalide');
  return {day,hour,zone};
}
export function selectedRows(options, choices){
  return options.filter(x=>choices.includes(x.key));
}
export const MAX_PARTICIPANTS=100;
