import {timeText,durationText,dateText} from './engine.mjs';
import {searchFeed,proposalText,normalizeStop} from './search-multi.mjs';
const $=id=>document.getElementById(id);
const dataCache=new Map();
let manifest, suggestions=[], results=[], selected=new Set(), current;

function elt(tag,cls,content){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=content;
  return e;
}
function message(text,isError=false){
  $('status').textContent=text;
  $('status').classList.toggle('error',isError);
}
function coverage(source){
  if(source.status!=='ok')return source.label+': indisponible';
  return source.label+': '+dateText(source.first)+' – '+dateText(source.last)+' · '+source.license;
}
function localToday(){
  const parts=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Paris'}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t).value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
async function init(){
  try{
    const response=await fetch('./data/manifest.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('Manifest HTTP '+response.status);
    manifest=await response.json();
    if(!Array.isArray(manifest.sources)||!manifest.sources.some(s=>s.status==='ok'))throw new Error('Aucune source active');
    const active=manifest.sources.filter(s=>s.status==='ok');
    $('date').min=active.map(s=>s.first).sort()[0];
    $('date').max=active.map(s=>s.last).sort().at(-1);
    const today=localToday();
    $('date').value=today<$('date').min?$('date').min:today>$('date').max?$('date').max:today;
    const stops=await fetch('./data/stations.json',{cache:'no-cache'});
    if(stops.ok){const value=await stops.json();if(Array.isArray(value))suggestions=value;}
    for(const id of ['origin','destination','date','search'])$(id).disabled=false;
    const failed=manifest.sources.filter(s=>s.status!=='ok').map(s=>s.label);
    message(active.length+' compagnies disponibles en horaires théoriques.'
      +(failed.length?' Sources non chargées : '+failed.join(', ')+'.':'')
      +' Recherche par nom de ville, gare ou arrêt.');
    renderSources();
  }catch(e){message('Aucune recherche possible : téléchargement des données absent ou invalide ('+e.message+').',true);}
}
function updateSuggestions(){
  const query=normalizeStop(this.value);
  if(query.length<2)return;
  const fragment=document.createDocumentFragment();
  for(const name of suggestions.filter(s=>{
    const normalized=normalizeStop(s);
    return normalized.startsWith(query)||normalized.includes(' '+query);
  }).slice(0,35)){const option=elt('option');option.value=name;fragment.append(option);}
  $('stations').replaceChildren(fragment);
}
$('origin').addEventListener('input',updateSuggestions);
$('destination').addEventListener('input',updateSuggestions);
function renderSources(loaded=null){
  const root=$('sources');
  if(!manifest)return;
  root.replaceChildren(elt('strong',null,'Sources et périodes : '));
  for(const s of manifest.sources){
    const a=elt('a',null,coverage(s));
    a.href=s.page;a.target='_blank';a.rel='noopener noreferrer';
    root.append(a,document.createTextNode(' · '));
  }
  root.append(document.createTextNode('Licence et disponibilité propres à chaque source. '
    +'Dates des flux différentes selon transporteur. Pas de garantie de complétude.'));
  if(loaded?.length)root.append(elt('p','warning','Échec lors du chargement des fichiers : '+loaded.join(', ')+'. Résultats partiels.'));
}
async function loadFeed(source){
  if(dataCache.has(source.id))return dataCache.get(source.id);
  const response=await fetch('./'+source.file,{cache:'default'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.stations)||!Array.isArray(data.trips)||!Array.isArray(data.services)||!data.meta)
    throw new Error('Format GTFS transformé invalide');
  dataCache.set(source.id,data);
  return data;
}
$('search-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!manifest)return;
  const from=$('origin').value.trim(),to=$('destination').value.trim();
  if(normalizeStop(from).length<3||normalizeStop(to).length<3){
    message('Saisissez au moins trois caractères pour chaque lieu.',true);return;
  }
  if(normalizeStop(from)===normalizeStop(to)){message('Saisissez des lieux de départ et d’arrivée différents.',true);return;}
  current={from,to,date:$('date').value,earliest:$('earliest').value,latest:$('latest').value};
  if(current.earliest>current.latest){message('La plage horaire est inversée.',true);return;}
  const mode=$('mode').value;
  const sources=manifest.sources.filter(s=>s.status==='ok'&&(mode==='all'||s.mode===mode)
       &&current.date>=s.first&&current.date<=s.last);
  selected.clear();results=[];
  if(!sources.length){
    $('result-section').hidden=false;
    $('results').replaceChildren();
    $('count').textContent='0 résultat';
    $('explanation').textContent='Aucune source ne couvre ce mode de transport à la date demandée.';
    updateCopy();renderSources();return;
  }
  $('search').disabled=true;
  message('Recherche dans '+sources.length+' source(s) d’horaires…');
  const loaded=await Promise.all(sources.map(async s=>{
    try{return {source:s,data:await loadFeed(s)}}catch(error){return {source:s,error:error.message}}
  }));
  const failures=[];
  for(const entry of loaded){
    if(entry.error){failures.push(entry.source.label);continue;}
    try{
      results.push(...searchFeed(entry.data,current,entry.source));
    }catch(e){failures.push(entry.source.label);}
  }
  results.sort((a,b)=>a.departure-b.departure||a.arrival-b.arrival);
  $('search').disabled=false;
  message(results.length+' trajets directs identifiés'
    +(failures.length?' (recherche incomplète : '+failures.join(', ')+').':'.')
    +' Vérifiez les arrêts exacts dans chaque résultat.',failures.length>0);
  render(failures);
});
function updateCopy(){
  $('copy').disabled=selected.size===0;
  $('copy').textContent='📋 Copier la proposition ('+selected.size+')';
}
function render(failures=[]){
  $('result-section').hidden=false;
  $('count').textContent=results.length+' résultat(s)';
  $('explanation').textContent=results.length>100
    ? 'Les 100 premiers résultats sont affichés. Affinez la plage horaire pour les autres.'
    :results.length?'Cochez les trajets souhaités : les noms exacts des gares ou arrêts figurent ci-dessous.'
    :'Aucun trajet direct trouvé dans les sources chargées. Une correspondance peut être nécessaire.';
  const fragment=document.createDocumentFragment();
  for(const journey of results.slice(0,100)){
    const label=elt('label','train');
    const input=elt('input');input.type='checkbox';input.checked=selected.has(journey.id);
    input.addEventListener('change',()=>{if(input.checked)selected.add(journey.id);else selected.delete(journey.id);updateCopy();});
    const info=elt('div','train-info');
    const left=elt('div');
    const late=Math.floor(journey.arrival/86400)!==0?' (le '+dateText(current.date,journey.arrival)+')':'';
    left.append(elt('div','times',timeText(journey.departure)+' → '+timeText(journey.arrival)+late));
    left.append(elt('div','details',journey.from+' → '+journey.to));
    const right=elt('div','details',
      (journey.mode==='bus'?'🚌 Autocar':'🚆 Train')+' · '+journey.provider
      +(journey.number?' · n° '+journey.number:'')+' · '+durationText(journey.arrival-journey.departure)
      +' · Direct');
    info.append(left,right);label.append(input,info);fragment.append(label);
  }
  $('results').replaceChildren(fragment);
  $('copy-status').textContent='';
  renderSources(failures);
  updateCopy();
}
$('all').addEventListener('click',()=>{selected=new Set(results.slice(0,100).map(x=>x.id));render();});
$('none').addEventListener('click',()=>{selected.clear();render();});
$('copy').addEventListener('click',async()=>{
  const visible=new Set(results.slice(0,100).map(j=>j.id));
  const chosen=results.filter(j=>selected.has(j.id)&&visible.has(j.id));
  if(!chosen.length||!current)return;
  const value=proposalText(chosen,current);
  try{
    await navigator.clipboard.writeText(value);
    $('copy-status').textContent='✅ '+chosen.length+' proposition(s) copiée(s).';
  }catch(_error){
    const area=elt('textarea');area.value=value;area.style.position='fixed';area.style.opacity=0;
    document.body.append(area);area.select();
    const success=document.execCommand('copy');area.remove();
    $('copy-status').textContent=success?'✅ Proposition copiée.':'La copie est bloquée dans ce navigateur.';
  }
});
init();
