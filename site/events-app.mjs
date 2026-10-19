import {fromRows,displayName,plain,MAX_PARTICIPANTS,isoDate,deduplicateStopName} from './events-model.mjs';
import {prepareFeeds,planEvent,eventBoundaries} from './event-planner.mjs';
import {officialIndex} from './connections.mjs';
import {parisTime,parisDate} from './time-zones.mjs';
import {durationText} from './engine.mjs';
import {api,buildChoicePeople,choiceUrl,statusUrl,textLinks} from './native-choices.mjs';
import {draftFields,saveDraft,restoreDraft,eraseDraft} from './event-draft.mjs';
import {registerHistory,parseOwnerLink} from './event-history.mjs';
import {
  buildTemplate,buildOrganizer,buildIndividual,bytes,saveBytes,fileName,
  importTemplate,readDecisions
} from './excel-exports.mjs';

const $=id=>document.getElementById(id);
const SITE_FILE_SIZE=5*1024*1024;
let manifest=null,participants=[],plans=new Map(),choices={},prepared=null,officialRules=new Map();
let isBusy=false,hasSearched=false,nextId=1,activeStep=1,currentView='wizard';
let published=null;
let searchWorker=null,cancelActiveSearch=null,stopRequested=false;
let draftSaving=null,restoredDraft=false;
const eventFieldIds=['event-title','event-destination','event-start-date','event-start-time','event-end-date',
  'event-end-time','include-outward','include-return','arrival-margin','departure-margin',
  'ev-mode','ev-buffer','ev-count','ev-reduced-margin'];

function node(tag,cls,value){
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(value!==undefined)item.textContent=value;
  return item;
}
function status(message,error=false){
  const s=$('global-status');s.textContent=message;
  s.classList.toggle('has-error',error);
}
function msg(element,message,error=false){
  element.textContent=message;
  element.classList.toggle('error-text',error);
}
function excelReady(){
  if(!globalThis.ExcelJS?.Workbook)throw new Error(
    'La bibliothèque Excel n’a pas pu se charger. Vérifiez votre connexion Internet puis actualisez cette page.');
  return globalThis.ExcelJS;
}
function dateParis(days=0){
  const now=new Date();
  now.setDate(now.getDate()+days);
  const formatter=new Intl.DateTimeFormat('fr-CA',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'
  });
  return formatter.format(now);
}
function readEvent(){
  const title=$('event-title').value.trim();
  const destination=$('event-destination').value.trim();
  const startDate=$('event-start-date').value,endDate=$('event-end-date').value;
  const startTime=$('event-start-time').value,endTime=$('event-end-time').value;
  const includeOutward=$('include-outward').checked;
  const includeReturn=$('include-return').checked;
  const outwardDate='';
  const returnDate='';
  if(!includeOutward&&!includeReturn)
    throw new Error('Sélectionnez au moins un trajet : aller ou retour.');
  if(!title||!destination||destination.length<3||!startDate||!endDate||!startTime||!endTime)
    throw new Error('Indiquez le nom, le lieu, le début et la fin de l’événement.');
  if(!isoDate(startDate)||!isoDate(endDate)||(outwardDate&&!isoDate(outwardDate))||(returnDate&&!isoDate(returnDate)))
    throw new Error('Date d’événement, d’aller ou de retour invalide.');
  const out={title,destination,startDate,startTime,endDate,endTime,outwardDate,returnDate,
    includeOutward,includeReturn,
    arrivalMargin:Number($('arrival-margin').value),departureMargin:Number($('departure-margin').value)};
  eventBoundaries(out);
  return out;
}
function readSettings(){
  return {mode:$('ev-mode').value,connections:'auto',
    buffer:$('ev-buffer').value,maxOptions:Number($('ev-count').value),
    allowReducedMargin:$('ev-reduced-margin').checked};
}
function updateButtons(){
  const hasPeople=participants.length>0;
  $('search-everyone').disabled=isBusy||!hasPeople||!manifest;
  const havePlans=hasSearched&&plans.size>0;
  for(const id of ['export-organizer','export-personal-zip','export-followup','prepare-native-group','prepare-native-individual']){
    $(id).disabled=isBusy||!havePlans;
  }
  for(const id of ['export-organizer','export-personal-zip','prepare-native-group','prepare-native-individual']){
    $(id).hidden=!havePlans;
  }
  $('individual-details').hidden=!havePlans;
  $('copy-invitation').hidden=!havePlans;
  $('download-template').disabled=isBusy;
  const next=$('wizard-next'),search=$('search-everyone');
  if(currentView==='wizard'){
    const isThird=activeStep===3;
    next.hidden=activeStep===4 || (isThird&&!havePlans);
    search.hidden=!isThird || havePlans;
    next.disabled=isBusy;
    $('wizard-back').hidden=activeStep===1;
    $('wizard-actions').hidden=false;
  }
}
function invalidate(){
  plans=new Map();choices={};hasSearched=false;published=null;
  $('native-ready').hidden=true;
  $('share-mode-options').hidden=false;
  $('cancel-mode-switch').hidden=true;
  $('journey-recap').replaceChildren();
  $('individual-files').replaceChildren(node('p','muted','Lancez la recherche.'));
  msg($('reply-status'),'');
  updateButtons();
}
function storeDraft(){
  if(!globalThis.localStorage)return;
  const fields=Object.fromEntries(draftFields.map(id=>{
    const field=$(id);
    return [id,!field?'':field.type==='checkbox'?field.checked:field.value];
  }));
  saveDraft(localStorage,{fields,participants,step:activeStep});
}
function scheduleDraft(){
  clearTimeout(draftSaving);
  draftSaving=setTimeout(storeDraft,150);
}
function loadSavedDraft(){
  if(!globalThis.localStorage)return false;
  const data=restoreDraft(localStorage);
  if(!data)return false;
  for(const id of draftFields){
    const field=$(id),value=data.fields[id];
    if(field?.type==='checkbox')field.checked=value===true || value==='true';
    else if(field && value!==undefined)field.value=String(value);
  }
  participants=data.participants.filter(p=>p.first&&p.last&&p.departure)
    .map(p=>({...p,departure:deduplicateStopName(p.departure)}));
  nextId=1+Math.max(0,...participants.map(p=>Number(String(p.id).replace(/^P-/,''))||0));
  renderPeople();
  showStep(data.step,{focus:false});
  restoredDraft=true;
  return true;
}
function labelPerson(p){
  return displayName(p)+' · '+p.departure;
}
function renderPeople(){
  $('participants-total').textContent=String(participants.length);
  const holder=$('participants-list');
  holder.replaceChildren();
  if(!participants.length){
    holder.append(node('p','muted','Aucun voyageur ajouté.'));
    return;
  }
  const frag=document.createDocumentFragment();
  participants.forEach(p=>{
    const item=node('div','person-chip');
    const content=node('div','person-copy');
    content.append(node('strong',null,displayName(p)));
    content.append(node('span','muted',p.departure+
      (p.outwardDate?' · aller '+p.outwardDate:'')+
      (p.returnDate?' · retour '+p.returnDate:'')));
    const remove=node('button','mini-button','Supprimer');
    remove.type='button';remove.setAttribute('aria-label','Supprimer '+displayName(p));
    remove.addEventListener('click',()=>{
      participants=participants.filter(x=>x.id!==p.id);
      invalidate();renderPeople();scheduleDraft();
    });
    item.append(content,remove);frag.append(item);
  });
  holder.append(frag);
}
function includeParticipants(items){
  const seen=new Set(participants.map(p=>[p.first,p.last,p.departure].map(x=>x.toLowerCase()).join('|')));
  let added=0,duplicates=0,corrected=0;
  for(const original of items){
    const departure=deduplicateStopName(original.departure);
    const incoming={...original,departure};
    if(departure!==original.departure)corrected++;
    const key=[incoming.first,incoming.last,incoming.departure].map(x=>x.toLowerCase()).join('|');
    if(seen.has(key)){duplicates++;continue;}
    if(participants.length>=MAX_PARTICIPANTS)break;
    const id='P-'+String(nextId++).padStart(3,'0');
    participants.push({...incoming,id});
    seen.add(key);added++;
  }
  if(added)invalidate();
  renderPeople();scheduleDraft();
  return {added,duplicates,corrected};
}
async function init(){
  // The prototype no longer needs the old owner activation code. Remove any
  // previous locally saved credential without touching event drafts or links.
  try{globalThis.localStorage?.removeItem('transbora_owner_activation_v1');}catch(_e){}

  // Event dates are deliberately empty until entered. Do not silently reuse
  // a different date for a trip (this caused the 25/29 October confusion).
  $('event-start-date').value='';
  $('event-end-date').value='';
  const updateTravelOptions=()=>{
    const aller=$('include-outward').checked,retour=$('include-return').checked;
    $('arrival-margin').disabled=!aller;
    $('departure-margin').disabled=!retour;
    const summary=$('etape-1').querySelector('details > summary');
    if(summary)summary.textContent='Options · '+(aller&&retour?'Aller + retour':aller?'Aller':retour?'Retour':'Aucun trajet');
  };
  updateTravelOptions();
  for(const id of ['include-outward','include-return'])
    $(id).addEventListener('change',updateTravelOptions);
  const syncEventEnd=()=>{
    // Set end to the same moment whenever the start changes. The user can then
    // change either end field without having to redo the whole date or time.
    $('event-end-date').value=$('event-start-date').value;
    $('event-end-time').value=$('event-start-time').value;
    invalidate();
  };
  for(const id of ['event-start-date','event-start-time'])
    $(id).addEventListener('change',syncEventEnd);
  for(const id of eventFieldIds){
    $(id).addEventListener('change',()=>{invalidate();scheduleDraft();});
    $(id).addEventListener('input',scheduleDraft);
  }
  if(new URLSearchParams(location.search).get('new')==='1')eraseDraft(localStorage);
  else loadSavedDraft();
  updateTravelOptions();
  try{
    const response=await fetch('./data/manifest.json',{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    manifest=await response.json();
    if(!manifest?.sources?.some(s=>s.status==='ok'))throw new Error('Aucune source GTFS active');
    status('Prêt : '+manifest.sources.filter(s=>s.status==='ok').length+
      ' sources de transport disponibles. '+(restoredDraft?
        'Votre événement et vos voyageurs ont été retrouvés. Vous pouvez relancer la recherche.':
        'Créez un événement puis ajoutez les voyageurs.'));
    let stations;
    try{
      const res=await fetch('./data/stations.json');
      if(res.ok)stations=await res.json();
    }catch(_error){/* Suggestions are optional; manual city names still work. */}
    if(Array.isArray(stations)){
      const frag=document.createDocumentFragment();
      for(const station of stations.filter(x=>typeof x==='string').slice(0,12000)){
        const option=node('option');option.value=station;frag.append(option);
      }
      $('event-stations').replaceChildren(frag);
    }
  }catch(error){
    status('Recherche indisponible : '+error.message+'. Le modèle Excel reste téléchargeable.',true);
  }
  updateButtons();
}
async function download(book,prefix){
  const result=await bytes(book);
  saveBytes(result,prefix+'.xlsx');
}
function busy(flag){
  isBusy=flag;updateButtons();
}
function useResultStatus(summary,errors=[]){
  msg($('import-status'),summary+(errors.length?' · '+errors.slice(0,6).join(' / '):''),Boolean(errors.length));
}
$('download-template').addEventListener('click',async()=>{
  try{
    busy(true);
    await download(buildTemplate(excelReady()),'Transbora_MODELE_liste_participants');
    status('Modèle Excel téléchargé. Remplissez la feuille Participants puis réimportez-la.');
  }catch(error){status(error.message,true);}finally{busy(false);}
});
$('import-participants').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    if(!/\.xlsx$/i.test(file.name)||file.size>SITE_FILE_SIZE)
      throw new Error('Sélectionnez un fichier .xlsx de moins de 5 Mo.');
    busy(true);
    const {participants:found,errors}=await importTemplate(excelReady(),await file.arrayBuffer());
    const {added,duplicates,corrected}=includeParticipants(found);
    useResultStatus(added+' participant(s) ajouté(s) depuis '+file.name+
      (duplicates?' · '+duplicates+' doublon(s) ignoré(s)':'')+
      (corrected?' · '+corrected+' ville(s) répétée(s) corrigée(s)':''),errors);
    status('Import terminé : '+participants.length+' personne(s) dans le dossier.');
  }catch(error){msg($('import-status'),error.message,true);}finally{
    busy(false);event.target.value='';
  }
});
$('manual-person').addEventListener('submit',event=>{
  event.preventDefault();
  if(participants.length>=MAX_PARTICIPANTS){
    msg($('import-status'),'Limite de 100 voyageurs atteinte.',true);return;
  }
  const person={first:$('add-first').value.trim(),last:$('add-last').value.trim(),
    departure:$('add-from').value.trim(),outwardDate:'',returnDate:'',notes:''};
  if(!person.first||!person.last||person.departure.length<3){
    msg($('import-status'),'Prénom, nom et lieu de départ sont obligatoires.',true);return;
  }
  const {added,duplicates,corrected}=includeParticipants([person]);
  useResultStatus((added?'Voyageur ajouté.':'Personne déjà présente.')+
    (corrected?' Nom de ville répété automatiquement corrigé : '+deduplicateStopName(person.departure)+'.':''),
    duplicates?['Doublon ignoré.']:[]);
  if(added)event.target.reset();
});
$('clear-participants').addEventListener('click',()=>{
  if(!participants.length)return;
  if(!confirm('Effacer les personnes de ce brouillon et tous les résultats de recherche ?'))return;
  participants=[];nextId=1;invalidate();renderPeople();storeDraft();
  msg($('import-status'),'Liste effacée.');
});
function showJourney(j,day){
  const actual=j.date||day;
  return parisDate(actual,j.departure)+' '+parisTime(actual,j.departure)
    +' → '+parisDate(actual,j.arrival)+' '+parisTime(actual,j.arrival)+
    ' · '+durationText(j.arrival-j.departure)+' · '+(j.changes||0)+' chgt';
}
function prettyTravelDate(value){
  // parisDate() yields DD/MM/YYYY; construct the local calendar date
  // without browser-dependent parsing or local timezone shifts.
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if(!match)return value;
  const [,day,month,year]=match;
  return new Intl.DateTimeFormat('fr-FR',{
    weekday:'long',day:'numeric',month:'long',timeZone:'UTC'
  }).format(new Date(year+'-'+month+'-'+day+'T12:00:00Z'));
}
function renderSearchResults(issues){
  const holder=$('journey-recap');holder.replaceChildren();
  if(issues.length){
    const notice=node('div','notice warning','Certains trajets n’ont pas été trouvés : '+issues.slice(0,7).join(' / '));
    holder.append(notice);
  }
  for(const p of participants){
    const plan=plans.get(p.id);
    if(!plan)continue;
    const card=node('article','recap-person');
    card.append(node('strong',null,displayName(p)+' · '+p.departure));
    const line=node('div','recap-columns');
    const requested=readEvent();
    for(const [label,list,dates] of [
      ...(requested.includeOutward?[['ALLER',plan.outward,plan.outwardDates||[plan.outwardDate]]]:[]),
      ...(requested.includeReturn?[['RETOUR',plan.returning,plan.returnDates||[plan.returnDate]]]:[])
    ]){
      const side=node('div','recap-side');
      side.append(node('span','pill',label+' · meilleurs horaires'));
      if(!list.length){
        const reason=plan.reasons?.[label==='ALLER'?'A':'R'];
        const explanations={
          unknown_origin:'Ville de départ absente de nos horaires.',
          unknown_destination:'Ville d’arrivée absente de nos horaires.',
          no_published_data:'Horaires non publiés pour cette période.',
          incomplete:'Recherche incomplète : le délai de calcul a été atteint.',
          not_found:'Aucun trajet correspondant aux marges et aux correspondances autorisées.'
        };
        side.append(node('p','no-options',
          (explanations[reason]||'Pas de proposition trouvée.')+
          ' Cela ne signifie PAS qu’aucun train ne circule. Vérifiez aussi le site du transporteur.'));
        if(reason==='not_found'||reason==='incomplete')
          side.append(node('p','route-through','Transbora essaie automatiquement les trajets directs, puis 1 et 2 changements.'));
      }
      list.forEach((j,index)=>{
        const option=node('article','recap-route');
        const day=j.date||dates[0];
        const legs=j.legs?.length?j.legs:[j];
        const operator=[...new Set(legs.map(t=>t.provider).filter(Boolean))].join(' · ');
        const modes=new Set(legs.map(t=>t.mode));
        const transport=modes.size>1?'🚆🚌 Train + autocar':
          modes.has('bus')?'🚌 Autocar':'🚆 Train';
        option.append(node('span','route-option-heading','Option '+(index+1)+' · '+transport+
          (operator?' · '+operator:'')));
        const departure=parisDate(day,j.departure),arrival=parisDate(day,j.arrival);
        option.append(node('span','route-calendar',
          prettyTravelDate(departure)+
          (departure!==arrival?' → '+prettyTravelDate(arrival):'')));
        option.append(node('strong','route-clock',
          parisTime(day,j.departure)+' → '+parisTime(day,j.arrival)));
        const changes=legs.length>1?legs.length-1:0;
        option.append(node('span','route-meta',durationText(j.arrival-j.departure)+
          ' · '+(changes===0?'Direct':changes+' correspondance'+(changes>1?'s':''))));
        if(j.marginReduced)option.append(node('span','route-warning',
          '⚠ Alternative : '+j.actualMarginMinutes+' min disponibles au lieu des '+
          j.requestedMarginMinutes+' min demandées. L’organisateur doit valider le temps entre gare et lieu.'));
        const from=legs[0].from||'',to=legs.at(-1).to||'';
        if(from&&to)option.append(node('span','route-stations',from+' → '+to));
        if(changes){
          const through=legs.slice(0,-1).map(x=>x.to).filter(Boolean).join(' · ');
          if(through)option.append(node('span','route-through','Via '+through));
        }
        side.append(option);
      });
      line.append(side);
    }
    card.append(line);holder.append(card);
  }
}
function renderIndividualButtons(event){
  const holder=$('individual-files');holder.replaceChildren();
  for(const p of participants){
    const item=node('div','file-row');
    item.append(node('span',null,'👤 '+displayName(p)));
    const actions=node('div','file-actions');
    const btn=node('button','mini-button','⬇ Excel');
    btn.type='button';
    btn.addEventListener('click',async()=>{
      try{
        busy(true);
        await download(buildIndividual(excelReady(),event,p,plans,choices),
          'Transbora_'+fileName(event.title)+'_'+fileName(displayName(p)));
        status('Fichier individuel créé pour '+displayName(p)+'.');
      }catch(error){status(error.message,true);}finally{busy(false);}
    });
    actions.append(btn);
    if(typeof navigator.share==='function'){
      const shareBtn=node('button','mini-button','📤 Partager');
      shareBtn.type='button';
      shareBtn.addEventListener('click',async()=>{
        try{
          busy(true);
          const name='Transbora_'+fileName(event.title)+'_'+fileName(displayName(p))+'.xlsx';
          const buffer=await bytes(buildIndividual(excelReady(),event,p,plans,choices));
          const file=new File([buffer],name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
          if(!navigator.canShare?.({files:[file]}))throw new Error('Le partage de fichiers n’est pas pris en charge ici : utilisez ⬇ Excel.');
          await navigator.share({files:[file],title:'Propositions de trajet de '+displayName(p)});
        }catch(error){
          if(error.name!=='AbortError')status(error.message,true);
        }finally{busy(false);}
      });
      actions.append(shareBtn);
    }
    item.append(actions);holder.append(item);
  }
}
/** Run expensive day-by-day GTFS scans in a worker to keep Android UI responsive. */
async function performSearch(event,settings){
  // No arbitrary deadline: stop when valid options are found or published
  // timetables have been exhausted. Work stays in the background worker.
  const limits={};
  const progress=(done,total,p)=>{
    $('progress').value=Math.round(done/total*100);
    $('progress-label').textContent=done+' / '+total+' voyageur(s)';
    $('search-detail').textContent='Terminé pour '+displayName(p);
  };
  const onDay=({person,kind,date,searched})=>{
    $('search-detail').textContent=person.first+' '+person.last+' · '+
      (kind==='A'?'Aller':'Retour')+' · horaires du '+date+' ('+searched+' jour(s) examinés)';
  };
  if(typeof Worker!=='undefined'){
    return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./search-worker.mjs',import.meta.url),{type:'module'});
      searchWorker=worker;
      let completed=false;
      const finish=(error,value)=>{
        if(completed)return;
        completed=true;worker.terminate();searchWorker=null;
        cancelActiveSearch=null;
        if(error)reject(error);else resolve(value);
      };
      cancelActiveSearch=()=>finish(new Error('Recherche arrêtée. Votre événement et vos voyageurs sont conservés.'));
      worker.onmessage=e=>{
        const msg=e.data||{};
        if(msg.type==='stage')$('search-detail').textContent=msg.label;
        if(msg.type==='progress'){
          $('progress').value=Math.round(msg.done/msg.total*100);
          $('progress-label').textContent=msg.done+' / '+msg.total+' voyageur(s)';
          $('search-detail').textContent='Terminé pour '+msg.name;
        }
        if(msg.type==='day')$('search-detail').textContent=msg.name+' · '+
          (msg.kind==='A'?'Aller':'Retour')+' · '+
          (msg.level===0?'Sans changement · ':msg.level===1?'1 changement · ':msg.level===2?'2 changements · ':'')+
          msg.date;
        if(msg.type==='error')finish(new Error(msg.message));
        if(msg.type==='complete')finish(null,{plans:new Map(msg.plans),
          issues:msg.issues,partial:msg.partial});
      };
      worker.onerror=()=>finish(new Error('Le moteur de recherche est indisponible. Rechargez les horaires et réessayez.'));
      worker.postMessage({event,people:participants,settings,manifest,limits});
    });
  }
  // Test runners and old browsers without module workers.
  if(!prepared){
    prepared=await prepareFeeds(manifest);
    if(!prepared.feeds.length)throw new Error('Aucun horaire disponible.');
    try{
      const r=await fetch('./data/mct.json');
      if(r.ok)officialRules=officialIndex(await r.json());
    }catch(_error){}
  }
  const result=await planEvent(event,participants,prepared.feeds,settings,
    officialRules,progress,{...limits,shouldAbort:()=>stopRequested,onDay});
  return {plans:result.plans,issues:[...prepared.issues,...result.issues],partial:result.partial};
}
$('cancel-search').addEventListener('click',()=>{
  stopRequested=true;
  if(cancelActiveSearch)cancelActiveSearch();
  $('search-detail').textContent='Arrêt en cours…';
});
$('search-everyone').addEventListener('click',async()=>{
  try{
    if(!participants.length)throw new Error('Ajoutez au moins un voyageur.');
    const event=readEvent(),settings=readSettings();
    stopRequested=false;
    busy(true);invalidate();storeDraft();
    $('progress-box').hidden=false;$('progress').value=0;
    $('progress-label').textContent='0 / '+participants.length+' voyageur(s)';
    $('search-detail').textContent='Préparation des données horaires…';
    status('');
    const result=await performSearch(event,settings);
    plans=result.plans;hasSearched=true;
    const gaps=participants.reduce((total,p)=>{
      const plan=plans.get(p.id);
      return total+(event.includeOutward&&!plan.outward.length?1:0)
        +(event.includeReturn&&!plan.returning.length?1:0);
    },0);
    renderSearchResults(result.issues);
    renderIndividualButtons(event);
    status(result.partial?
      'Recherche partielle : '+gaps+' trajets sans option affichée. Une autre recherche peut trouver davantage de trains.':
      'Recherche terminée : '+participants.length+' voyageur(s), '+gaps+
      ' trajet(s) sans option dans les horaires consultés. Vérifiez avant de réserver.',
      Boolean(result.partial||gaps));
    updateButtons();
    $('journey-recap').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){
    if(error.message==='Recherche arrêtée. Votre événement et vos voyageurs sont conservés.')
      status(error.message,false);
    else status(error.message,true);
  }finally{
    $('progress-box').hidden=true;busy(false);storeDraft();
  }
});
// Google Sheets is private and owned by the logged-in user. The public repo
// never contains their Sheet identifier nor personal event data.
const shareStatus=message=>msg($('native-status'),message,false);
async function copyLink(value){
  try{await navigator.clipboard.writeText(value);shareStatus('✓ Lien copié.');}
  catch{window.prompt('Copiez ce lien :',value);}
}
function renderPublished(record,mode){
  published={...record,mode};
  $('share-mode-options').hidden=true;
  $('cancel-mode-switch').hidden=true;
  const dashboard=statusUrl(record.eventId,record.ownerKey);
  $('native-status-link').href=dashboard;
  $('open-replies-native').href=dashboard;
  updateRepliesUI();
  try{sessionStorage.setItem('transbora_last_dashboard',dashboard);}
  catch{ /* Private mode: organizer must save the displayed link. */ }
  const saved=registerHistory(globalThis.localStorage,{
    eventId:record.eventId,ownerKey:record.ownerKey,
    event:readEvent(),peopleCount:participants.length
  });
  const host=$('native-share-links');host.replaceChildren();
  for(const link of record.links){
    const row=node('div','file-row');
    row.append(node('strong',null,link.label));
    const actions=node('div','file-actions');
    const url=choiceUrl(link.token);
    const visit=node('a','mini-button','Ouvrir ↗');
    visit.href=url;visit.target='_blank';visit.rel='noopener noreferrer';
    const copy=node('button','mini-button','Copier');
    copy.type='button';copy.addEventListener('click',()=>copyLink(url));
    actions.append(visit,copy);row.append(actions);host.append(row);
  }
  $('native-ready').hidden=false;
  shareStatus(record.links.length+' lien(s) créés.'+
    (saved?' Dossier ajouté à « Mes événements ».':
     ' Attention : la liste locale est indisponible, conservez le lien privé de suivi.'));
}
async function createNativeLinks(mode){
  try{
    if(!hasSearched)throw new Error('Recherchez d’abord les trajets.');
    if(published?.mode===mode){
      $('share-mode-options').hidden=true;
      $('cancel-mode-switch').hidden=true;
      $('native-ready').hidden=false;
      shareStatus('Les liens actuels sont conservés.');
      return;
    }
    if(published && published.mode!==mode){
      if(!confirm('Changer le type de lien ? Les liens précédents ne fonctionneront plus. Les réponses déjà reçues seront conservées et le dossier restera le même.'))return;
      busy(true);shareStatus('Remplacement des liens…');
      const result=await api('switch_mode',{
        eventId:published.eventId,ownerKey:published.ownerKey,mode
      });
      renderPublished(result,mode);
    }else{
      const event=readEvent();
      const people=buildChoicePeople(event,participants,plans);
      busy(true);shareStatus('Création des liens privés…');
      const result=await api('create',{event,people,mode});
      renderPublished(result,mode);
    }
    $('native-ready').scrollIntoView({behavior:'smooth',block:'start'});
    $('native-ready').focus();
  }catch(error){
    const message=error.message;
    msg($('native-status'),message,true);
    status(message,true);
    $('native-status').scrollIntoView({behavior:'smooth',block:'center'});
  }finally{busy(false);}
}
$('prepare-native-group').addEventListener('click',()=>createNativeLinks('group'));
$('prepare-native-individual').addEventListener('click',()=>createNativeLinks('individual'));
$('switch-sharing-mode').addEventListener('click',()=>{
  $('share-mode-options').hidden=false;
  $('cancel-mode-switch').hidden=false;
  $('native-ready').hidden=true;
  shareStatus('Choisissez le nouveau type de lien. Vos trajets ne seront pas recalculés.');
  $('share-mode-options').scrollIntoView({behavior:'smooth',block:'start'});
});
$('cancel-mode-switch').addEventListener('click',()=>{
  $('share-mode-options').hidden=true;
  $('cancel-mode-switch').hidden=true;
  $('native-ready').hidden=false;
  shareStatus('Liens actuels conservés.');
});
$('native-copy-all').addEventListener('click',async()=>{
  if(!published)return;
  await copyLink(textLinks(published.links,published.mode));
});
function updateRepliesUI(){
  const available=$('open-replies-native').getAttribute('href')!=='#';
  $('replies-no-folder').hidden=available;
  $('replies-has-folder').hidden=!available;
}
$('go-create-links').addEventListener('click',()=>{
  if(hasSearched)showStep(4);
  else{
    showStep(participants.length?3:1);
    status('Pour obtenir les liens, terminez la recherche puis passez à l’étape 4.');
  }
});
try{
  const last=sessionStorage.getItem('transbora_last_dashboard')||'';
  if(last.startsWith(location.origin+'/'))$('open-replies-native').href=last;
}catch{}
updateRepliesUI();
$('open-replies-native').addEventListener('click',event=>{
  if($('open-replies-native').getAttribute('href')==='#'){
    event.preventDefault();
    msg($('reply-status'),'Créez d’abord les liens à l’étape 4. Le lien du tableau de suivi apparaîtra.',true);
  }
});

$('export-organizer').addEventListener('click',async()=>{
  try{
    busy(true);
    const event=readEvent();
    await download(buildOrganizer(excelReady(),event,participants,plans,choices),
      'Transbora_GROUPE_'+fileName(event.title));
    status('Classeur du groupe téléchargé : trajets demandés, réservations et aide.');
  }catch(error){status(error.message,true);}finally{busy(false);}
});
$('export-followup').addEventListener('click',async()=>{
  try{
    busy(true);
    const event=readEvent();
    await download(buildOrganizer(excelReady(),event,participants,plans,choices),
      'Transbora_SUIVI_RESERVATIONS_'+fileName(event.title));
    status('Tableau de réservation mis à jour avec les choix importés.');
  }catch(error){status(error.message,true);}finally{busy(false);}
});
$('export-personal-zip').addEventListener('click',async()=>{
  try{
    busy(true);
    if(!globalThis.JSZip)throw new Error('Le module ZIP est indisponible. Rechargez la page.');
    const event=readEvent(),archive=new JSZip();
    const names=new Set();
    for(let i=0;i<participants.length;i++){
      const p=participants[i];
      const book=buildIndividual(excelReady(),event,p,plans,choices);
      let name='Transbora_'+fileName(displayName(p))+'_'+p.id+'.xlsx';
      if(names.has(name))name=fileName(displayName(p))+'_'+i+'.xlsx';
      names.add(name);
      archive.file(name,await bytes(book));
      if(i%3===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    archive.file('LIRE_AVANT_ENVOI.txt',[
      'TRANSBORA — PROPOSITIONS INDIVIDUELLES',
      'Un Excel par voyageur. Ne transmettez à chacun QUE son fichier .xlsx.',
      'Dans chaque Excel, remplir X pour UN ALLER et UN RETOUR.',
      'Renvoyer les fichiers complétés à l’organisateur par e-mail.',
      'Les horaires sont théoriques. Aucun billet n’est réservé.',
      'Données personnelles : conserver ces fichiers de manière sécurisée.'
    ].join('\r\n'));
    const zipped=await archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
    saveBytes(zipped,'Transbora_INDIVIDUELS_'+fileName(event.title)+'.zip','application/zip');
    status(participants.length+' fichiers personnels regroupés en un ZIP, prêt à être partagé individuellement.');
  }catch(error){status(error.message,true);}finally{busy(false);}
});
$('copy-invitation').addEventListener('click',async()=>{
  try{
    const event=readEvent();
    const message=['Bonjour,','',
      'Pour préparer votre déplacement pour '+event.title+' à '+event.destination+
      ', vous trouverez ci-joint un fichier Excel avec plusieurs propositions d’horaires.',
      'Ouvrez « Mes choix », inscrivez X dans la colonne jaune sur un ALLER et un RETOUR,'+
      ' puis renvoyez-moi le fichier enregistré en pièce jointe.',
      'Aucun billet n’est réservé à ce stade : les horaires et tarifs seront vérifiés avant achat.',
      '','Merci !'].join('\n');
    await navigator.clipboard.writeText(message);
    msg($('copy-invitation-status'),'✅ Message copié : collez-le dans votre e-mail avec le fichier Excel.');
  }catch(error){
    msg($('copy-invitation-status'),'Copie non disponible : '+error.message,true);
  }
});
$('import-replies').addEventListener('change',async e=>{
  const files=[...(e.target.files||[])];
  if(!files.length)return;
  const errors=[];let read=0,updated=0;
  try{
    if(!hasSearched)throw new Error('Effectuez une recherche avant de réimporter les choix.');
    busy(true);
    for(const file of files.slice(0,100)){
      try{
        if(!/\.xlsx$/i.test(file.name)||file.size>SITE_FILE_SIZE)
          throw new Error('Excel .xlsx requis (5 Mo maximum).');
        const result=await readDecisions(excelReady(),await file.arrayBuffer(),participants,plans);
        read++;updated+=Object.values(result.choices).reduce((n,obj)=>n+Object.keys(obj).length,0);
        for(const [id,obj] of Object.entries(result.choices))choices[id]={...(choices[id]||{}),...obj};
        errors.push(...result.warnings.map(x=>file.name+' : '+x));
      }catch(error){errors.push(file.name+' : '+error.message);}
    }
    msg($('reply-status'),read+' fichier(s) lu(s), '+updated+
      ' choix accepté(s).'+(errors.length?' Vérifications : '+errors.slice(0,6).join(' / '):''),Boolean(errors.length));
    if(read)status('Réponses consolidées. Exportez « Suivi des réservations actualisé ».'),
      renderIndividualButtons(readEvent());
  }catch(error){msg($('reply-status'),error.message,true);}
  finally{busy(false);e.target.value='';}
});

/** One active wizard screen and one main footer action, never a long scrolling form. */
const screenIds=['etape-1','etape-2','etape-3','etape-4'];
const screenTitles=['Événement','Voyageurs','Trajets','Liens'];
function showStep(number,{focus=true}={}){
  activeStep=Math.max(1,Math.min(4,number));
  currentView='wizard';
  $('wizard-shell').hidden=false;
  $('reply-screen').hidden=true;
  screenIds.forEach((id,i)=>{$(id).hidden=i!==activeStep-1;});
  $('step-counter').textContent='Étape '+activeStep+' sur 4';
  $('step-label').textContent=screenTitles[activeStep-1];
  $('step-progress').setAttribute('aria-valuenow',String(activeStep));
  $('step-progress-fill').style.width=activeStep*25+'%';
  [...document.querySelectorAll('.progress-dots span')].forEach((dot,i)=>{
    dot.classList.toggle('current',i===activeStep-1);
    dot.classList.toggle('done',i<activeStep-1);
  });
  updateButtons();
  scheduleDraft();
  if(focus)$(screenIds[activeStep-1]).querySelector('h1')?.focus?.();
  window.scrollTo({top:0,behavior:'instant'});
}
function showReplies(){
  updateRepliesUI();
  currentView='replies';
  $('wizard-shell').hidden=true;
  $('reply-screen').hidden=false;
  toggleHelp(false,{focus:false});
  $('replies-heading').setAttribute('tabindex','-1');
  $('replies-heading').focus();
  window.scrollTo({top:0,behavior:'instant'});
}
function validateStep(){
  if(activeStep===1){
    readEvent();
  }else if(activeStep===2){
    if(!participants.length)throw new Error('Ajoutez au moins un voyageur.');
  }else if(activeStep===3){
    if(!hasSearched)throw new Error('Lancez la recherche avant de continuer.');
  }
}
$('wizard-next').addEventListener('click',()=>{
  try{
    validateStep();
    if(activeStep<4)showStep(activeStep+1);
    status('');
  }catch(error){
    status(error.message,true);
    const field=activeStep===1?
      ($('event-title').value.trim()?$('event-destination'):$('event-title')):
      null;
    field?.focus();
  }
});
$('wizard-back').addEventListener('click',()=>{if(activeStep>1)showStep(activeStep-1);});
$('clear-saved-draft').addEventListener('click',()=>{
  if(!confirm('Créer un nouvel événement ? Le brouillon actuel sera remplacé, mais vos dossiers déjà créés seront conservés.'))return;
  eraseDraft(localStorage);
  location.assign('./events.html?new=1');
});
$('menu-event').addEventListener('click',()=>{
  toggleHelp(false,{focus:false});
  showStep(activeStep);
});


$('back-to-wizard').addEventListener('click',()=>showStep(activeStep));

function toggleHelp(show,{focus=true}={}){
  const drawer=$('help-drawer');
  const backdrop=$('help-backdrop');
  drawer.setAttribute('aria-hidden',String(!show));
  drawer.inert=!show;
  drawer.classList.toggle('open',show);
  backdrop.hidden=!show;
  document.body.classList.toggle('drawer-active',show);
  $('help-open').setAttribute('aria-expanded',String(show));
  if(focus){if(show)drawer.focus();else $('help-open').focus();}
}
$('help-open').addEventListener('click',()=>toggleHelp($('help-drawer').getAttribute('aria-hidden')==='true'));
$('help-close').addEventListener('click',()=>toggleHelp(false));
$('help-backdrop').addEventListener('click',()=>toggleHelp(false));
showStep(1,{focus:false});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('help-drawer').classList.contains('open'))toggleHelp(false);});
init();
