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
function matchesStoredDigest(stored,candidate){
  if(!/^[a-f0-9]{64}$/.test(stored))return false;
  return timingSafeEqual(Buffer.from(stored,'hex'),Buffer.from(digest(candidate),'hex'));
}
function checkedEvent(e){
  if(!e||typeof e!=='object')throw new Error('Événement manquant.');
  const title=safe(e.title,90),destination=safe(e.destination,140);
  if(!title||!destination)throw new Error('Nom ou lieu manquant.');
  const startDate=safe(e.startDate,10),endDate=safe(e.endDate,10);
  const startTime=safe(e.startTime,5),endTime=safe(e.endTime,5);
  for(const date of [startDate,endDate]){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||
      new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)
      throw new Error('Date de présence invalide.');
  }
  if(![startTime,endTime].every(t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))||
    endDate+'T'+endTime<=startDate+'T'+startTime)
    throw new Error('La fin doit être postérieure au début de présence.');
  return {title,destination,startDate,startTime,endDate,endTime};
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
    return {id,first,last,departure:from,options,
      onsite:{A:p.onsite?.A===true,R:p.onsite?.R===true},
      routeEnds:{
        A:{from:safe(p.routeEnds?.A?.from||from,140),to:safe(p.routeEnds?.A?.to,140)},
        R:{from:safe(p.routeEnds?.R?.from,140),to:safe(p.routeEnds?.R?.to||from,140)}
      }};
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
async function issueLinks(store,eventId,mode,people,expiresAt){
  const batches=mode==='group'?[{key:'all',people}]:
    people.map(p=>({key:p.id,people:[p]}));
  const results=[];
  for(const batch of batches){
    const linkToken=token();
    const item={token:linkToken,eventId,scope:mode,
      personIds:batch.people.map(p=>p.id),expiresAt};
    await store.setJSON(prefix('t',linkToken),item,{onlyIfNew:true});
    results.push({token:linkToken,personId:batch.key,
      label:batch.key==='all'?'Groupe':
        batch.people.map(p=>p.first+' '+p.last).join('')});
  }
  return results;
}

export function createChoiceHandler({getStore,masterKey,clock=()=>Date.now(),openDemo=()=>false}){
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
      const bookings=getStore('transbora-booking-states');
      if(op==='create'){
        const secret=masterKey();
        const provided=req.headers.get('x-transbora-admin')||'';
        const allowedWithCode=Boolean(secret&&provided&&equals(secret,provided));
        const isOpenDemo=Boolean(openDemo()&&!provided);
        if(!allowedWithCode&&!isOpenDemo)return failure('Création non autorisée.',403);
        if(isOpenDemo){
          // Anyone visiting this prototype can create a folder, but ordinary
          // cross-site browser requests must not be allowed to consume storage.
          // This is a CSRF check, not full authentication. Netlify's function
          // IP rate limiter stays enabled. Never enable this for production.
          const requestOrigin=req.headers.get('origin');
          if(!requestOrigin||requestOrigin!==new URL(req.url).origin)
            return failure('Origine de création non autorisée.',403);
        }
        const mode=body.mode;
        if(!['group','individual'].includes(mode))return failure('Type de partage invalide.');
        const event=checkedEvent(body.event),people=checkedPeople(body.people);
        const eventId=token(),ownerKey=token();
        // Never let travelers' links expire before their event takes place.
        const expiresAt=Math.max(clock()+LIFETIME,
          Date.parse(event.endDate+'T12:00:00Z')+LIFETIME);
        const urlTokens=await issueLinks(links,eventId,mode,people,expiresAt);
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
        // Old links are revoked immediately when the owner changes mode,
        // even if a Blob deletion is delayed or fails.
        if(!record.shareLinks.some(link=>link.token===shareToken))
          return failure('Ce lien a été remplacé. Demandez le nouveau lien à votre organisateur.',410);
        const authorized=record.people.filter(p=>lookup.personIds.includes(p.id));
        if(op==='view'){
          const people=await Promise.all(authorized.map(async p=>{
            const answer=await replies.get(prefix('r',record.id+'/'+p.id),{type:'json'});
            // This token already grants access to this group / traveler, not to
            // the organizer's booking tracking or private owner credential.
            return {...p,answered:Boolean(answer),answer:answer?{
              A:answer.A??null,R:answer.R??null,A2:answer.A2??null,R2:answer.R2??null
            }:null};
          }));
          return json({event:record.event,mode:record.mode,people,expiresAt:record.expiresAt});
        }
        // A group member can confirm JUST their own choices without waiting
        // for all other travelers. Keep the original bulk format compatible.
        if(!Array.isArray(body.answers)||!body.answers.length||body.answers.length>authorized.length)
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
            const backup=safe(answer[d+'2'],180);
            if(backup && backup!=='NONE'){
              if(backup===selected||!p.options[d].some(o=>o.id===backup))
                return failure('Le deuxième choix doit être différent du premier.');
              if(selected==='NONE')return failure('Aucun horaire et un deuxième choix sont incompatibles.');
              values[d+'2']=backup;
            }else values[d+'2']=null;
          }
          chosen.set(p.id,values);
        }
        // Write only explicitly submitted traveler IDs. Existing answers for
        // Michel are NEVER touched when Sophie submits later.
        for(const [personId,selected] of chosen){
          await replies.setJSON(prefix('r',record.id+'/'+personId),
            {personId,...selected,updatedAt:clock()});
        }
        return json({saved:true,count:chosen.size});
      }
      if(op==='status'||op==='remove'||op==='switch_mode'||op==='set_booking'){
        const eventId=safe(body.eventId,80),ownerKey=safe(body.ownerKey,80);
        if(!eventId||!ownerKey)return failure('Lien organisateur incomplet.',401);
        const record=await events.get(prefix('e',eventId),{type:'json'});
        if(!record||!matchesStoredDigest(record.ownerDigest,ownerKey))
          return failure('Lien organisateur non reconnu.',403);
        if(op==='set_booking'){
          // A private organizer-only confirmation of an ACTUAL purchase.
          // Never interpret an artist's choice or a GTFS timetable as a booked seat.
          const personId=safe(body.personId,40),direction=body.direction;
          if(!['A','R'].includes(direction))return failure('Sens de trajet invalide.');
          const person=record.people.find(p=>p.id===personId);
          if(!person)return failure('Voyageur inconnu.');
          if(typeof body.booked!=='boolean')return failure('Statut de réservation invalide.');
          const key=prefix('b',eventId+'/'+personId);
          const state=await bookings.get(key,{type:'json'})||{A:null,R:null};
          if(body.booked){
            const answer=await replies.get(prefix('r',eventId+'/'+personId),{type:'json'});
            const optionId=safe(body.optionId,180);
            if(!answer||!optionId||answer[direction]!==optionId||optionId==='NONE'||
              !person.options[direction].some(option=>option.id===optionId))
              return failure('Le trajet choisi a changé : actualisez le dossier avant de confirmer un achat.',409);
            if(state[direction] && state[direction].optionId!==optionId)
              return failure('Un autre billet est déjà marqué acheté pour ce sens. Vérifiez-le avant de modifier le statut.',409);
            state[direction]=state[direction]||{optionId,bookedAt:clock()};
          }else{
            // This updates only Transbora tracking: it cannot cancel/refund a ticket.
            state[direction]=null;
          }
          if(state.A||state.R)await bookings.setJSON(key,state);
          else await bookings.delete(key);
          return json({saved:true,booking:state});
        }
        if(op==='switch_mode'){
          const mode=body.mode;
          if(!['group','individual'].includes(mode))return failure('Type de partage invalide.');
          if(mode===record.mode)
            return json({eventId,ownerKey,mode,links:record.shareLinks,unchanged:true});
          // Keep the same event, travelers, itinerary proposals and answers.
          // Commit the new active token set before revoking previous links.
          const next=await issueLinks(links,eventId,mode,record.people,record.expiresAt);
          await events.setJSON(prefix('e',eventId),
            {...record,mode,shareLinks:next});
          for(const previous of record.shareLinks){
            try{await links.delete(prefix('t',previous.token));}
            catch{ /* Membership verification already rejects this token. */ }
          }
          return json({eventId,ownerKey,mode,links:next,changed:true});
        }
        if(op==='remove'){
          await events.delete(prefix('e',eventId));
          for(const l of record.shareLinks)await links.delete(prefix('t',l.token));
          for(const p of record.people){
            await replies.delete(prefix('r',eventId+'/'+p.id));
            await bookings.delete(prefix('b',eventId+'/'+p.id));
          }
          return json({removed:true});
        }
        const answerRows=await Promise.all(record.people.map(p=>
          replies.get(prefix('r',eventId+'/'+p.id),{type:'json'})));
        const bookingRows=await Promise.all(record.people.map(p=>
          bookings.get(prefix('b',eventId+'/'+p.id),{type:'json'})));
        return json({event:record.event,mode:record.mode,expiresAt:record.expiresAt,
          links:record.shareLinks,people:record.people.map((p,i)=>({
            ...p,answer:answerRows[i]||null,
            booking:bookingRows[i]||{A:null,R:null}
          }))});
      }
      return failure('Action inconnue.');
    }catch(error){
      // Never echo storage failures, secrets, blobs keys or stack traces.
      if(error.message?.match(/^(Voyageur|Entre |Aucun horaire|Nom ou lieu|Événement manquant|Date de présence|La fin doit|Proposition|Trop de propositions)/))
        return failure(error.message);
      return failure('Impossible de traiter la demande. Veuillez réessayer.',503);
    }
  };
}
