/** TRANSBORA — organizer workbench. All user content uses textContent. */
import {createRehearsalApi} from './organizer-rehearsal.mjs';
import {createSearchHandoff,buildSearchHandoff,readSearchResults,RESULTS_KEY} from './organizer-bridge.mjs';
import {nativeLinkFor} from './organizer-replies-bridge.mjs';
import {readHistory} from './event-history.mjs';
import {api as nativeChoicesApi} from './native-choices.mjs';
import {FRENCH_RAIL_CARDS,unpackRailCards,packRailCards} from './reduction-cards.mjs';
import {monthLedger,personMonthLedger} from './organizer-monthly.mjs';
import {ledgerPrintHtml} from './organizer-monthly-export.mjs';
import {monthlyTravelPdf,travelPdfName} from './organizer-monthly-pdf.mjs';
const $=id=>document.getElementById(id);
const state={user:null,data:{},mode:'login',tab:'overview',demo:false,activeSearchEventId:null,sharedHandoff:null};
let rehearsal=null;
const kinds=['person','event','participation','option','choice','booking','note'];
const node=(tag,cls,text)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined)e.textContent=String(text);return e;
};
const fmtEuro=v=>v===null||v===undefined?'Montant inconnu':
  new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v/100);
const fmtDate=v=>/^\d{4}-\d\d-\d\d$/.test(v||'')?
  v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):String(v||'');
const val=(fd,key)=>String(fd.get(key)||'').trim();
const money=v=>v===''?null:Math.round(Number(v.replace(',','.'))*100);
const items=t=>state.data[t]||[];
const byId=(type,id)=>items(type).find(x=>x.id===id);
const displayPerson=id=>byId('person',id)?.name||'Personne indisponible';
const displayEvent=id=>byId('event',id)?.title||'Événement indisponible';
const displayParticipation=id=>{
 const p=byId('participation',id);
 return p?displayPerson(p.personId)+' · '+displayEvent(p.eventId):'Participation inconnue';
};
function feedback(message,error=false,auth=false){
 const e=$(auth?'auth-feedback':'global-feedback');
 e.textContent=message;e.classList.toggle('error',error);e.hidden=false;
}
async function api(action,payload={}){
 if(state.demo)return rehearsal(action,payload);
 let response;
 try{
  response=await fetch('/api/transbora-workspace',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})
  });
 }catch{throw Error('Le service sécurisé est momentanément indisponible.');}
 let result={};try{result=await response.json()}catch{}
 if(!response.ok)throw Error(result.error||'Action refusée ('+response.status+').');
 return result;
}
function showMode(mode){
 state.mode=mode;
 $('bootstrap-fields').hidden=mode!=='bootstrap';
 $('switch-setup').hidden=mode!=='login';
 $('switch-login').hidden=mode==='login'||mode==='invite';
 $('auth-title').textContent=mode==='bootstrap'?'Créer un espace organisateur':
  mode==='invite'?'Accepter votre invitation':'Retrouver mon organisation';
 $('auth-description').textContent=mode==='bootstrap'?
  'Initialisation unique de votre compagnie. Utilisez le code privé configuré sur Netlify.':
  mode==='invite'?'Choisissez votre mot de passe pour rejoindre votre équipe.':
  'Connectez-vous avec votre adresse et votre mot de passe.';
 $('auth-submit').textContent=mode==='bootstrap'?'Créer mon organisation':
   mode==='invite'?'Activer mon accès':'Se connecter';
 $('auth-password').autocomplete=mode==='login'?'current-password':'new-password';
 $('auth-feedback').hidden=true;
}
$('switch-setup').addEventListener('click',()=>showMode('bootstrap'));
$('switch-login').addEventListener('click',()=>showMode('login'));
const params=new URLSearchParams(location.hash.slice(1));
const inviteToken=params.get('invite');
if(inviteToken){
 showMode('invite');$('auth-email').value=params.get('email')||'';
 $('auth-email').readOnly=true;
}
$('auth-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=$('auth-submit'),fd=new FormData(e.currentTarget);
 btn.disabled=true;
 try{
  if(state.mode==='invite'){
   await api('accept_invite',{token:inviteToken,email:val(fd,'email'),password:val(fd,'password')});
   history.replaceState({},'',location.pathname);showMode('login');
   feedback('Invitation acceptée ! Connectez-vous avec les mêmes identifiants.',false,true);
  }else{
   if(state.mode==='bootstrap'){
    await api('bootstrap',{setupKey:val(fd,'setupKey'),
     organizationName:val(fd,'organizationName'),
     email:val(fd,'email'),password:val(fd,'password')});
   }
   await api('login',{email:val(fd,'email'),password:val(fd,'password')});
   $('auth-password').value='';showMode('login');await connect();
  }
 }catch(ex){feedback(ex.message,true,true)}
 finally{btn.disabled=false;}
});
$('logout').addEventListener('click',async()=>{
 try{await api('logout')}catch{}
 state.user=null;state.data={};$('private-panel').hidden=true;
 $('login-panel').hidden=false;showMode('login');
});
function options(sel,values,placeholder='Sélectionner…'){
 const prev=sel.value;
 sel.replaceChildren();
 const empty=node('option',null,placeholder);empty.value='';
 sel.append(empty);
 for(const [value,label] of values){const opt=node('option',null,label);opt.value=value;sel.append(opt);}
 if([...sel.options].some(x=>x.value===prev))sel.value=prev;
}

/* Compact card picker keeps the same saved person.reductionCards field. */
const cardList=$('person-card-options');
let currentCardGroup='';
for(const entry of FRENCH_RAIL_CARDS){
 if(entry.group!==currentCardGroup){
  currentCardGroup=entry.group;
  cardList.append(node('strong','card-group-heading',currentCardGroup));
 }
 const label=node('label','card-choice');
 const input=node('input');input.type='checkbox';input.value=entry.name;
 label.append(input,node('span',null,entry.name));cardList.append(label);
}
function selectedCardLabels(){
 return [...cardList.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
}
function updateCardCaption(){
 const known=selectedCardLabels(),other=$('person-card-other').value.trim();
 const count=known.length+(other?1:0);
 $('person-card-summary').textContent=count?count===1?(known[0]||other):
  count+' sélectionnés':'Aucun';
}
function setCardsFromSaved(value){
 const saved=unpackRailCards(value);
 for(const input of cardList.querySelectorAll('input[type="checkbox"]'))
  input.checked=saved.known.includes(input.value);
 $('person-card-other').value=saved.other;
 updateCardCaption();
 $('person-form').elements.reductionCards.value=String(value||'');
}
function applyCardsToForm(){
 $('person-form').elements.reductionCards.value=
  packRailCards(selectedCardLabels(),$('person-card-other').value);
}
cardList.addEventListener('change',updateCardCaption);
$('person-card-other').addEventListener('input',updateCardCaption);
function fillSelects(){
 const persons=items('person').map(p=>[p.id,p.name]),
   events=items('event').map(e=>[e.id,e.title+' · '+fmtDate(e.startDate)]);
 const participants=items('participation').map(p=>[p.id,displayParticipation(p.id)]);
 options($('month-person'),persons,'Tous les artistes');
 options($('search-event-select'),events,'Choisir…');
 const matches=$('registered-person-names');matches.replaceChildren();
 for(const person of items('person')){
   const item=node('option');item.value=person.name;item.label=person.departure||'';
   matches.append(item);
 }
 const hint=$('participation-person-find');
 if(hint?.dataset.personId){
   const person=byId('person',hint.dataset.personId);
   if(person)hint.value=person.name;
 }

 for(const sel of document.querySelectorAll('#participation-form select[name="personId"]'))options(sel,persons);
 for(const sel of document.querySelectorAll('#participation-form select[name="eventId"]'))options(sel,events);
 for(const sel of document.querySelectorAll('#option-form select[name="participationId"],#choice-form select[name="participationId"]'))options(sel,participants);
 options($('booking-form').elements.optionId,items('option').map(o=>
  [o.id,displayParticipation(o.participationId)+' · '+(o.direction==='A'?'Aller':'Retour')+
   ' · '+fmtDate(o.travelDate)+' '+(o.legs?.[0]?.departure||'')]),'Sélectionner un trajet');
 refreshChoiceSelects();
 refreshNoteTargets();
}
function refreshChoiceSelects(){
 const fd=$('choice-form').elements,pid=fd.participationId.value,dir=fd.direction.value;
 const matching=items('option').filter(o=>o.participationId===pid&&o.direction===dir);
 const arr=matching.map(o=>[o.id,
  fmtDate(o.travelDate)+' · '+(o.legs?.[0]?.from||'')+' → '+(o.legs?.at(-1)?.to||'')+
  ' · '+(o.legs?.[0]?.departure||'')]);
 options(fd.firstOptionId,arr,'Aucun choix');
 options(fd.backupOptionId,arr,'Aucune alternative');
}
$('choice-form').elements.participationId.addEventListener('change',refreshChoiceSelects);
$('choice-form').elements.direction.addEventListener('change',refreshChoiceSelects);
function refreshNoteTargets(){
 const fd=$('note-form').elements,type=fd.targetType.value;
 options(fd.targetId,(type==='person'?items('person'):items('event'))
  .map(p=>[p.id,p.name||p.title]));
}
$('note-form').elements.targetType.addEventListener('change',refreshNoteTargets);
async function reload(){
 const results=await Promise.all(kinds.map(type=>api('list',{type})));
 for(let i=0;i<kinds.length;i++)state.data[kinds[i]]=results[i].items||[];
 fillSelects();renderEverything();
}
async function connect(){
 state.user=await api('me');
 $('login-panel').hidden=true;$('private-panel').hidden=false;
 $('company-name').textContent=state.demo?'':state.user.organizationName||'';
 $('company-name').hidden=state.demo||!state.user.organizationName;
 $('user-identity').textContent=state.user.email+
  (state.user.role==='manager'?' · direction':' · organisatrice');
 $('demo-warning').hidden=true;
 $('invite-form').hidden=state.demo||state.user.role!=='manager';
 $('export-backup').hidden=state.user.role!=='manager';
 $('reset-demo').hidden=!state.demo;
 $('logout').hidden=state.demo;
 $('refresh-workspace').hidden=state.demo;
 $('shared-workspace-access').hidden=!state.demo;
 $('shared-replies-hint').hidden=state.demo;
 $('team-secret-hint').hidden=true;
 $('demo-backup-import').hidden=!state.demo;
 $('workspace-legal').textContent=state.demo?
  'Horaires indicatifs. Prix et places à vérifier · Données de cet appareil uniquement.':
  'Horaires indicatifs. Prix et places à vérifier · Espace partagé : actualisez pour voir les changements.';
 if(state.demo)$('user-identity').textContent='';
 $('user-identity').hidden=state.demo;
 $('month-filter').value=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
 $('budget-month-filter').value=$('month-filter').value;
 await reload();
 // On an empty current month, display the most recent recorded event rather
 // than an empty dashboard (also makes historical rehearsal data discoverable).
 if(items('event').length&&!items('event').some(e=>e.startDate?.startsWith($('month-filter').value))){
  const recent=[...items('event')].sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0];
  if(recent?.startDate){
   $('month-filter').value=recent.startDate.slice(0,7);
   $('budget-month-filter').value=$('month-filter').value;
   await renderBudget();
   renderMonthly();
  }
 }
 showTab('overview');
}
function closeMobileNav(){
 $('tabs').classList.remove('open');
 $('nav-backdrop').hidden=true;
 $('nav-toggle').setAttribute('aria-expanded','false');
}
function showTab(tab){
 state.tab=tab;
 for(const btn of $('tabs').querySelectorAll('[data-tab]')){
  const selected=btn.dataset.tab===tab;
  if(selected)btn.setAttribute('aria-current','page');
  else btn.removeAttribute('aria-current');
 }
 for(const section of document.querySelectorAll('.tab-panel'))
  section.hidden=section.id!=='panel-'+tab;
 $('global-feedback').hidden=true;
 closeMobileNav();
 if(tab==='search'&&!state.activeSearchEventId)
  $('search-context').textContent='';
 if(tab!=='people')closePersonEditor();
 if(tab!=='events')closeEventEditor();
 closeGlobalSearch();
}
$('nav-toggle').addEventListener('click',()=>{
 const opened=$('tabs').classList.toggle('open');
 $('nav-toggle').setAttribute('aria-expanded',String(opened));
 $('nav-backdrop').hidden=!opened;
});
$('nav-backdrop').addEventListener('click',closeMobileNav);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileNav();});
$('refresh-workspace').addEventListener('click',async()=>{
 const button=$('refresh-workspace');button.disabled=true;
 try{
  const month=$('month-filter').value,person=$('month-person').value;
  await reload();
  $('month-filter').value=month;
  $('budget-month-filter').value=month;
  $('month-person').value=person;
  renderMonthly();
  await renderBudget();
  feedback('✅ Données de l’équipe actualisées.');
 }catch(error){feedback('Actualisation impossible : '+error.message,true);}
 finally{button.disabled=false;}
});
$('tabs').addEventListener('click',e=>{
 const btn=e.target.closest('[data-tab]');if(btn)showTab(btn.dataset.tab);
});
function openIntegratedSearch(eventId){
 const event=byId('event',eventId);
 if(!event)throw Error('Événement inconnu.');
 const roster={event,people:items('person'),participations:items('participation')};
 state.sharedHandoff=state.demo?null:buildSearchHandoff(roster);
 if(state.demo)createSearchHandoff(window.localStorage,roster);
 state.activeSearchEventId=eventId;
 $('search-event-select').value=eventId;
 $('search-context').textContent=event.title+' · '+
   items('participation').filter(p=>p.eventId===eventId).length+' voyageur(s)';
 const frame=$('search-frame');
 // Reload only when the organizer explicitly chooses an event; changing
 // sidebar tabs never destroys the ongoing timetable search.
 frame.src=state.demo?'./events.html?from_organizer=1&embedded=1&ntl-drawer-state=hidden':
   './events.html?from_shared=1&embedded=1&ntl-drawer-state=hidden';
 $('search-frame-area').hidden=false;
 showTab('search');
}
$('search-open').addEventListener('click',()=>{
 try{openIntegratedSearch($('search-event-select').value)}
 catch(error){feedback(error.message,true);}
});
$('search-back-event').addEventListener('click',()=>showTab('events'));
$('participation-person-find').addEventListener('input',e=>{
 const name=e.currentTarget.value.trim().toLocaleLowerCase('fr-FR');
 const match=items('person').find(p=>p.name.trim().toLocaleLowerCase('fr-FR')===name);
 if(match){
  $('participation-form').elements.personId.value=match.id;
  e.currentTarget.dataset.personId=match.id;
 }else delete e.currentTarget.dataset.personId;
});
$('person-filter').addEventListener('input',e=>{
 const term=e.currentTarget.value.trim().toLocaleLowerCase('fr-FR');
 for(const card of $('people-output').children){
  card.hidden=Boolean(term)&&!card.textContent.toLocaleLowerCase('fr-FR').includes(term);
 }
});
$('open-booking-form').addEventListener('click',()=>{
 showTab('travels');showTravelPanel('booking');
});
$('budget-month-filter').addEventListener('change',()=>{
 $('month-filter').value=$('budget-month-filter').value;
 renderMonthly();
 renderBudget().catch(e=>feedback(e.message,true));
});
// Messages are only accepted from the loaded same-origin timetable iframe.
// Never consume owner capabilities, personal contacts, or arbitrary cross-origin data.
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||
   event.source!==$('search-frame').contentWindow)return;
 if(!state.demo&&event.data?.type==='transbora:shared-ready'){
  if(state.sharedHandoff&&state.sharedHandoff.eventId===state.activeSearchEventId)
   event.source.postMessage({type:'transbora:shared-handoff',
    handoff:state.sharedHandoff},location.origin);
  return;
 }
 if(!state.demo&&event.data?.type==='transbora:shared-routes-ready'){
  if(event.data.eventId!==state.activeSearchEventId||
     !Array.isArray(event.data.rows)||event.data.rows.length>1000)return;
  try{
   let imported=0,alreadyPresent=0;
   for(let i=0;i<event.data.rows.length;i+=3){
    const r=await api('import_search_results',{
     eventId:event.data.eventId,rows:event.data.rows.slice(i,i+3)
    });
    imported+=r.imported;alreadyPresent+=r.alreadyPresent;
   }
   await reload();
   $('search-context').textContent='✅ '+imported+' trajet(s) ajoutés, '+alreadyPresent+
    ' déjà présents. Prix et places à vérifier.';
  }catch(error){$('search-context').textContent='⚠ Import partagé impossible : '+error.message;}
  return;
 }
 if(event.data?.type==='transbora:open-tab'){
   if(['travels','events','answers','bookings'].includes(event.data.tab))
     showTab(event.data.tab);
   return;
 }
 if(!state.demo||event.data?.type!=='transbora:routes-ready'||
   event.data.eventId!==state.activeSearchEventId)return;
 const rows=readSearchResults(window.localStorage);
 if(!rows||rows.eventId!==state.activeSearchEventId)return;
 try{
  const result=await api('import_search_results',{eventId:rows.eventId,rows:rows.rows});
  window.localStorage.removeItem(RESULTS_KEY);
  await reload();
  $('search-context').textContent='✅ '+result.imported+
    ' trajet(s) enregistrés dans cet événement, '+result.alreadyPresent+
    ' déjà présent(s). Les réponses seront visibles dans « Réponses ».';
  // Do not leave the search iframe: the organizer may still be sending links.
 }catch(error){$('search-context').textContent='⚠ Import impossible : '+error.message;}
});
async function syncOneNativeEvent(eventId){
 if(!state.demo)throw Error('Synchronisation native réservée à la démonstration locale.');
 const mapping=nativeLinkFor(window.localStorage,eventId);
 if(!mapping)throw Error('Aucun dossier de choix lié à cet événement.');
 const owner=readHistory(window.localStorage).find(row=>row.eventId===mapping.nativeEventId);
 if(!owner)throw Error('Lien privé du suivi introuvable sur cet appareil. Ouvrez « Mes événements » ou réimportez son lien.');
 const report=await nativeChoicesApi('status',{
   eventId:mapping.nativeEventId,ownerKey:owner.ownerKey
 });
 // Owner capability and native report are transient. No ticket status, paid
 // amount or external personal data is copied into the local workbench.
 const result=await api('sync_native_answers',{mapping,report});
 await reload();
 return result;
}
function nativeSyncSummary(result){
 const incidents=result.conflicts.length?' ⚠ À contrôler : '+
   result.conflicts.slice(0,3).join(' / '):'';
 return '✅ Réponses : '+result.synced+' choix mis à jour, '+
   result.unchanged+' inchangé(s), '+result.pending+' en attente. '+
   'Aucun prix ou achat importé.'+incidents;
}
function card(title,lines=[]){
 const item=node('article','card');item.append(node('h3',null,title));
 for(const line of lines)item.append(node('p',null,line));
 return item;
}

/* 053 — Editors appear only when an item is selected or created.
   The lists themselves are the default landing views. */
function closePersonEditor(){
 $('person-editor').hidden=true;$('person-editor-backdrop').hidden=true;
}
function closeEventEditor(){
 $('event-editor').hidden=true;$('event-editor-backdrop').hidden=true;
}
function openPersonEditor(person=null){
 const form=$('person-form');form.reset();
 delete form.dataset.recordId;delete form.dataset.expectedUpdatedAt;
 setCardsFromSaved(person?.reductionCards||'');
 for(const field of ['name','departure','email','phone','preferences'])
  form.elements[field].value=person?.[field]||'';
 if(person){
  form.dataset.recordId=person.id;
  form.dataset.expectedUpdatedAt=person.updatedAt??'';
 }
 $('person-editor-title').textContent=person?'Fiche de '+person.name:'Ajouter une personne';
 form.querySelector('button[type="submit"],button:not([type])').textContent=
  person?'Enregistrer les modifications':'Enregistrer la personne';
 $('person-editor').hidden=false;$('person-editor-backdrop').hidden=false;
 form.elements.name.focus();
}
function openEventEditor(event=null){
 const form=$('event-form');form.reset();
 delete form.dataset.recordId;delete form.dataset.expectedUpdatedAt;
 for(const field of ['title','startDate','destination','theater'])
  form.elements[field].value=event?.[field]||'';
 form.elements.budgetEuros.value=event?.budgetCents==null?'':String(event.budgetCents/100);
 if(event){
  form.dataset.recordId=event.id;
  form.dataset.expectedUpdatedAt=event.updatedAt??'';
  $('participation-form').elements.eventId.value=event.id;
 }
 $('event-participation-region').hidden=!event;
 $('event-editor-title').textContent=event?event.title:'Ajouter un événement';
 form.querySelector('button[type="submit"],button:not([type])').textContent=
  event?'Enregistrer les modifications':'Enregistrer l’événement';
 $('event-editor').hidden=false;$('event-editor-backdrop').hidden=false;
 if(!event)form.elements.title.focus();
}
$('add-person-btn').addEventListener('click',()=>openPersonEditor());
$('person-editor-close').addEventListener('click',closePersonEditor);
$('person-editor-backdrop').addEventListener('click',closePersonEditor);
$('add-event-btn').addEventListener('click',()=>openEventEditor());
$('event-editor-close').addEventListener('click',closeEventEditor);
$('event-editor-backdrop').addEventListener('click',closeEventEditor);
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 closePersonEditor();closeEventEditor();
});
function directoryEntry(title,subtitle,handler){
 const entry=node('button','directory-entry');entry.type='button';
 const info=node('span');
 info.append(node('strong',null,title));
 info.append(node('small',null,subtitle));
 entry.append(info,node('span','entry-arrow','›'));
 entry.addEventListener('click',handler);
 return entry;
}
function listEmpty(host,message,buttonText,handler){
 const box=node('div','list-empty');
 box.append(node('p',null,message));
 if(buttonText){
  const btn=node('button','secondary',buttonText);
  btn.type='button';btn.addEventListener('click',handler);box.append(btn);
 }
 host.append(box);
}
/* Only the selected record's fields can open: no three stacked forms. */
function showTravelPanel(mode='detail',optionId){
 if(optionId!==undefined)state.travelOptionId=optionId;
 if(mode==='add')state.travelOptionId=null;
 const o=byId('option',state.travelOptionId);
 const panel=$('travel-work-panel'),layout=panel.closest('.travels-layout');
 panel.hidden=false;layout.classList.add('is-open');
 const form=$('option-form'),choice=$('choice-form').elements,ticket=$('booking-form').elements;
 $('travel-panel-title').textContent=
  mode==='add'?'Ajouter un trajet':o?displayParticipation(o.participationId):'Suivi du trajet';
 const summary=$('travel-selected-summary');summary.replaceChildren();
 if(o){
  const legs=o.legs||[],last=legs.at(-1),first=legs[0];
  summary.append(node('p',null,displayParticipation(o.participationId)));
  summary.append(node('p',null,fmtDate(o.travelDate)+' · '+(o.direction==='A'?'Aller':'Retour')));
  for(const l of legs)summary.append(node('p',null,
   (l.departure||'')+' '+(l.from||'')+' → '+(l.arrival||'')+' '+(l.to||'')));
  const booking=items('booking').find(b=>b.optionId===o.id);
  summary.append(node('p',null,booking?.filedAt?'Billet classé':booking?.paidAt?'Billet payé':
   booking?.inCartAt?'Dans le panier':'Pas encore acheté'));
  summary.append(node('p',null,'Prix payé : '+(booking?.paidAt?fmtEuro(booking.paidCents):'—')));
  if(legs.length>1)summary.append(node('p','tiny',
   'Trajet avec correspondances : conserver les différentes étapes enregistrées.'));
 }else summary.append(node('p','muted',mode==='add'?
  'Renseignez uniquement les informations du nouveau trajet.':
  'Choisissez un trajet dans la liste, ou ajoutez-en un.'));
 const actionbar=panel.querySelector('.travel-panel-actions');
 actionbar.hidden=mode==='add'||!o;
 $('travel-edit').hidden=!o||o.legs?.length!==1;
 $('travel-choose').hidden=!o;
 $('travel-book').hidden=!o;
 for(const [key,wrap] of [['edit','travel-form-wrap'],['add','travel-form-wrap'],
  ['choice','travel-choice-wrap'],['booking','travel-book-wrap']])
  if(mode===key)$(wrap).hidden=false;
 for(const id of ['travel-form-wrap','travel-choice-wrap','travel-book-wrap']){
  if(!((id==='travel-form-wrap'&&(mode==='edit'||mode==='add'))||
   (id==='travel-choice-wrap'&&mode==='choice')||
   (id==='travel-book-wrap'&&mode==='booking')))$(id).hidden=true;
 }
 for(const [id,m] of [['travel-edit','edit'],['travel-choose','choice'],['travel-book','booking']])
  $(id).setAttribute('aria-pressed',String(mode===m));
 if(mode==='add'||mode==='edit'){
  form.reset();delete form.dataset.recordId;delete form.dataset.expectedUpdatedAt;
  form.querySelector('button[type="submit"],button:not([type])').textContent=
   mode==='edit'?'Enregistrer les modifications':'Ajouter cette option de voyage';
  if(mode==='edit'&&o&&o.legs?.length===1){
   const l=o.legs[0];form.dataset.recordId=o.id;
   form.dataset.expectedUpdatedAt=o.updatedAt??'';
   form.elements.participationId.value=o.participationId;
   form.elements.direction.value=o.direction;
   form.elements.travelDate.value=o.travelDate;
   form.elements.from.value=l.from||'';
   form.elements.to.value=l.to||'';
   form.elements.departure.value=l.departure||'';
   form.elements.arrival.value=l.arrival||'';
   form.elements.estimatedEuros.value=o.estimatedCents==null?'':String(o.estimatedCents/100);
  }
 }
 if(mode==='choice'&&o){
  choice.participationId.value=o.participationId;choice.direction.value=o.direction;
  refreshChoiceSelects();
  const existing=items('choice').find(c=>c.participationId===o.participationId&&c.direction===o.direction);
  choice.firstOptionId.value=existing?.firstOptionId&&
   items('option').some(x=>x.id===existing.firstOptionId)?existing.firstOptionId:o.id;
  choice.backupOptionId.value=existing?.backupOptionId||'';
 }
 if(mode==='booking'){
  if(o)ticket.optionId.value=o.id;
  const existing=items('booking').find(b=>b.optionId===ticket.optionId.value);
  ticket.stage.value=existing?.filedAt?'FILED':existing?.paidAt?'PAID':
   existing?.inCartAt?'IN_CART':'PROPOSED';
  ticket.paidEuros.value=existing?.paidCents==null?'':String(existing.paidCents/100);
  ticket.receiptReference.value=existing?.receiptReference||'';
 }
}
function closeTravelPanel(){
 $('travel-work-panel').hidden=true;
 $('travel-work-panel').closest('.travels-layout').classList.remove('is-open');
 state.travelOptionId=null;
}
$('travel-panel-close').addEventListener('click',closeTravelPanel);
$('add-travel-btn').addEventListener('click',()=>showTravelPanel('add'));
$('travel-edit').addEventListener('click',()=>showTravelPanel('edit'));
$('travel-choose').addEventListener('click',()=>showTravelPanel('choice'));
$('travel-book').addEventListener('click',()=>showTravelPanel('booking'));
function renderJourneys(){
 const host=$('journeys-output');host.replaceChildren();
 const event=$('travel-event-filter').value,person=$('travel-person-filter').value;
 const all=items('option').sort((a,b)=>a.travelDate.localeCompare(b.travelDate));
 const rows=all.filter(o=>{
  const participation=byId('participation',o.participationId);
  return participation&&(!event||participation.eventId===event)&&
    (!person||participation.personId===person);
 });
 $('travel-count').textContent=rows.length+' trajet(s) enregistré(s)';
 for(const o of rows){
  const booking=items('booking').find(b=>b.optionId===o.id);
  const first=o.legs?.[0],last=o.legs?.at(-1);
  const status=booking?.filedAt?'Classé':booking?.paidAt?'Acheté':
   booking?.inCartAt?'Panier':'Proposé';
  const choice=items('choice').find(c=>c.participationId===o.participationId&&c.direction===o.direction);
  const rank=choice?.firstOptionId===o.id?' · Choix nº 1':
   choice?.backupOptionId===o.id?' · Choix nº 2':'';
  const subtitle=fmtDate(o.travelDate)+' · '+(o.direction==='A'?'Aller':'Retour')+
   ' · '+(first?.from||'')+' → '+(last?.to||'')+' · '+status+rank;
  const entry=directoryEntry(displayParticipation(o.participationId),
   subtitle,()=>showTravelPanel('detail',o.id));
  if(state.travelOptionId===o.id)entry.setAttribute('aria-current','true');
  host.append(entry);
 }
 if(!rows.length)listEmpty(host,
  all.length?'Aucun trajet ne correspond aux filtres.':
   'Aucun trajet enregistré. Créez d’abord un événement avec ses participants.',
  all.length?'Effacer les filtres':'＋ Ajouter un trajet',()=>{
   if(all.length){
    $('travel-event-filter').value='';$('travel-person-filter').value='';
    renderJourneys();
   }else showTravelPanel('add');
  });
}
for(const id of ['travel-event-filter','travel-person-filter'])
 $(id).addEventListener('change',renderJourneys);

/* Permanent global search: only registered in-app data, never remote guesses. */
const normalizeSearch=v=>String(v??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
function closeGlobalSearch(){
 $('site-search-results').hidden=true;
 $('site-search-input').setAttribute('aria-expanded','false');
}
function runGlobalSearch(value){
 const q=normalizeSearch(value),host=$('site-search-results');
 host.replaceChildren();
 if(!q){closeGlobalSearch();return;}
 const found=[],add=(kind,id,title,subtitle,text)=>{
  if(normalizeSearch([title,subtitle,text].join(' ')).includes(q))
   found.push({kind,id,title,subtitle});
 };
 for(const p of items('person'))add('person',p.id,'👤 '+p.name,
  p.departure||'Gare non renseignée',[p.email,p.phone,p.reductionCards,p.preferences].join(' '));
 for(const e of items('event'))add('event',e.id,'📅 '+e.title,
  fmtDate(e.startDate)+' · '+(e.destination||''),e.theater);
 for(const o of items('option')){
  const p=byId('participation',o.participationId);
  if(!p)continue;
  const booking=items('booking').find(b=>b.optionId===o.id);
  const status=booking?.paidAt?'acheté payé':
   booking?.inCartAt?'panier':'billet non acheté proposé';
  const first=o.legs?.[0],last=o.legs?.at(-1);
  add('travel',o.id,'🚆 '+displayPerson(p.personId),
   fmtDate(o.travelDate)+' · '+(first?.from||'')+' → '+(last?.to||''),
   displayEvent(p.eventId)+' '+status+' '+(o.direction==='A'?'aller':'retour'));
 }
 for(const n of items('note'))add('note',n.id,'📝 '+(n.targetType==='person'?
  displayPerson(n.targetId):displayEvent(n.targetId)),n.content,'notes');
 if(q.includes('billet')&&(q.includes('non achet')||q.includes('a acheter'))){
  // The existing status words are indexed above; no synthetic purchases.
 }
 if(!found.length)host.append(node('p','site-search-empty','Aucun résultat dans TRANSBORA.'));
 for(const row of found.slice(0,24)){
  const button=node('button','site-search-result');
  button.type='button';button.setAttribute('role','option');
  button.append(node('span',null,row.title),node('small',null,row.subtitle));
  button.addEventListener('click',()=>{
   $('site-search-input').value='';
   closeGlobalSearch();
   if(row.kind==='person'){showTab('people');openPersonEditor(byId('person',row.id));}
   else if(row.kind==='event'){showTab('events');openEventEditor(byId('event',row.id));}
   else if(row.kind==='travel'){showTab('travels');showTravelPanel('detail',row.id);}
   else showTab('notes');
  });
  host.append(button);
 }
 host.hidden=false;$('site-search-input').setAttribute('aria-expanded','true');
}
$('site-search-input').addEventListener('input',e=>runGlobalSearch(e.currentTarget.value));
$('site-search-input').addEventListener('keydown',e=>{
 if(e.key==='Escape')closeGlobalSearch();
 if(e.key==='Enter'&&!$('site-search-results').hidden){
  const first=$('site-search-results').querySelector('button');
  if(first){e.preventDefault();first.click();}
 }
});
document.addEventListener('click',e=>{
 if(!e.target.closest('#site-search'))closeGlobalSearch();
});

function renderEverything(){
 const people=$('people-output');people.replaceChildren();
 for(const p of [...items('person')].sort((a,b)=>a.name.localeCompare(b.name,'fr'))){
  const subtitle=[p.departure||'Gare à préciser',
   p.reductionCards?'Cartes renseignées':''].filter(Boolean).join(' · ');
  people.append(directoryEntry(p.name,subtitle,()=>openPersonEditor(p)));
 }
 if(!items('person').length)listEmpty(people,
  'Aucune personne enregistrée.','＋ Ajouter une personne',()=>openPersonEditor());
 $('person-filter').dispatchEvent(new window.Event('input'));
 renderMonthly();
 const events=$('events-output');events.replaceChildren();
 for(const event of [...items('event')].sort((a,b)=>a.startDate.localeCompare(b.startDate))){
  const n=items('participation').filter(p=>p.eventId===event.id).length;
  const row=node('div','directory-event-row');
  row.append(directoryEntry(event.title,
   fmtDate(event.startDate)+' · '+(event.destination||'Ville à préciser')+
   ' · '+n+' personne(s)',()=>openEventEditor(event)));
  const search=node('button','secondary','🔎 Trouver les trajets');
  search.type='button';
  search.addEventListener('click',()=>{
   try{openIntegratedSearch(event.id);}
   catch(error){feedback(error.message,true);}
  });
  row.append(search);
  if(state.demo){
   const mapping=nativeLinkFor(window.localStorage,event.id);
   if(mapping){
    const sync=node('button','outline','↻ Réponses');
    sync.type='button';
    sync.addEventListener('click',async()=>{
     sync.disabled=true;
     try{
      const result=await syncOneNativeEvent(event.id);
      showTab('events');
      feedback(nativeSyncSummary(result),Boolean(result.conflicts.length));
     }catch(error){feedback('Synchronisation impossible : '+error.message,true);}
     finally{sync.disabled=false;}
    });
    row.append(sync);
   }
  }
  events.append(row);
 }
 if(!items('event').length)listEmpty(events,
  'Aucun événement enregistré.','＋ Ajouter un événement',()=>openEventEditor());
 renderJourneys();
 const answers=$('answers-output');answers.replaceChildren();
 for(const participation of items('participation')){
  const event=byId('event',participation.eventId);
  if(!event)continue;
  const records=items('choice').filter(x=>x.participationId===participation.id);
  const lines=['Événement : '+event.title];
  for(const dir of ['A','R']){
   const row=records.find(x=>x.direction===dir);
   const title=dir==='A'?'Aller':'Retour';
   if(!row){lines.push(title+' : en attente de réponse');continue;}
   const first=items('option').find(x=>x.id===row.firstOptionId);
   const backup=items('option').find(x=>x.id===row.backupOptionId);
   lines.push(title+' : '+(row.firstOptionId==='NONE'?'aucun horaire souhaité':
    first?(fmtDate(first.travelDate)+' '+(first.legs[0]?.departure||'')+' → '+
        (first.legs.at(-1)?.to||'')):'choix sans horaire reconnu'));
   if(backup)lines.push('Solution de secours : '+fmtDate(backup.travelDate)+' '+backup.legs[0]?.departure);
  }
  const row=card(displayPerson(participation.personId),lines);
  if(state.demo&&nativeLinkFor(window.localStorage,event.id)){
   const refresh=node('button','item-action','🔄 Actualiser');
   refresh.type='button';
   refresh.addEventListener('click',async()=>{
    refresh.disabled=true;
    try{
     const result=await syncOneNativeEvent(event.id);
     showTab('answers');
     feedback(nativeSyncSummary(result),Boolean(result.conflicts.length));
    }catch(error){feedback('Synchronisation impossible : '+error.message,true);}
    finally{refresh.disabled=false;}
   });
   row.append(refresh);
  }else{
   const go=node('button','item-action','Ouvrir l’événement');
   go.type='button';go.addEventListener('click',()=>showTab('events'));
   row.append(go);
  }
  answers.append(row);
 }
 if(!items('participation').length)answers.append(node('p','muted','Aucune inscription.'));
 const tickets=$('bookings-output');tickets.replaceChildren();
 for(const booking of items('booking')){
  const option=items('option').find(o=>o.id===booking.optionId);
  if(!option)continue;
  tickets.append(card(displayParticipation(option.participationId),[
    (option.direction==='A'?'Aller':'Retour')+' · '+fmtDate(option.travelDate),
    booking.filedAt?'Billet classé':booking.paidAt?'Billet acheté':booking.inCartAt?'Dans le panier':'À acheter',
    'Montant payé : '+fmtEuro(booking.paidAt?booking.paidCents:null)
  ]));
 }
 if(!items('booking').length)tickets.append(node('p','muted','Aucun billet enregistré comme acheté.'));
 const notes=$('notes-output');notes.replaceChildren();
 for(const n of items('note').sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt))){
  const label=n.targetType==='person'?displayPerson(n.targetId):displayEvent(n.targetId);
  notes.append(card(label,[n.content,'Privé · '+n.updatedBy]));
 }
 if(!items('note').length)notes.append(node('p','muted','Aucune note privée.'));
 renderBudget().catch(error=>feedback(error.message,true));
}

function registerData(){
 return {people:items('person'),events:items('event'),
  participations:items('participation'),options:items('option'),
  choices:items('choice'),bookings:items('booking')};
}
function currentRegister(){
 return monthLedger(registerData(),$('month-filter').value,$('month-person').value);
}
function moneyShort(cents){
 return cents==null?'—':fmtEuro(cents);
}
function monthTitle(month){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month||''))return 'Choisir un mois';
 const [year,number]=month.split('-').map(Number);
 const title=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(Date.UTC(year,number-1,1)));
 return title.charAt(0).toUpperCase()+title.slice(1);
}
function moveMonth(month,step){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month||''))return month;
 const [year,number]=month.split('-').map(Number);
 const date=new Date(Date.UTC(year,number-1+step,1));
 return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');
}
function monthStage(row){
 if(row.pending)return {label:'À rechercher',tone:'urgent'};
 if(row.filed)return {label:'Billet classé',tone:'done'};
 if(row.paid)return {label:'Billet acheté',tone:'done'};
 if(row.cart)return {label:'Dans le panier',tone:'action'};
 if(row.choiceRank)return {label:'Choix nº '+row.choiceRank,tone:'action'};
 return {label:'Proposé',tone:'neutral'};
}
const monthDetailState={row:null,restoreFocus:null};
function closeMonthDetail({restoreFocus=true}={}){
 const active=$('month-detail');
 if(active.hidden)return;
 active.hidden=true;
 $('month-stage').classList.remove('detail-open');
 $('month-detail-backdrop').hidden=true;
 document.body.classList.remove('month-dialog-open');
 if(restoreFocus&&monthDetailState.restoreFocus?.isConnected)
  monthDetailState.restoreFocus.focus?.({preventScroll:true});
 monthDetailState.row=null;
 monthDetailState.restoreFocus=null;
}
function detailField(host,label,value){
 const group=node('div','month-detail-field');
 group.append(node('dt',null,label),node('dd',null,value));
 host.append(group);
}
function openMonthDetail(row,origin=null){
 closeMonthDetail({restoreFocus:false});
 monthDetailState.row=row;
 monthDetailState.restoreFocus=origin;
 $('month-detail-date').textContent=fmtDate(row.date)+' · '+row.direction;
 $('month-detail-title').textContent=row.person;
 const content=$('month-detail-body');content.replaceChildren();
 const status=monthStage(row);
 const pill=node('span','month-badge month-badge--'+status.tone,status.label);
 content.append(pill);
 const details=node('dl','month-detail-fields');
 detailField(details,'Événement',row.event);
 detailField(details,'Départ',row.from+(row.departure?' · '+row.departure:''));
 detailField(details,'Arrivée',row.to+(row.arrival?' · '+row.arrival:''));
 detailField(details,'Choix',row.choiceRank?'Option nº '+row.choiceRank:'Non retenu');
 detailField(details,'Panier',row.cart?'Oui':'Non');
 detailField(details,'Billet payé',row.paid?'Oui':'Non');
 if(row.paid)detailField(details,'Prix réellement payé',
  row.paidCents==null?'Montant non renseigné':fmtEuro(row.paidCents));
 else if(row.estimateCents!=null)
  detailField(details,'Prix estimé',fmtEuro(row.estimateCents));
 if(row.filed)detailField(details,'Billet classé','Oui');
 if(row.receiptReference)detailField(details,'Référence',row.receiptReference);
 content.append(details);
 if(row.legs?.length>1){
  content.append(node('h4','month-connections-title','Correspondances'));
  const list=node('ol','month-connection-list');
  for(const leg of row.legs)list.append(node('li',null,
   (leg.departure||'')+' '+leg.from+' → '+(leg.arrival||'')+' '+leg.to));
  content.append(list);
 }
 $('month-detail-choice').hidden=row.pending;
 $('month-detail-booking').hidden=row.pending;
 $('month-detail-event').hidden=!row.pending;
 $('month-detail').hidden=false;
 $('month-stage').classList.add('detail-open');
 $('month-detail-backdrop').hidden=false;
 document.body.classList.add('month-dialog-open');
 $('month-detail-close').focus?.({preventScroll:true});
}
$('month-detail-close').addEventListener('click',()=>closeMonthDetail());
$('month-detail-backdrop').addEventListener('click',()=>closeMonthDetail());
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('month-detail').hidden){
  event.preventDefault();closeMonthDetail();
 }
});
function goToMonthChoice(row){
 const form=$('choice-form').elements;
 form.participationId.value=row.participationId;
 form.direction.value=row.direction==='Aller'?'A':'R';
 refreshChoiceSelects();
 const original=items('choice').find(x=>x.participationId===row.participationId&&x.direction===form.direction.value);
 form.firstOptionId.value=row.optionId;
 if(original?.backupOptionId&&original.backupOptionId!==row.optionId)
  form.backupOptionId.value=original.backupOptionId;
 closeMonthDetail({restoreFocus:false});
 showTab('travels');
 $('choice-form').scrollIntoView?.({behavior:'smooth',block:'start'});
}
function goToMonthTicket(row){
 const form=$('booking-form').elements;
 form.optionId.value=row.optionId;
 const booking=items('booking').find(x=>x.optionId===row.optionId);
 form.stage.value=booking?.filedAt?'FILED':booking?.paidAt?'PAID':booking?.inCartAt?'IN_CART':'PROPOSED';
 form.paidEuros.value=booking?.paidCents==null?'':String(booking.paidCents/100);
 form.receiptReference.value=booking?.receiptReference||'';
 closeMonthDetail({restoreFocus:false});
 showTab('travels');
 $('booking-form').scrollIntoView?.({behavior:'smooth',block:'start'});
}
function goToMonthEvent(){
 closeMonthDetail({restoreFocus:false});
 showTab('events');
 $('events-output').scrollIntoView?.({behavior:'smooth',block:'start'});
}
$('month-detail-choice').addEventListener('click',()=>{
 if(monthDetailState.row&&!monthDetailState.row.pending)goToMonthChoice(monthDetailState.row);
});
$('month-detail-booking').addEventListener('click',()=>{
 if(monthDetailState.row&&!monthDetailState.row.pending)goToMonthTicket(monthDetailState.row);
});
$('month-detail-event').addEventListener('click',goToMonthEvent);
function monthlyMobileCard(row){
 const article=node('article','month-mobile-card');
 const status=monthStage(row);
 article.classList.add('month-mobile-card--'+status.tone);
 const head=node('div','month-mobile-card-head');
 head.append(node('span','month-card-date',fmtDate(row.date)),
  node('span','month-badge month-badge--'+status.tone,status.label));
 article.append(head);
 article.append(node('h3','month-card-person',row.person));
 article.append(node('p','month-card-event',row.event+' · '+row.direction));
 article.append(node('p','month-card-route',row.from+' → '+row.to));
 if(row.departure||row.arrival)article.append(node('p','month-card-time',
  (row.departure||'—')+' → '+(row.arrival||'—')));
 const bottom=node('div','month-card-bottom');
 if(row.choiceRank)bottom.append(node('span','month-card-rank','Choix nº '+row.choiceRank));
 if(row.paid)bottom.append(node('span','month-card-money',
  row.paidCents==null?'Prix payé ?':fmtEuro(row.paidCents)));
 article.append(bottom);
 const actions=node('div','month-mobile-actions');
 const detail=node('button','outline','Ouvrir le trajet');
 detail.type='button';detail.addEventListener('click',()=>openMonthDetail(row,detail));
 actions.append(detail);
 article.append(actions);
 return article;
}
function renderMonthly(){
 const host=$('month-register-body'),mobile=$('month-mobile-cards');
 host.replaceChildren();mobile.replaceChildren();
 closeMonthDetail({restoreFocus:false});
 const month=$('month-filter').value;
 $('month-display').textContent=monthTitle(month);
 if(!month)return;
 let result;
 try{result=currentRegister();}
 catch(error){$('month-summary').textContent=error.message;return;}
 const s=result.summary,summary=$('month-summary');
 summary.replaceChildren();
 const metrics=[
  [s.travels+' trajet(s)','all'],
  [s.paid+' billet(s) acheté(s)','done'],
  [moneyShort(s.paidKnownCents)+' payés','total']
 ];
 if(s.paidUnknown)metrics.push([s.paidUnknown+' achat(s) sans prix','urgent']);
 if(s.pending)metrics.push([s.pending+' à rechercher','urgent']);
 for(const [value,tone] of metrics)
  summary.append(node('span','month-metric month-metric--'+tone,value));
 for(const row of result.rows){
  const tr=node('tr','month-table-row');
  if(row.pending)tr.classList.add('pending-month-row');
  else if(row.paid)tr.classList.add('paid-month-row');
  const stage=monthStage(row);
  const times=[row.departure||'',row.arrival||''].filter(Boolean).join(' → ');
  const route=row.from+' → '+row.to;
  tr.append(node('td','month-date-cell',fmtDate(row.date)),
   node('td','month-person-cell',row.person),
   node('td','month-event-cell',row.event));
  const routeCell=node('td','month-route-cell');
  routeCell.append(node('strong',null,route));
  if(times)routeCell.append(node('small',null,times));
  tr.append(routeCell);
  const statusCell=node('td','month-status-cell');
  statusCell.append(node('span','month-badge month-badge--'+stage.tone,stage.label));
  if(row.choiceRank&&row.paid)statusCell.append(node('small',null,'Choix nº '+row.choiceRank));
  tr.append(statusCell);
  const price=row.paid?
   row.paidCents===null?'?':moneyShort(row.paidCents):'—';
  const amount=node('td','month-price-cell',price);
  if(row.paid&&row.paidCents==null)amount.title='Montant payé non renseigné';
  tr.append(amount);
  // Click any row to see contextual actions without repeating buttons.
 tr.tabIndex=0;
  tr.title='Afficher le détail de '+row.person+' · '+row.event;
  tr.setAttribute('aria-label',tr.title);
  tr.addEventListener('click',event=>{
   if(event.target.closest('button'))return;
   openMonthDetail(row,tr);
  });
  tr.addEventListener('keydown',event=>{
   if(event.target===tr&&(event.key==='Enter'||event.key===' ')){
    event.preventDefault();openMonthDetail(row,tr);
   }
  });
  host.append(tr);
  mobile.append(monthlyMobileCard(row));
 }
 if(!result.rows.length){
  const tr=node('tr'),td=node('td','month-empty','Aucun déplacement ce mois-ci.');
  td.colSpan=6;tr.append(td);host.append(tr);
  mobile.append(node('p','month-mobile-empty','Aucun déplacement pour ce mois.'));
 }
 const personId=$('month-person').value;
 $('person-sheet-actions').hidden=!personId;
 $('person-sheet-title').textContent=personId?displayPerson(personId)+' · '+month:'';
}
$('month-jump-toggle').addEventListener('click',()=>{
 const picker=$('month-picker-row'),open=picker.hidden;
 picker.hidden=!open;
 $('month-jump-toggle').setAttribute('aria-expanded',String(open));
 if(open)$('month-filter').focus();
});
$('month-filter').addEventListener('change',()=>{
 $('month-picker-row').hidden=true;
 $('month-jump-toggle').setAttribute('aria-expanded','false');
});
$('month-person').addEventListener('change',()=>{
 renderMonthly();
 $('month-output').hidden=true;
});
function downloadMonthPdf(person=false){
 const register=person?
  personMonthLedger(registerData(),$('month-filter').value,$('month-person').value):
  monthLedger(registerData(),$('month-filter').value);
 const personName=person?register.personName:'';
 const contents=monthlyTravelPdf(register,{personName});
 const blob=new Blob([contents],{type:'application/pdf'});
 const url=URL.createObjectURL(blob),link=node('a');
 link.href=url;
 link.download=travelPdfName(register,{personName});
 document.body.append(link);
 try{link.click();}
 finally{
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),8000);
 }
 feedback('✅ PDF téléchargé.');
}
for(const [id,person] of [['download-month-pdf',false],['download-person-pdf',true]]){
 $(id).addEventListener('click',()=>{
  const button=$(id);button.disabled=true;
  try{downloadMonthPdf(person);}
  catch(error){feedback('Téléchargement impossible : '+error.message,true);}
  finally{button.disabled=false;}
 });
}
function printMonth(person=false){
 const register=person?
  personMonthLedger(registerData(),$('month-filter').value,$('month-person').value):
  monthLedger(registerData(),$('month-filter').value);
 const title=person?register.personName:'Déplacements du mois';
 const win=window.open('','_blank');
 if(!win)throw Error('Autorisez la fenêtre d’impression pour enregistrer en PDF.');
 win.opener=null;
 win.document.open();win.document.write(ledgerPrintHtml(register,{label:title}));
 win.document.close();
 win.addEventListener('load',()=>{win.focus();win.print();},{once:true});
}
for(const [id,person] of [['print-month',false],['print-person',true]]){
 $(id).addEventListener('click',()=>{
  try{printMonth(person);}catch(error){feedback(error.message,true);}
 });
}

async function renderBudget(){
 const now=new Date();
 const month=$('month-filter').value||(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')),
  events=items('event').filter(e=>e.startDate.startsWith(month));
 const host=$('budget-output'),standalone=$('budget-standalone');
 host.replaceChildren();standalone.replaceChildren();
 if(!events.length){
  for(const target of [host,standalone])target.append(node('p','muted','Aucun événement pour ce mois.'));
  return;
 }
 // Stop at 12 events in the first pilot to avoid unbounded requests.
 for(const e of events.slice(0,12)){
  const b=await api('event_budget',{eventId:e.id});
  const c=card(e.title+' · '+fmtDate(e.startDate),[
   'Enveloppe : '+fmtEuro(b.budgetCents),
   'Billets payés : '+fmtEuro(b.paidKnownCents)+(b.paidUnknownCount?' (prix manquants)':''),
   'Prévisions restantes : '+fmtEuro(b.unpaidKnownEstimateCents),
   'Total prévisionnel : '+fmtEuro(b.forecastCents)]);
  if(!b.forecastComplete)c.append(node('p','tiny','⚠ Au moins un tarif manque : total incomplet.'));
  host.append(c);
  standalone.append(c.cloneNode(true));
 }
}
for(const [id,step] of [['month-prev',-1],['month-next',1]]){
 $(id).addEventListener('click',()=>{
  $('month-filter').value=moveMonth($('month-filter').value,step);
  $('month-filter').dispatchEvent(new window.Event('change'));
 });
}
$('month-filter').addEventListener('change',()=>{
 renderMonthly();
 $('budget-month-filter').value=$('month-filter').value;
 $('month-output').hidden=true;
 renderBudget().catch(e=>feedback(e.message,true));
});
$('view-person-month').addEventListener('click',async()=>{
 const id=$('month-person').value,month=$('month-filter').value;
 if(!id){feedback('Sélectionnez une personne.',true);return;}
 const host=$('month-output');host.replaceChildren();host.hidden=false;
 renderMonthly();
 try{
  const result=await api('person_month',{personId:id,month});
  if(!result.events.length){host.append(node('p','muted','Aucun déplacement pour ce mois.'));return;}
  for(const ev of result.events){
   for(const journey of ev.journeys){
    const label=journey.selectedRank?'Choix nº '+journey.selectedRank:'Option proposée';
    const c=card(ev.eventTitle+' · '+label,[
      (journey.direction==='A'?'ALLER':'RETOUR')+' · '+fmtDate(journey.travelDate),
      journey.stage==='FILED'?'✅ Payé et classé':
      journey.stage==='PAID'?'💳 Billet acheté':
      journey.stage==='IN_CART'?'🛒 Panier externe':
      journey.stage==='CHOSEN'?'✅ Choix confirmé':'En attente de choix',
      'Prix : '+fmtEuro(journey.paidCents??journey.estimatedCents)]);
    for(const leg of journey.legs)c.append(node('p','segment',
      leg.departure+' '+leg.from+' → '+leg.arrival+' '+leg.to));
    host.append(c);
   }
  }
 }catch(e){feedback(e.message,true)}
});
function bindForm(id,create){
 const form=$(id);
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=form.querySelector('button[type="submit"],button:not([type])');
  if(button)button.disabled=true;
  try{
   if(id==='person-form')applyCardsToForm();
   const fd=new FormData(form),{type,record}=create(fd);
   if(form.dataset.recordId){
    record.id=form.dataset.recordId;
    if(form.dataset.expectedUpdatedAt!=='')
     record.expectedUpdatedAt=Number(form.dataset.expectedUpdatedAt);
   }
   if(type==='choice'){
    record.expectedUpdatedAt=items('choice').find(x=>
     x.participationId===record.participationId&&x.direction===record.direction)?.updatedAt??null;
   }else if(type==='booking'){
    record.expectedUpdatedAt=items('booking').find(x=>x.optionId===record.optionId)?.updatedAt??null;
   }
   await api('save',{type,record});
   form.reset();if(id==='person-form')setCardsFromSaved('');
   delete form.dataset.recordId;delete form.dataset.expectedUpdatedAt;
   if(button)button.textContent=id==='person-form'?'Enregistrer la personne':
     id==='event-form'?'Enregistrer l’événement':button.textContent;
   await reload();feedback('✅ Enregistré.');
  }catch(e){feedback(e.message,true)}
  finally{if(button)button.disabled=false;}
 });
}
bindForm('person-form',fd=>({type:'person',record:{
 name:val(fd,'name'),departure:val(fd,'departure'),
 email:val(fd,'email'),phone:val(fd,'phone'),
 reductionCards:val(fd,'reductionCards'),preferences:val(fd,'preferences')}}));
bindForm('event-form',fd=>({type:'event',record:{
 title:val(fd,'title'),startDate:val(fd,'startDate'),
 destination:val(fd,'destination'),theater:val(fd,'theater'),
 budgetCents:money(val(fd,'budgetEuros'))}}));
bindForm('participation-form',fd=>({type:'participation',record:{
 eventId:val(fd,'eventId'),personId:val(fd,'personId')}}));
bindForm('option-form',fd=>({type:'option',record:{
 participationId:val(fd,'participationId'),direction:val(fd,'direction'),
 travelDate:val(fd,'travelDate'),estimatedCents:money(val(fd,'estimatedEuros')),
 legs:[{from:val(fd,'from'),to:val(fd,'to'),
 departure:val(fd,'departure'),arrival:val(fd,'arrival'),mode:'rail'}]}}));
bindForm('choice-form',fd=>({type:'choice',record:{
 participationId:val(fd,'participationId'),direction:val(fd,'direction'),
 firstOptionId:val(fd,'firstOptionId')||null,
 backupOptionId:val(fd,'backupOptionId')||null}}));
bindForm('booking-form',fd=>({type:'booking',record:{
 optionId:val(fd,'optionId'),stage:val(fd,'stage'),
 paidCents:money(val(fd,'paidEuros')),
 receiptReference:val(fd,'receiptReference')}}));
bindForm('note-form',fd=>({type:'note',record:{
 targetType:val(fd,'targetType'),targetId:val(fd,'targetId'),content:val(fd,'content')}}));
$('invite-form').addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget);
 try{
  const result=await api('invite',{email:val(fd,'email'),role:val(fd,'role')});
  const u=new URL('./organisation.html',location.href);
  u.hash=new URLSearchParams({invite:result.inviteToken,email:val(fd,'email')}).toString();
  $('invitation-link').value=u.href;
  $('invitation-result').hidden=false;
  feedback('✅ Invitation prête. Transmettez le lien de manière privée.');
 }catch(err){feedback(err.message,true)}
});
$('export-backup').addEventListener('click',async()=>{
 try{
  const data=await api('export_backup');
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=node('a');
  a.href=url;a.download='TRANSBORA_sauvegarde_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  feedback('✅ Sauvegarde privée enregistrée dans les téléchargements.');
 }catch(e){feedback(e.message,true)}
});
$('restore-demo-file').addEventListener('change',async e=>{
 const file=e.currentTarget.files?.[0];
 if(!file||!state.demo)return;
 const message=$('restore-demo-status');
 try{
  if(!/\.json$/i.test(file.name)||file.size>2*1024*1024)
   throw Error('Choisissez une sauvegarde JSON de 2 Mo maximum.');
  const backup=JSON.parse(await file.text());
  if(!confirm('Remplacer les données de cette démonstration par celles du fichier ? Les données actuelles seront perdues.'))return;
  const result=await api('restore_demo_backup',{backup});
  state.activeSearchEventId=null;
  $('search-frame-area').hidden=true;
  $('search-frame').removeAttribute('src');
  await reload();showTab('people');
  message.textContent='✅ '+result.persons+' personne(s) et '+result.events+
    ' événement(s) restauré(s) dans ce navigateur.';
  feedback(message.textContent);
 }catch(error){message.textContent='⚠ '+error.message;}
 finally{e.currentTarget.value='';}
});
$('reset-demo').addEventListener('click',async()=>{
 if(!state.demo||!confirm('Remettre à zéro uniquement les données fictives de cet appareil ?'))return;
 try{await api('reset_demo');await reload();feedback('✅ Démonstration remise à zéro.');}
 catch(e){feedback(e.message,true);}
});
$('copy-invite').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('invitation-link').value);
  feedback('✅ Lien d’invitation copié.');}catch{feedback('Impossible de copier automatiquement.',true);}
});
async function startDemo(){
 state.demo=true;
 rehearsal=createRehearsalApi(window.localStorage,{cleanExamples:true});
 $('login-panel').hidden=true;
 $('private-panel').hidden=false;
 try{
  await connect();
  if(new URLSearchParams(location.search).get('import_search')==='1'){
   const results=readSearchResults(window.localStorage);
   if(!results)feedback('Aucun résultat de recherche récent à importer.',true);
   else{
    const imported=await api('import_search_results',{
     eventId:results.eventId,rows:results.rows
    });
    window.localStorage.removeItem(RESULTS_KEY);
    await reload();showTab('travels');
    feedback('✅ '+imported.imported+' trajet(s) ajouté(s), '+
      imported.alreadyPresent+' déjà présent(s). Les tarifs restent inconnus : '+
      'renseignez les montants au moment de l’achat.');
   }
   history.replaceState({},'',location.pathname);
  }
 }catch(error){$('global-feedback').hidden=false;feedback(error.message,true);}
}
if(inviteToken){$('login-panel').hidden=false;}
else if(new URLSearchParams(location.search).has('connexion')){
 $('login-panel').hidden=false;
 api('me').then(connect).catch(()=>{});
}else{
 startDemo();
}
