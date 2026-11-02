/** TRANSBORA — organizer workbench. All user content uses textContent. */
import {createRehearsalApi} from './organizer-rehearsal.mjs';
import {createSearchHandoff,readSearchResults,RESULTS_KEY} from './organizer-bridge.mjs';
import {nativeLinkFor} from './organizer-replies-bridge.mjs';
import {readHistory} from './event-history.mjs';
import {api as nativeChoicesApi} from './native-choices.mjs';
const $=id=>document.getElementById(id);
const state={user:null,data:{},mode:'login',tab:'overview',demo:false,activeSearchEventId:null};
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
function fillSelects(){
 const persons=items('person').map(p=>[p.id,p.name]),
   events=items('event').map(e=>[e.id,e.title+' · '+fmtDate(e.startDate)]);
 const participants=items('participation').map(p=>[p.id,displayParticipation(p.id)]);
 options($('month-person'),persons,'Choisir une personne');
 options($('search-event-select'),events,'Sélectionner un événement');
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
 $('company-name').textContent=state.user.organizationName||'Mon organisation';
 $('user-identity').textContent=state.user.email+
  (state.user.role==='manager'?' · direction':' · organisatrice');
 $('demo-warning').hidden=!state.demo;
 $('invite-form').hidden=state.demo||state.user.role!=='manager';
 $('export-backup').hidden=state.user.role!=='manager';
 $('reset-demo').hidden=!state.demo;
 $('logout').hidden=state.demo;
 $('team-secret-hint').hidden=!state.demo;
 $('demo-backup-import').hidden=!state.demo;
 $('user-identity').textContent=state.demo?'Essai sur cet appareil (non partagé)':$('user-identity').textContent;
 $('month-filter').value=new Date().toISOString().slice(0,7);
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
 if(tab==='search'){
  $('search-select-area').hidden=!state.demo;
  if(!state.demo)$('search-context').textContent=
    'La recherche intégrée est disponible dans la démonstration locale. Aucune donnée privée de votre organisation connectée ne sera transférée vers cette démonstration.';
  else if(!state.activeSearchEventId)
    $('search-context').textContent='Choisissez un événement pour utiliser les personnes déjà enregistrées.';
 }
}
$('nav-toggle').addEventListener('click',()=>{
 const opened=$('tabs').classList.toggle('open');
 $('nav-toggle').setAttribute('aria-expanded',String(opened));
 $('nav-backdrop').hidden=!opened;
});
$('nav-backdrop').addEventListener('click',closeMobileNav);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileNav();});
$('tabs').addEventListener('click',e=>{
 const btn=e.target.closest('[data-tab]');if(btn)showTab(btn.dataset.tab);
});
function openIntegratedSearch(eventId){
 if(!state.demo){
  feedback('La recherche intégrée ne doit pas utiliser les fiches du compte sécurisé dans le mode démo.',true);
  return;
 }
 const event=byId('event',eventId);
 if(!event)throw Error('Événement inconnu.');
 createSearchHandoff(window.localStorage,{
  event,people:items('person'),participations:items('participation')
 });
 state.activeSearchEventId=eventId;
 $('search-event-select').value=eventId;
 $('search-context').textContent=event.title+' · '+fmtDate(event.startDate)+
   ' · '+items('participation').filter(p=>p.eventId===eventId).length+
   ' personne(s). Leurs gares seront préremplies.';
 const frame=$('search-frame');
 // Reload only when the organizer explicitly chooses an event; changing
 // sidebar tabs never destroys the ongoing timetable search.
 frame.src='./events.html?from_organizer=1&embedded=1&ntl-drawer-state=hidden';
 $('search-frame-area').hidden=false;
 showTab('search');
}
$('search-open').addEventListener('click',()=>{
 try{openIntegratedSearch($('search-event-select').value)}
 catch(error){feedback(error.message,true);}
});
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
 showTab('travels');$('booking-form').scrollIntoView?.({behavior:'smooth',block:'start'});
});
$('budget-month-filter').addEventListener('change',()=>{
 $('month-filter').value=$('budget-month-filter').value;
 renderBudget().catch(e=>feedback(e.message,true));
});
// Messages are only accepted from the loaded same-origin timetable iframe.
// Never consume owner capabilities, personal contacts, or arbitrary cross-origin data.
window.addEventListener('message',async event=>{
 if(!state.demo||event.origin!==location.origin||
   event.source!==$('search-frame').contentWindow)return;
 if(event.data?.type==='transbora:open-tab'){
   if(['travels','events','answers','bookings'].includes(event.data.tab))
     showTab(event.data.tab);
   return;
 }
 if(event.data?.type!=='transbora:routes-ready'||
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
function card(title,lines=[]){
 const item=node('article','card');item.append(node('h3',null,title));
 for(const line of lines)item.append(node('p',null,line));
 return item;
}
function renderEverything(){
 const people=$('people-output');people.replaceChildren();
 for(const p of items('person')){
  const c=card(p.name,[p.departure||'Gare non renseignée',
    p.reductionCards?'Cartes : '+p.reductionCards:'']);
  if(p.preferences)c.append(node('p','tiny',p.preferences));
  const edit=node('button','item-action','Modifier la fiche');
  edit.type='button';edit.addEventListener('click',()=>{
    const form=$('person-form');form.dataset.recordId=p.id;
    for(const field of ['name','departure','email','phone','reductionCards','preferences'])
      form.elements[field].value=p[field]||'';
    form.querySelector('button').textContent='Enregistrer les modifications';
    form.scrollIntoView?.({behavior:'smooth',block:'start'});
  });
  c.append(edit);people.append(c);
 }
 if(!items('person').length)people.append(node('p','muted','Aucune personne. Commencez par une fiche.'));
 $('person-filter').dispatchEvent(new window.Event('input'));
 const events=$('events-output');events.replaceChildren();
 for(const event of items('event').sort((a,b)=>a.startDate.localeCompare(b.startDate))){
  const n=items('participation').filter(p=>p.eventId===event.id).length;
  const c=card(event.title,[fmtDate(event.startDate)+' · '+(event.destination||'Ville à préciser'),
   (event.theater||'')+' · '+n+' personne(s)',
   'Enveloppe transport : '+fmtEuro(event.budgetCents)]);
  const edit=node('button','item-action','Modifier l’événement');
  edit.type='button';edit.addEventListener('click',()=>{
    const form=$('event-form');form.dataset.recordId=event.id;
    for(const field of ['title','startDate','destination','theater'])
      form.elements[field].value=event[field]||'';
    form.elements.budgetEuros.value=event.budgetCents===null?'':String(event.budgetCents/100);
    form.querySelector('button').textContent='Enregistrer les modifications';
    form.scrollIntoView?.({behavior:'smooth',block:'start'});
  });
  c.append(edit);
  if(state.demo){
   const search=node('button','item-action','🔎 Rechercher les trajets de cet événement');
   search.type='button';
   search.addEventListener('click',()=>{
    try{
     createSearchHandoff(window.localStorage,{
      event,people:items('person'),participations:items('participation')
     });
     openIntegratedSearch(event.id);
    }catch(error){feedback(error.message,true);}
   });
   c.append(search);
   const mapping=nativeLinkFor(window.localStorage,event.id);
   if(mapping){
    c.append(node('p','tiny','🔗 Dossier artistes associé. Actualisez les réponses ici, à la demande.'));
    const sync=node('button','item-action','🔄 Récupérer les réponses des artistes');
    sync.type='button';
    sync.addEventListener('click',async()=>{
      sync.disabled=true;
      try{
       const owner=readHistory(window.localStorage).find(row=>row.eventId===mapping.nativeEventId);
       if(!owner)throw Error('Lien privé du suivi introuvable sur cet appareil. Ouvrez d’abord « Mes événements » ou importez votre lien de suivi.');
       const report=await nativeChoicesApi('status',{
         eventId:mapping.nativeEventId,ownerKey:owner.ownerKey
       });
       // The capability and the report are transient: neither is persisted
       // into the demonstration, and the real booking status is not copied.
       const result=await api('sync_native_answers',{mapping,report});
       await reload();showTab('events');
       const incidents=result.conflicts.length?
         ' ⚠ À contrôler : '+result.conflicts.slice(0,3).join(' / '):'';
       feedback('✅ Réponses : '+result.synced+' choix mis à jour, '+
         result.unchanged+' inchangé(s), '+result.pending+' en attente. '+
         'Aucun prix ou achat importé.'+incidents,
         Boolean(result.conflicts.length));
      }catch(error){feedback('Synchronisation impossible : '+error.message,true);}
      finally{sync.disabled=false;}
    });
    c.append(sync);
   }
  }
  events.append(c);
 }
 if(!items('event').length)events.append(node('p','muted','Aucun événement.'));
 const journeys=$('journeys-output');journeys.replaceChildren();
 for(const option of items('option').sort((a,b)=>a.travelDate.localeCompare(b.travelDate))){
  const booking=items('booking').find(b=>b.optionId===option.id);
  const choice=items('choice').find(c=>c.participationId===option.participationId&&
    c.direction===option.direction);
  const rank=choice?.firstOptionId===option.id?' · CHOIX Nº1':
    choice?.backupOptionId===option.id?' · CHOIX Nº2':'';
  const c=card(displayParticipation(option.participationId)+rank,[
   (option.direction==='A'?'ALLER':'RETOUR')+' · '+fmtDate(option.travelDate),
   'Prix estimé : '+fmtEuro(option.estimatedCents),
   choice?.firstOptionId==='NONE'?'Aucun trajet souhaité pour ce sens':
   choice?.origin==='native'?'Choix de l’artiste synchronisé':'']);
  for(const leg of option.legs||[]){
   c.append(node('p','segment',
    (leg.departureDate&&leg.departureDate!==option.travelDate?fmtDate(leg.departureDate)+' ':'')+
    leg.departure+' '+leg.from+' → '+
    (leg.arrivalDate&&leg.arrivalDate!==leg.departureDate?fmtDate(leg.arrivalDate)+' ':'')+
    leg.arrival+' '+leg.to+
     (leg.operator?' · '+leg.operator:'')));
  }
  const label=booking?.filedAt?'✅ Billet classé':
    booking?.paidAt?'💳 Payé':booking?.inCartAt?'🛒 Dans le panier':'Proposé';
  c.append(node('span','badge'+(booking?.paidAt?' paid':booking?.inCartAt?' wait':''),label));
  journeys.append(c);
 }
 if(!items('option').length)journeys.append(node('p','muted','Ajoutez un trajet après avoir inscrit un participant.'));
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
  const go=node('button','item-action','Ouvrir l’événement et actualiser ses réponses');
  go.type='button';go.addEventListener('click',()=>showTab('events'));row.append(go);
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
async function renderBudget(){
 const month=$('month-filter').value||new Date().toISOString().slice(0,7),
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
$('month-filter').addEventListener('change',()=>renderBudget().catch(e=>feedback(e.message,true)));
$('view-person-month').addEventListener('click',async()=>{
 const id=$('month-person').value,month=$('month-filter').value;
 if(!id){feedback('Sélectionnez une personne.',true);return;}
 const host=$('month-output');host.replaceChildren();
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
   const fd=new FormData(form),{type,record}=create(fd);
   if(form.dataset.recordId)record.id=form.dataset.recordId;
   await api('save',{type,record});
   form.reset();delete form.dataset.recordId;
   if(button)button.textContent=id==='person-form'?'Enregistrer la personne':
     id==='event-form'?'Enregistrer l’événement':button.textContent;
   await reload();feedback('✅ Enregistré. Les tableaux utilisent maintenant cette information.');
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
 rehearsal=createRehearsalApi(window.localStorage);
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
