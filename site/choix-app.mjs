import {api} from './native-choices.mjs';
import {appendReadableRoute} from './route-label.mjs';
const $=id=>document.getElementById(id);
let documentData=null,shareToken='';
const notice=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);$('status').hidden=false;};
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
async function load(){
  shareToken=new URLSearchParams(location.hash.slice(1)).get('t')||'';
  if(!shareToken){notice('Ce lien de voyage est incomplet. Demandez un nouveau lien à votre organisateur.',true);return;}
  try{
    documentData=await api('view',{token:shareToken});
    const {event,people,mode}=documentData;
    $('event-title').textContent=event.title;
    $('event-meta').textContent='Lieu principal de l’événement : '+event.destination+
      (mode==='group'?' · Choix pour le groupe':'')+
      ' · Vérifiez votre trajet exact ci-dessous.';
    const root=$('people');root.replaceChildren();
    for(const person of people){
      const card=node('section','traveler');
      card.append(node('h2','traveler-name',person.first+' '+person.last));
      card.append(node('p','subtitle','Ville habituelle : '+person.departure));
      if(!person.options.A.length&&!person.options.R.length)
        card.append(node('p','subtitle','Aucun trajet disponible pour cette personne. Son choix sera signalé à l’organisateur.'));
      for(const [dir,label] of [['A','Aller'],['R','Retour']]){
        const options=person.options[dir]||[];
        if(!options.length)continue;
        const field=document.createElement('fieldset');field.className='journey';
        const legend=node('legend',null,label);field.append(legend);
        for(const option of [...options,{id:'NONE',label:'Aucun de ces horaires'}]){
          const line=node('label','route-choice');
          const radio=document.createElement('input');
          radio.type='radio';radio.name='p:'+person.id+':'+dir;radio.value=option.id;radio.required=true;
          const text=node('span','route-description');
          appendReadableRoute(text,option.label);
          line.append(radio,text);field.append(line);
        }
        card.append(field);
      }
      root.append(card);
    }
    $('choice-form').hidden=false;
    $('status').hidden=true;
  }catch(error){notice(error.message,true);}
}
$('choice-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!documentData)return;
  const responses=documentData.people.map(person=>{
    const result={personId:person.id};
    for(const dir of ['A','R']){
      const candidates=person.options[dir]||[];
      result[dir]=candidates.length?$('choice-form').querySelector(
        'input[name="p:'+person.id+':'+dir+'"]:checked')?.value:null;
    }
    return result;
  });
  if(responses.some(r=>documentData.people.find(p=>p.id===r.personId).options.A.length&&!r.A||
    documentData.people.find(p=>p.id===r.personId).options.R.length&&!r.R)){
    notice('Sélectionnez un choix pour chaque trajet.',true);return;
  }
  $('save').disabled=true;notice('Enregistrement…');
  try{
    await api('submit',{token:shareToken,answers:responses});
    $('choice-form').hidden=true;$('status').hidden=true;
    $('success').hidden=false;$('success').focus();
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){notice(error.message,true);}
  finally{$('save').disabled=false;}
});
$('edit').addEventListener('click',()=>{
  $('success').hidden=true;$('choice-form').hidden=false;
  $('status').hidden=true;
});
load();
