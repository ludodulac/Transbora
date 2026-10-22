import {api,choiceUrl,textLinks} from './native-choices.mjs';
import {registerHistory,forgetHistory} from './event-history.mjs';
import {appendReadableRoute} from './route-label.mjs';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.hash.slice(1));
const eventId=params.get('event'),ownerKey=params.get('key');
let report=null;
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function notice(message,bad=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',bad);$('feedback').hidden=false;}
async function refresh({confirmUpdate=false}={}){
  if(confirmUpdate){$('reload').disabled=true;notice('🔄 Actualisation en cours…');}
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
        const answer=node('div','booking-choice');
        answer.append(node('strong',null,label+' — '+(option?'Choix nº 1':status)));
        if(option){
          const route=node('div','booking-route');
          appendReadableRoute(route,option.label);
          answer.append(route);
        }
        const secondId=p.answer?.[dir+'2'];
        const second=p.options[dir].find(o=>o.id===secondId);
        if(second){
          const subtitle=node('strong','choice-backup-heading','Choix nº 2 (solution de secours)');
          const alternative=node('div','booking-route');
          appendReadableRoute(alternative,second.label);
          answer.append(subtitle,alternative);
        }
        row.append(answer);
        const booking=p.booking?.[dir]||null;
        if(!option){
          if(booking)row.append(node('p',null,'⚠️ Un billet était marqué acheté pour un ancien choix. Vérifiez-le.'));
          continue;
        }
        const sameTicket=booking?.optionId===option.id;
        if(booking){
          row.append(node('p',null,sameTicket?
            '✅ Billet acheté par l’organisateur.':
            '⚠️ Choix modifié après achat : le billet enregistré correspond à un autre trajet. Vérifiez avant toute action.'));
        }else{
          row.append(node('p',null,'⏳ Billet à acheter par l’organisateur · prix et places non vérifiés.'));
        }
        const action=node('button',null,booking?'Annuler le statut « billet acheté »':'✓ Marquer billet acheté');
        action.type='button';
        action.addEventListener('click',async()=>{
          if(booking&&!confirm('Retirer uniquement la mention « billet acheté » dans Transbora ? Cela n’annule PAS le billet auprès du transporteur.'))return;
          action.disabled=true;
          try{
            await api('set_booking',{eventId,ownerKey,personId:p.id,direction:dir,
              booked:!booking,optionId:option.id});
            await refresh();
            notice(booking?'Statut de suivi remis à « à acheter ». Aucun billet n’a été annulé.':
              'Billet marqué comme acheté dans le suivi de l’organisateur.');
          }catch(error){notice(error.message,true);action.disabled=false;}
        });
        row.append(action);
      }
      summary.append(row);
    }
    $('current-share-mode').textContent=report.mode==='group'?
      'Mode actuel : un lien collectif':'Mode actuel : un lien par voyageur';
    $('change-mode').textContent=report.mode==='group'?
      '↔ Remplacer par des liens individuels':'↔ Remplacer par un lien de groupe';
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
    $('toolbar').hidden=false;$('result').hidden=false;
    if(confirmUpdate)notice('✅ Réponses actualisées à '+new Intl.DateTimeFormat('fr-FR',{
      hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(new Date())+'.');
    else $('feedback').hidden=true;
  }catch(error){notice(error.message,true);}
  finally{if(confirmUpdate)$('reload').disabled=false;}
}
$('reload').addEventListener('click',()=>refresh({confirmUpdate:true}));
$('change-mode').addEventListener('click',async()=>{
  if(!report)return;
  const mode=report.mode==='group'?'individual':'group';
  if(!confirm('Changer de type de lien ? Les anciens liens cesseront de fonctionner. Les réponses déjà reçues seront conservées.'))return;
  const button=$('change-mode');
  button.disabled=true;
  try{
    await api('switch_mode',{eventId,ownerKey,mode});
    await refresh();
    notice('Liens remplacés. Le même dossier et les réponses reçues sont conservés. Envoyez les nouveaux liens.');
  }catch(error){notice(error.message,true);}
  finally{button.disabled=false;}
});
$('copy-links').addEventListener('click',async()=>{
  if(!report)return;
  try{await navigator.clipboard.writeText(textLinks(report.links,report.mode));notice('Liens copiés.');}
  catch{notice('Impossible de copier automatiquement.',true);}
});
$('download').addEventListener('click',()=>{
  if(!report)return;
  const csv=[['Voyageur','Ville de départ','Sens','Choix nº 1','Choix nº 2','Statut','Date de réponse','Date de réservation confirmée'].join(';')];
  const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  for(const p of report.people){
    for(const [dir,label] of [['A','ALLER'],['R','RETOUR']]){
      if(!p.options[dir].length)continue;
      const choice=p.options[dir].find(x=>x.id===p.answer?.[dir]);
      const name=choice?.label|| (p.answer?.[dir]==='NONE'?'Aucun horaire':'—');
      const backup=p.options[dir].find(x=>x.id===p.answer?.[dir+'2']);
      const booking=p.booking?.[dir];
      const state=booking?(booking.optionId===p.answer?.[dir]?'Billet acheté':'⚠ Choix modifié après achat'):
        !p.answer?'En attente':p.answer?.[dir]==='NONE'?'À revoir':'À acheter';
      csv.push([p.first+' '+p.last,p.departure,label,name,backup?.label||'—',state,
        p.answer?.updatedAt?new Date(p.answer.updatedAt).toLocaleString('fr-FR'):'',
        booking?.bookedAt?new Date(booking.bookedAt).toLocaleString('fr-FR'):''].map(escape).join(';'));
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
