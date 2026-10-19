/** Native Transbora choice backend — isolated pure logic, testable without Netlify. */
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';

const MAX_PEOPLE=100, MAX_OPTIONS=5, LIFETIME=45*24*3600*1000;
const json=(value,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
const failure=(message,status=400)=>json({error:message},status);
const str=(x,max=120)=>String(x??'').trim().slice(0,max);
const safe=(x,n=80)=>str(x,n).replace(/[\u0000-\u001F]/g,' ');
const token=()=>randomBytes(24).toString('base64url');
const digest=x=>createHash('sha256').update(x).digest('hex');
function equals(a,b){
  const x=Buffer.from(digest(a),'hex'),y=Buffer.from(digest(b),'hex');
  return timingSafeEqual(x,y);
}
function checkedEvent(e){
  if(!e||typeof e!=='object')throw new Error('Événement manquant.');
  const title=safe(e.title,90),destination=safe(e.destination,140);
  if(!title||!destination)throw new Error('Nom ou lieu manquant.');
  return {title,destination,startDate:safe(e.startDate,10),
    startTime:safe(e.startTime,5),endDate:safe(e.endDate,10),endTime:safe(e.endTime,5)};
}
function checkedPeople(raw){
  if(!Array.isArray(raw)||!raw.length||raw.length>MAX_PEOPLE)
    throw new Error('Entre 1 et 100 voyageurs requis.');
  const seen=new Set();
  return raw.map((p)=>{
    const id=safe(p.id,40),first=safe(p.first,85),last=safe(p.last,85),from=safe(p.departure,140);
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||!first||!last||!from||seen.has(id))
      throw new Error('Voyageur incomplet ou en double.');
    seen.add(id);
    const options={};
    for(const dir of ['A','R']){
      const input=p.options?.[dir]||[];
      if(!Array.isArray(input)||input.length>MAX_OPTIONS)
        throw new Error('Trop de propositions pour '+first);
      const ids=new Set();
      options[dir]=input.map(o=>{
        const id=safe(o.id,180),label=safe(o.label,400);
        if(!id||!label||ids.has(id))throw new Error('Proposition manquante ou doublon.');
        ids.add(id);return {id,label};
      });
    }
    if(!options.A.length&&!options.R.length)
      throw new Error('Aucun horaire disponible pour '+first+' '+last);
    return {id,first,last,departure:from,options};
  });
}
async function takeBody(req){
  const size=Number(req.headers.get('content-length')||0);
  if(size>175000)throw new Error('Dossier trop volumineux (175 Ko maximum).');
  const txt=await req.text();
  if(txt.length>175000)throw new Error('Dossier trop volumineux.');
  return JSON.parse(txt);
}
const prefix=(name,id)=>name+'/'+id;
export function createChoiceHandler({getStore,masterKey,clock=()=>Date.now()}){
  return async function handle(req){
    if(req.method==='GET')return json({status:'ok',service:'Transbora choix',version:1});
    if(req.method!=='POST')return failure('Méthode non autorisée',405);
    let body;
    try{body=await takeBody(req);}catch{return failure('Requête JSON invalide.');}
    const op=body.action;
    try{
      const events=getStore('transbora-event-records');
      const links=getStore('transbora-private-links');
      const replies=getStore('transbora-choice-replies');
      if(op==='create'){
        const secret=masterKey();
        const provided=req.headers.get('x-transbora-admin')||'';
        if(!secret||!provided||!equals(secret,provided))return failure('Code organisateur incorrect.',403);
        const mode=body.mode;
        if(!['group','individual'].includes(mode))return failure('Type de partage invalide.');
        const event=checkedEvent(body.event),people=checkedPeople(body.people);
        const eventId=token(),ownerKey=token(),expiresAt=clock()+LIFETIME;
        const batches=mode==='group'?[{key:'all',people}]:
          people.map(p=>({key:p.id,people:[p]}));
        const urlTokens=[];
        for(const batch of batches){
          const linkToken=token();
          const item={token:linkToken,eventId,scope:mode,personIds:batch.people.map(p=>p.id),
            expiresAt};
          await links.setJSON(prefix('t',linkToken),item,{onlyIfNew:true});
          urlTokens.push({token:linkToken,personId:batch.key,
            label:batch.key==='all'?'Organisateur':batch.people.map(p=>p.first+' '+p.last).join('')});
        }
        await events.setJSON(prefix('e',eventId),{id:eventId,ownerDigest:digest(ownerKey),
          event,people,mode,shareLinks:urlTokens,expiresAt,createdAt:clock()}, {onlyIfNew:true});
        return json({eventId,ownerKey,expiresAt,links:urlTokens},201);
      }
      if(op==='view'||op==='submit'){
        const shareToken=safe(body.token,80);
        if(!shareToken||!/^[A-Za-z0-9_-]{20,80}$/.test(shareToken))
          return failure('Lien de voyage invalide.',404);
        const lookup=await links.get(prefix('t',shareToken),{type:'json'});
        if(!lookup)return failure('Lien inexistant.',404);
        if(lookup.expiresAt<clock())return failure('Lien expiré.',410);
        const record=await events.get(prefix('e',lookup.eventId),{type:'json'});
        if(!record||record.expiresAt<clock())return failure('Événement indisponible.',410);
        const authorized=record.people.filter(p=>lookup.personIds.includes(p.id));
        if(op==='view')return json({event:record.event,mode:record.mode,
          people:authorized.map(p=>({...p,options:p.options})),expiresAt:record.expiresAt});
        if(!Array.isArray(body.answers)||body.answers.length!==authorized.length)
          return failure('Sélection incomplète.');
        const chosen=new Map();
        for(const answer of body.answers){
          const p=authorized.find(x=>x.id===answer.personId);
          if(!p||chosen.has(p.id))return failure('Voyageur inconnu.');
          const values={};
          for(const d of ['A','R']){
            if(!p.options[d].length){values[d]=null;continue;}
            const selected=safe(answer[d],180);
            if(selected!=='NONE'&&!p.options[d].some(o=>o.id===selected))
              return failure('Choisissez une proposition valide ou Aucun.');
            values[d]=selected;
          }
          chosen.set(p.id,values);
        }
        for(const p of authorized){
          await replies.setJSON(prefix('r',record.id+'/'+p.id),
            {personId:p.id,...chosen.get(p.id),updatedAt:clock()});
        }
        return json({saved:true,count:chosen.size});
      }
      if(op==='status'||op==='remove'){
        const eventId=safe(body.eventId,80),ownerKey=safe(body.ownerKey,80);
        if(!eventId||!ownerKey)return failure('Lien organisateur incomplet.',401);
        const record=await events.get(prefix('e',eventId),{type:'json'});
        if(!record||!equals(record.ownerDigest,ownerKey))
          return failure('Lien organisateur non reconnu.',403);
        if(op==='remove'){
          await events.delete(prefix('e',eventId));
          for(const l of record.shareLinks)await links.delete(prefix('t',l.token));
          for(const p of record.people)await replies.delete(prefix('r',eventId+'/'+p.id));
          return json({removed:true});
        }
        const answerRows=await Promise.all(record.people.map(async p=>
          await replies.get(prefix('r',eventId+'/'+p.id),{type:'json'})));
        return json({event:record.event,mode:record.mode,expiresAt:record.expiresAt,
          links:record.shareLinks,people:record.people.map((p,i)=>({
            ...p,answer:answerRows[i]||null
          }))});
      }
      return failure('Action inconnue.');
    }catch(error){
      // Never echo storage failures, secrets, blobs keys or stack traces.
      if(error.message?.match(/^(Voyageur|Entre |Aucun horaire|Nom ou lieu|Événement manquant|Proposition|Trop de propositions)/))
        return failure(error.message);
      return failure('Impossible de traiter la demande. Veuillez réessayer.',503);
    }
  };
}
