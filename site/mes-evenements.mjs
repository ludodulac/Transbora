import {api} from './native-choices.mjs';
import {readHistory,registerHistory,parseOwnerLink,ownerUrl} from './event-history.mjs';

const $=id=>document.getElementById(id);
const node=(tag,cls,label)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(label!==undefined)e.textContent=label;
  return e;
};
function notice(message,error=false){
  $('history-feedback').textContent=message;
  $('history-feedback').classList.toggle('error-text',error);
}
const date=d=>/^\d{4}-\d\d-\d\d$/.test(d||'')?
  d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';
function refreshList(){
  const data=readHistory(localStorage);
  const host=$('history-list');
  host.replaceChildren();
  if(!data.length){
    const empty=node('div','history-empty');
    empty.append(node('p',null,'Aucun événement enregistré sur cet appareil.'));
    const help=node('p',null,'Créez un événement ou ajoutez un ancien dossier avec son lien de suivi ci-dessous.');
    empty.append(help);host.append(empty);return;
  }
  data.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  for(const item of data){
    const card=node('article','history-card');
    const heading=node('h2',null,item.title);
    const period=new Date(item.endDate+'T23:59:59').getTime()<Date.now()?'Terminé':'À venir';
    const badge=node('span','history-badge',period);
    const info=node('p','history-details',(item.destination||'Lieu non précisé')+
      ' · '+date(item.startDate)+(item.endDate!==item.startDate?' au '+date(item.endDate):'')+
      (item.peopleCount?' · '+item.peopleCount+' voyageur(s)':''));
    const link=node('a','primary history-open','Ouvrir le dossier →');
    link.href=ownerUrl(item.eventId,item.ownerKey,location.href);
    card.append(heading,badge,info,link);
    host.append(card);
  }
}
async function addExisting(link){
  const keys=parseOwnerLink(link,location.origin);
  if(!keys)throw new Error('Ce lien de suivi est invalide. Utilisez le lien privé reçu lors de la création.');
  const report=await api('status',keys);
  if(!registerHistory(localStorage,{...keys,event:report.event,peopleCount:report.people.length}))
    throw new Error('Impossible de mémoriser le dossier sur cet appareil. Vérifiez votre espace de stockage.');
  notice('Dossier retrouvé : '+report.event.title+'.');
  refreshList();
}
$('history-import').addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=$('history-import').querySelector('button');
  submit.disabled=true;
  try{await addExisting($('history-link').value.trim());$('history-link').value='';}
  catch(error){notice(error.message,true);}
  finally{submit.disabled=false;}
});
refreshList();
// Earlier releases saved only one private URL in the current browser session.
const old=sessionStorage.getItem('transbora_last_dashboard')||'';
if(old && parseOwnerLink(old,location.origin)){
  const ref=parseOwnerLink(old,location.origin);
  if(!readHistory(localStorage).some(item=>item.eventId===ref.eventId)){
    addExisting(old).catch(()=>{/* Do not erase an inaccessible earlier link. */});
  }
}
