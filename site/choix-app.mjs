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
        card.append(node('p','subtitle',person.onsite?.A||person.onsite?.R?
          '✅ Déjà sur place : aucun déplacement nécessaire pour ce trajet.':
          'Aucun horaire disponible. Contactez l’organisateur.'));
      const state=node('p','traveler-status',person.answered?'✅ Choix déjà enregistrés — modifiables':'⏳ En attente de choix');
      card.append(state);
      for(const [dir,label] of [['A','Aller'],['R','Retour']]){
        const options=person.options[dir]||[];
        if(!options.length)continue;
        const field=document.createElement('fieldset');field.className='journey';
        const legend=node('legend',null,label);field.append(legend);
        field.append(node('p','rank-instruction','Sur chaque trajet, choisissez « Nº 1 » pour votre préférence et éventuellement « Nº 2 » pour une autre option.'));
        const noBackup=node('label','backup-none');
        const noBackupRadio=document.createElement('input');
        noBackupRadio.type='radio';noBackupRadio.name='p:'+person.id+':'+dir+':backup';
        noBackupRadio.value='';noBackupRadio.checked=!person.answer?.[dir+'2'];
        noBackup.append(noBackupRadio,node('span',null,'Pas de deuxième choix'));
        field.append(noBackup);
        for(const option of [...options,{id:'NONE',label:'Aucun de ces horaires'}]){
          const line=node('div','route-choice');
          const text=node('div','route-description');
          appendReadableRoute(text,option.label);
          const ranks=node('div','rank-actions');
          const primary=node('label','rank-action rank-primary');
          const first=document.createElement('input');
          first.type='radio';first.name='p:'+person.id+':'+dir;first.value=option.id;
          first.required=true;first.checked=person.answer?.[dir]===option.id;
          primary.append(first,node('span',null,'Nº 1'));
          ranks.append(primary);
          if(option.id!=='NONE'){
            const secondary=node('label','rank-action rank-secondary');
            const second=document.createElement('input');
            second.type='radio';second.name='p:'+person.id+':'+dir+':backup';
            second.value=option.id;second.checked=person.answer?.[dir+'2']===option.id;
            secondary.append(second,node('span',null,'Nº 2'));
            ranks.append(secondary);
            // Keep first and backup distinct, without making travelers
            // decipher a validation error after scrolling past 5 routes.
            first.addEventListener('change',()=>{
              if(second.checked)noBackupRadio.checked=true;
            });
            second.addEventListener('change',()=>{
              if(first.checked){
                second.checked=false;noBackupRadio.checked=true;
                notice('Choisissez un autre trajet pour le nº 2.',true);
              }
            });
          }
          line.append(text,ranks);field.append(line);
        }
        card.append(field);
      }
      if(mode==='group'){
        const confirm=node('button','main-button person-confirm','✓ Confirmer les choix de '+person.first);
        confirm.type='button';
        confirm.addEventListener('click',async()=>{
          const answer=answerFor(person);
          if(!checkAnswer(person,answer))return;
          confirm.disabled=true;notice('Enregistrement pour '+person.first+'…');
          try{
            await api('submit',{token:shareToken,answers:[answer]});
            state.textContent='✅ Choix enregistrés pour '+person.first+' — modifiables';
            person.answered=true;
            notice('✅ Choix de '+person.first+' enregistrés. Les autres voyageurs peuvent répondre plus tard.');
          }catch(error){notice(error.message,true);}
          finally{confirm.disabled=false;}
        });
        card.append(confirm);
      }
      root.append(card);
    }
    $('choice-form').hidden=false;
    $('save').hidden=mode==='group';
    $('status').hidden=true;
  }catch(error){notice(error.message,true);}
}
function answerFor(person){
  const result={personId:person.id};
  for(const dir of ['A','R']){
    const candidates=person.options[dir]||[];
    const chosen=$('choice-form').querySelector('input[name="p:'+person.id+':'+dir+'"]:checked');
    const backup=$('choice-form').querySelector('input[name="p:'+person.id+':'+dir+':backup"]:checked');
    result[dir]=candidates.length?chosen?.value:null;
    result[dir+'2']=candidates.length?(backup?.value||null):null;
  }
  return result;
}
function checkAnswer(person,answer){
  for(const dir of ['A','R']){
    if((person.options[dir]||[]).length&&!answer[dir]){
      notice('Choisissez d’abord le trajet nº 1 pour '+person.first+'.',true);return false;
    }
    if(answer[dir+'2']&&(answer[dir+'2']===answer[dir]||answer[dir]==='NONE')){
      notice('Le deuxième choix doit être différent du premier.',true);return false;
    }
  }
  return true;
}
$('choice-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!documentData)return;
  // Individual link retains the same one-button journey; group links use a
  // separate button per person and must never implicitly submit a whole group.
  if(documentData.mode==='group')return;
  const responses=documentData.people.map(answerFor);
  if(!responses.every((r,i)=>checkAnswer(documentData.people[i],r)))return;
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
