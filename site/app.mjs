import {findDirect, timeText, durationText, dateText} from './engine.mjs';

const $=id=>document.getElementById(id);
let timetable=null, lookup=new Map(), results=[], selected=new Set(), request=null;

function status(message, error=false) {
  $('status').textContent=message;
  $('status').classList.toggle('error',error);
}
function element(tag, className, contents) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(contents!==undefined)node.textContent=contents;
  return node;
}
async function load() {
  try {
    const response=await fetch(new URL('./data/trains.json',import.meta.url),{cache:'no-cache'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(!data.meta || !Array.isArray(data.stations) || !Array.isArray(data.trips) || !Array.isArray(data.services))throw new Error('Données invalides');
    timetable=data;
    const counts=new Map();
    for(const station of data.stations) counts.set(station[1],(counts.get(station[1])||0)+1);
    const fragment=document.createDocumentFragment();
    data.stations.forEach((station,index)=>{
      const label=counts.get(station[1])>1 ? station[1]+' · '+station[0] : station[1];
      lookup.set(label.trim().toLocaleLowerCase('fr-FR'),index);
      const option=element('option');
      option.value=label;fragment.append(option);
    });
    $('stations').replaceChildren(fragment);
    $('date').min=data.meta.first;$('date').max=data.meta.last;
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=part=>parts.find(p=>p.type===part).value;
    const today=get('year')+'-'+get('month')+'-'+get('day');
    $('date').value=today<data.meta.first ? data.meta.first : today>data.meta.last ? data.meta.last : today;
    for(const id of ['origin','destination','date','search'])$(id).disabled=false;
    let lastUpdate='date inconnue';
    if(data.meta.generated && !isNaN(Date.parse(data.meta.generated)))lastUpdate=new Date(data.meta.generated).toLocaleString('fr-FR',{timeZone:'Europe/Paris'});
    status('Horaires planifiés du '+dateText(data.meta.first)+' au '+dateText(data.meta.last)+' · actualisés le '+lastUpdate+'.');
  } catch(e) {
    status('Horaires momentanément indisponibles ('+e.message+'). Aucun horaire inventé ne sera affiché.',true);
  }
}
function updateButton() {
  $('copy').disabled=!selected.size;
  $('copy').textContent='📋 Copier la proposition ('+selected.size+')';
}
function render() {
  const fragment=document.createDocumentFragment();
  for(const train of results.slice(0,100)) {
    const label=element('label','train');
    const checkbox=element('input');
    checkbox.type='checkbox';checkbox.checked=selected.has(train.id);
    checkbox.addEventListener('change',()=>{
      if(checkbox.checked)selected.add(train.id);else selected.delete(train.id);
      updateButton();
    });
    const main=element('div','train-info');
    const left=element('div');
    left.append(element('div','times',timeText(train.departure)+' → '+timeText(train.arrival)));
    const nextDay=Math.floor(train.arrival/86400)!==0 ? ' · arrivée le '+dateText(request.date,train.arrival) : '';
    left.append(element('div','details',durationText(train.arrival-train.departure)+nextDay));
    const right=element('div','details',[train.line,train.number?'n° '+train.number:'',train.headsign?'Direction '+train.headsign:''].filter(Boolean).join(' · '));
    main.append(left,right);label.append(checkbox,main);fragment.append(label);
  }
  $('results').replaceChildren(fragment);
  $('count').textContent=results.length+' résultat(s)';
  $('explanation').textContent=results.length===0
    ? 'Aucun train direct identifié. Vérifiez les gares ou recherchez une correspondance auprès du transporteur.'
    : results.length>100?'Seuls les 100 premiers trajets sont affichés : réduisez la plage horaire.':'Sélectionnez les trajets à proposer.';
  $('result-section').hidden=false;
  $('copy-status').textContent='';
  updateButton();
}
$('search-form').addEventListener('submit',event=>{
  event.preventDefault();if(!timetable)return;
  const origin=lookup.get($('origin').value.trim().toLocaleLowerCase('fr-FR'));
  const destination=lookup.get($('destination').value.trim().toLocaleLowerCase('fr-FR'));
  if(origin===undefined||destination===undefined){status('Choisissez les gares dans les suggestions.',true);return;}
  if(origin===destination){status('La gare de départ doit être différente de la gare d’arrivée.',true);return;}
  const date=$('date').value;
  if(date<timetable.meta.first||date>timetable.meta.last){status('Date hors de la période couverte.',true);return;}
  if($('earliest').value>$('latest').value){status('La plage horaire est inversée.',true);return;}
  request={origin:timetable.stations[origin][1],destination:timetable.stations[destination][1],date};
  results=findDirect(timetable,origin,destination,date,$('earliest').value,$('latest').value);
  selected=new Set();render();
  status('Recherche effectuée · horaires théoriques uniquement.');
});
$('all').addEventListener('click',()=>{selected=new Set(results.slice(0,100).map(t=>t.id));render();});
$('none').addEventListener('click',()=>{selected.clear();render();});
$('copy').addEventListener('click',async()=>{
  const chosen=results.filter(t=>selected.has(t.id));if(!chosen.length||!request)return;
  const lines=[
    'PROPOSITION DE TRAJETS — TRANSBORA',
    request.origin+' → '+request.destination,
    'Date : '+dateText(request.date),
    '',
    ...chosen.map((train,i)=>{
      const following=Math.floor(train.arrival/86400)!==0?' ('+dateText(request.date,train.arrival)+')':'';
      return (i+1)+'. Départ '+timeText(train.departure)+' — Arrivée '+timeText(train.arrival)+following+
        ' — '+durationText(train.arrival-train.departure)+' — '+train.line+
        (train.number?' n° '+train.number:'')+' — Direct';
    }),
    '',
    'Horaires théoriques SNCF Voyageurs (open data), susceptibles de modifications.',
    'À vérifier auprès du transporteur avant toute réservation.'
  ];
  const proposal=lines.join('\n');
  try {
    await navigator.clipboard.writeText(proposal);
    $('copy-status').textContent='✅ '+chosen.length+' trajet(s) copié(s) : à coller dans votre e-mail ou document.';
  } catch(e) {
    const field=element('textarea');field.value=proposal;
    field.style.position='fixed';field.style.opacity='0';
    document.body.append(field);field.select();
    const ok=document.execCommand('copy');field.remove();
    $('copy-status').textContent=ok?'✅ Proposition copiée.':'Copie automatique indisponible dans ce navigateur.';
  }
});
load();
