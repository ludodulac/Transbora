import {prepareFeeds,planEvent} from './event-planner.mjs';
import {officialIndex} from './connections.mjs';

let ready=null;
// Keep only transit data in the worker; never store travelers or results.
async function sources(manifest){
  if(ready)return ready;
  ready=(async()=>{
    const prepared=await prepareFeeds(manifest);
    if(!prepared.feeds.length)throw new Error('Aucune donnée horaire accessible.');
    let rules=new Map();
    try{
      const res=await fetch('./data/mct.json');
      if(res.ok)rules=officialIndex(await res.json());
    }catch(_e){/* Optional connection margin rules */ }
    return {...prepared,rules};
  })();
  try{return await ready;}catch(error){ready=null;throw error;}
}

self.onmessage=async message=>{
  const {event,people,settings,manifest,limits}=message.data||{};
  try{
    self.postMessage({type:'stage',label:'Chargement des horaires…'});
    const prepared=await sources(manifest);
    self.postMessage({type:'stage',label:'Recherche des correspondances…'});
    const result=await planEvent(event,people,prepared.feeds,settings,prepared.rules,
      (done,total,p)=>self.postMessage({type:'progress',done,total,name:p.first+' '+p.last}),{
        ...limits,
        onTier:({person,kind,tier,skipped})=>{
          const level=tier==='no'?'sans changement':
            tier==='only_one'?'avec 1 correspondance':'avec 2 correspondances';
          self.postMessage({type:'stage',
            label:person.first+' '+person.last+' · '+(kind==='A'?'Aller':'Retour')+
              ' · '+(skipped?'aucune liaison possible ':'recherche ')+level});
        },
        onDay:({person,kind,date,searched,level})=>{
          // Explicitly show which transfer tier is being attempted.
          if(level!=null || searched===1 || searched%3===0)self.postMessage({
            type:'day',name:person.first+' '+person.last,kind,date,searched,level});
        }
      });
    self.postMessage({type:'complete',plans:[...result.plans],
      issues:[...prepared.issues,...result.issues],partial:result.partial});
  }catch(error){
    self.postMessage({type:'error',message:error.message||'Erreur de recherche des horaires.'});
  }
};
