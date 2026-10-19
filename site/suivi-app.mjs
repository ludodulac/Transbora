import {api,choiceUrl,textLinks} from './native-choices.mjs';
import {registerHistory,forgetHistory} from './event-history.mjs';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.hash.slice(1));
const eventId=params.get('event'),ownerKey=params.get('key');
let report=null;
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function notice(message,bad=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',bad);$('feedback').hidden=false;}
async function refresh(){
  if(!eventId||!ownerKey){notice('Lien organisateur incomplet. Utilisez le lien privé reçu lors de la création.',true);return;}
  try{
    report=await api('status',{eventId,ownerKey});
    // Also capture an older owner link opened directly or from another device.
    registerHistory(globalThis.localStorage,{eventId,ownerKey,event:report.event,peopleCount:report.people.length});
    $('heading').textContent=report.event.title;
    $('description').textContent='Lieu : '+report.event.destination+
      ' · '+report.people.length+' voyageur(s)';
    const summary=$('summary');summary.replaceChildren();
    for(const p of report.people){
      const row=node('article','summary-row');
      row.append(node('strong',null,p.first+' '+p.last+' · '+p.departure));
      if(!p.options.A.length&&!p.options.R.length)
        row.append(node('p',null,'⚠️ Aucun trajet trouvé dans les horaires disponibles.'));
      for(const [dir,label] of [['A','ALLER'],['R','RETOUR']]){
        if(!p.options[dir].length)continue;
        const chosen=p.answer?.[dir],option=p.options[dir].find(o=>o.id===chosen);
        const status=chosen==='NONE'?'Aucun horaire souhaité':
          option?option.label:'En attente de réponse';
        row.append(node('p',null,label+' : '+status));
      }
      summary.append(row);
    }
    const linkList=$('links');linkList.replaceChildren();
    for(const link of report.links){
      const line=node('div','share-line');
      line.append(node('strong',null,link.label));
      const actions=node('div','share-actions');
      const href=choiceUrl(link.token);
      const open=node('a',null,'Ouvrir ↗');open.href=href;open.target='_blank';open.rel='noopener noreferrer';
      const copy=node('button',null,'Copier le lien');copy.type='button';
      copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(href);notice('Lien copié.');}
        catch{notice('Copie impossible : utilisez Ouvrir pour récupérer le lien.',true);}
      });
      actions.append(open,copy);line.append(actions);linkList.append(line);
    }
    $('toolbar').hidden=false;$('result').hidden=false;$('feedback').hidden=true;
  }catch(error){notice(error.message,true);}
}
$('reload').addEventListener('click',refresh);
$('copy-links').addEventListener('click',async()=>{
  if(!report)return;
  try{await navigator.clipboard.writeText(textLinks(report.links,report.mode));notice('Liens copiés.');}
  catch{notice('Impossible de copier automatiquement.',true);}
});
$('download').addEventListener('click',()=>{
  if(!report)return;
  const csv=[['Voyageur','Ville de départ','Sens','Choix','Statut','Date de réponse'].join(';')];
  const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  for(const p of report.people){
    for(const [dir,label] of [['A','ALLER'],['R','RETOUR']]){
      if(!p.options[dir].length)continue;
      const choice=p.options[dir].find(x=>x.id===p.answer?.[dir]);
      const name=choice?.label|| (p.answer?.[dir]==='NONE'?'Aucun horaire':'—');
      const state=!p.answer?'En attente':p.answer?.[dir]==='NONE'?'À revoir':'À réserver';
      csv.push([p.first+' '+p.last,p.departure,label,name,state,
        p.answer?.updatedAt?new Date(p.answer.updatedAt).toLocaleString('fr-FR'):''].map(escape).join(';'));
    }
  }
  const blob=new Blob(['\ufeff'+csv.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='Transbora_suivi_'+report.event.title.replace(/[^a-z0-9-]/gi,'-')+'.csv';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
});
$('remove').addEventListener('click',async()=>{
  if(!confirm('Supprimer ce dossier, tous les liens et les réponses ? Cette action est définitive.'))return;
  try{
    await api('remove',{eventId,ownerKey});
    forgetHistory(globalThis.localStorage,eventId);
    report=null;$('result').hidden=true;$('toolbar').hidden=true;
    history.replaceState({},'',location.pathname);
    notice('Dossier supprimé, liens désactivés.');
  }catch(e){notice(e.message,true);}
});
refresh();
