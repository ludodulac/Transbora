/** Travel requirements: event/person/time first; train offers and bookings come later.
 * A person can have several independent requirements for the same event.
 */
export function defaultTravelNeed(event,person,direction='A'){
 if(!event||!person)return null;
 const back=direction==='R';
 const date=back?(event.endDate||event.startDate):event.startDate;
 const time=back?(event.endTime||''):(event.startTime||'');
 let targetDate=date,targetTime=time;
 if(!back&&date&&time){
  const lead=Number(event.arrivalLeadMinutes??60);
  const instant=Date.parse(date+'T'+time+':00Z')-lead*60000;
  if(Number.isFinite(instant)){
   const d=new Date(instant);
   targetDate=d.toISOString().slice(0,10);
   targetTime=d.toISOString().slice(11,16);
  }
 }
 return {targetDate,targetTime,
  origin:back?(event.destination||''):(person.departure||''),
  destination:back?(person.departure||''):(event.destination||'')};
}

export function initNeedPlanner({api,items,byId,displayParticipation,fmtDate,feedback,
  reload,showTab,openIntegratedSearch,closeTravelPanel}){
 const $=id=>document.getElementById(id);
 const node=(tag,cls,content)=>{
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(content!==undefined)item.textContent=String(content);
  return item;
 };
 const val=(fd,key)=>String(fd.get(key)||'').trim();
 const form=$('need-form');
 function closeNeedEditor(){
  $('need-work-panel').hidden=true;
  delete form.dataset.recordId;
 }
 function fillDefaults(){
  const event=byId('event',form.elements.eventId.value);
  const person=byId('person',form.elements.personId.value);
  const defaults=defaultTravelNeed(event,person,form.elements.direction.value);
  if(!defaults)return;
  for(const [key,value] of Object.entries(defaults))
   form.elements[key].value=value||'';
 }
 function openNeedEditor(existing=null,participation=null){
  form.reset();
  delete form.dataset.recordId;delete form.dataset.expectedUpdatedAt;
  if(existing)participation=byId('participation',existing.participationId);
  if(participation){
   form.elements.eventId.value=participation.eventId;
   form.elements.personId.value=participation.personId;
  }
  if(existing){
   form.dataset.recordId=existing.id;
   form.dataset.expectedUpdatedAt=existing.updatedAt??'';
   form.elements.direction.value=existing.direction;
   for(const key of ['targetDate','targetTime','origin','destination','note'])
    form.elements[key].value=existing[key]||'';
  }else{
   form.elements.direction.value='A';
   fillDefaults();
  }
  $('need-panel-title').textContent=existing?'Modifier le déplacement':'Préparer un déplacement';
  $('need-work-panel').hidden=false;
  closeTravelPanel();
  $('need-work-panel').scrollIntoView?.({block:'nearest'});
 }
 function renderNeeds(){
  const host=$('needs-output');
  host.replaceChildren();
  const filterEvent=$('travel-event-filter').value;
  const filterPerson=$('travel-person-filter').value;
  const rows=items('need').filter(n=>{
   const p=byId('participation',n.participationId);
   return p&&p.active!==false&&(!filterEvent||p.eventId===filterEvent)&&
    (!filterPerson||p.personId===filterPerson);
  }).sort((a,b)=>(a.targetDate+a.targetTime).localeCompare(b.targetDate+b.targetTime));
  for(const need of rows){
   const participation=byId('participation',need.participationId);
   const card=node('article','need-row');
   const content=node('div','need-details');
   content.append(node('strong',null,displayParticipation(participation.id)));
   content.append(node('p',null,
    (need.direction==='A'?'Arrivée souhaitée : ':'Départ souhaité : ')+
    fmtDate(need.targetDate)+' à '+need.targetTime+' · '+
    need.origin+' → '+need.destination));
   if(need.note)content.append(node('small',null,need.note));
   const buttons=node('div','need-actions');
   const edit=node('button','outline','Modifier');edit.type='button';
   edit.addEventListener('click',()=>openNeedEditor(need));
   const search=node('button','secondary','🔎 Rechercher');
   search.type='button';
   search.addEventListener('click',()=>{
    try{openIntegratedSearch(participation.eventId,need.id);}
    catch(error){feedback(error.message,true);}
   });
   buttons.append(edit,search);
   card.append(content,buttons);host.append(card);
  }
  if(!rows.length)host.append(node('p','muted',
   'Aucun déplacement préparé. Associez une personne à un événement ou préparez un déplacement.'));
 }
 async function ensureInitialNeed(participation){
  const event=byId('event',participation.eventId);
  const person=byId('person',participation.personId);
  if(!event||!person||!event.startTime||!event.destination||!person.departure)return;
  if(items('need').some(n=>n.participationId===participation.id))return;
  const defaults=defaultTravelNeed(event,person,'A');
  await api('save',{type:'need',record:{
   participationId:participation.id,direction:'A',...defaults,customized:false,note:''
  }});
 }
 function setup(){
  $('need-panel-close').addEventListener('click',closeNeedEditor);
  $('add-travel-btn').addEventListener('click',()=>openNeedEditor());
  for(const key of ['eventId','personId','direction'])
   form.elements[key].addEventListener('change',fillDefaults);
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const submit=form.querySelector('button[type="submit"]');
   submit.disabled=true;
   try{
    const fd=new FormData(form);
    const eventId=val(fd,'eventId'),personId=val(fd,'personId');
    const event=byId('event',eventId),person=byId('person',personId);
    if(!event||!person)throw Error('Choisissez un événement et une personne enregistrée.');
    let p=items('participation').find(p=>p.eventId===eventId&&p.personId===personId);
    if(p?.active===false){
     await api('set_participation_active',{participationId:p.id,active:true});
    }else if(!p){
     p=(await api('save',{type:'participation',record:{eventId,personId}})).item;
    }
    const direction=val(fd,'direction');
    const current={targetDate:val(fd,'targetDate'),targetTime:val(fd,'targetTime'),
     origin:val(fd,'origin'),destination:val(fd,'destination')};
    const defaults=defaultTravelNeed(event,person,direction);
    const customized=Object.keys(current).some(k=>current[k]!==String(defaults?.[k]||''));
    const record={participationId:p.id,direction,...current,
     note:val(fd,'note'),customized};
    if(form.dataset.recordId){
     record.id=form.dataset.recordId;
     if(form.dataset.expectedUpdatedAt!=='')
      record.expectedUpdatedAt=Number(form.dataset.expectedUpdatedAt);
    }
    await api('save',{type:'need',record});
    closeNeedEditor();await reload();showTab('travels');
    feedback('✅ Déplacement enregistré. Vous pouvez en ajouter un autre ou rechercher ses trains.');
   }catch(error){feedback(error.message,true);}
   finally{submit.disabled=false;}
  });
 }
 setup();
 return {renderNeeds,openNeedEditor,closeNeedEditor,ensureInitialNeed};
}
