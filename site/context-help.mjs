/**
 * TRANSBORA contextual help — mission 051.
 * One switch disables all of this: HELP_ENABLED = false.
 * To remove the code altogether, remove this module's <script> tag
 * from organisation.html and events.html. No business code is touched.
 */
import {ORGANIZER_HELP_MAIN} from './help-topics-organizer-main.mjs';
import {ORGANIZER_HELP_TRAVELS} from './help-topics-organizer-travels.mjs';
import {ORGANIZER_HELP_EXTRA} from './help-topics-organizer-extra.mjs';
import {WIZARD_HELP} from './help-topics-wizard.mjs';
export const HELP_ENABLED=true;
export const ORGANIZER_HELP=[...ORGANIZER_HELP_MAIN,...ORGANIZER_HELP_TRAVELS,...ORGANIZER_HELP_EXTRA];

export function mountContextHelp(doc=globalThis.document,{enabled=HELP_ENABLED,page}={}){
 if(!enabled||!doc?.body)return {count:0,dispose:()=>{}};
 if(doc.body.dataset.transboraContextHelpMounted==='1')
  return {count:0,alreadyMounted:true,dispose:()=>{}};
 const isWizard=(page||(/\/events\.html$/.test(doc.location?.pathname||'')?'wizard':'organizer'))==='wizard';
 const topics=isWizard?WIZARD_HELP:ORGANIZER_HELP;
 const style=doc.createElement('link');
 style.rel='stylesheet';style.href='./context-help.css';
 style.dataset.transboraContextHelp='1';doc.head.append(style);

 const overlay=doc.createElement('div');overlay.className='tb-help-overlay';
 overlay.hidden=true;overlay.dataset.transboraContextHelp='1';
 const dialog=doc.createElement('section');dialog.className='tb-help-card';
 dialog.id='tb-context-help-card';dialog.setAttribute('role','dialog');
 dialog.setAttribute('aria-modal','true');
 dialog.setAttribute('aria-labelledby','tb-help-title');
 dialog.setAttribute('aria-describedby','tb-help-text');
 const header=doc.createElement('div');header.className='tb-help-header';
 const title=doc.createElement('h3');title.id='tb-help-title';
 const close=doc.createElement('button');close.type='button';
 close.className='tb-help-close';close.textContent='×';
 close.setAttribute('aria-label',"Fermer l'explication");
 header.append(title,close);
 const paragraph=doc.createElement('p');paragraph.id='tb-help-text';
 dialog.append(header,paragraph);overlay.append(dialog);doc.body.append(overlay);
 let active=null,oldOverflow=null;
 const hide=()=>{
  if(overlay.hidden)return;
  overlay.hidden=true;
  if(active){active.setAttribute('aria-expanded','false');active.focus();}
  active=null;doc.body.style.overflow=oldOverflow??'';oldOverflow=null;
 };
 const open=(button,heading,content)=>{
  if(!overlay.hidden&&active===button){hide();return;}
  active?.setAttribute('aria-expanded','false');active=button;
  title.textContent=heading;paragraph.textContent=content;
  button.setAttribute('aria-expanded','true');
  if(overlay.hidden)oldOverflow=doc.body.style.overflow;
  overlay.hidden=false;doc.body.style.overflow='hidden';
  close.focus();
 };
 const buttons=[];
 for(const [selector,heading,content] of topics){
  const target=doc.querySelector(selector);if(!target)continue;
  const input=target.matches('input,select,textarea');
  const anchor=input?target.closest('label'):target;
  if(!anchor||anchor.closest('.legacy-excel,.secondary-import'))continue;
  const button=doc.createElement('button');button.type='button';
  button.className='tb-help-trigger';button.textContent='?';
  button.setAttribute('aria-label','Aide : '+heading);
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls','tb-context-help-card');
  button.setAttribute('aria-expanded','false');button.title='Explication : '+heading;
  if(input&&anchor.tagName==='LABEL'){
   anchor.classList.add('tb-help-field');
   anchor.append(button); // after its input, preserving normal label behavior
  }else if(selector==='#auth-title'||selector==='#person-sheet-title'){
   // These are rewritten with textContent at runtime; keep help separate.
   anchor.insertAdjacentElement('afterend',button);
   button.classList.add('tb-help-inline');
  }else if(anchor.matches('h1,h2,h3,strong,summary')){
   anchor.append(button);
  }else{
   anchor.insertAdjacentElement('afterend',button);
   button.classList.add('tb-help-inline');
  }
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   open(button,heading,content);
  });
  buttons.push(button);
 }
 const onKey=event=>{
  if(overlay.hidden)return;
  if(event.key==='Escape'){event.preventDefault();hide();}
  if(event.key==='Tab'){event.preventDefault();close.focus();}
 };
 const onBackdrop=event=>{if(event.target===overlay)hide();};
 close.addEventListener('click',hide);overlay.addEventListener('click',onBackdrop);
 doc.addEventListener('keydown',onKey);
 doc.body.dataset.transboraContextHelpMounted='1';
 return {count:buttons.length,dispose(){
  hide();doc.removeEventListener('keydown',onKey);
  for(const button of buttons){
   const label=button.closest('label.tb-help-field');
   button.remove();if(label&&!label.querySelector('.tb-help-trigger'))
    label.classList.remove('tb-help-field');
  }
  overlay.remove();style.remove();
  delete doc.body.dataset.transboraContextHelpMounted;
 }};
}
// Module tag inserted on each page (not into the app business logic).
if(typeof document!=='undefined'&&HELP_ENABLED){
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',()=>mountContextHelp(document),{once:true});
 else mountContextHelp(document);
}
