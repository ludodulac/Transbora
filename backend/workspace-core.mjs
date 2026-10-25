/**
 * TRANSBORA 041 — private workspace service, isolated from public artist links.
 * Netlify Blobs are a small pilot data store, not a relational database.
 * No personal data is created by this module until an owner completes the
 * deliberately gated bootstrap. Never reuse the public demo authorization.
 */
import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {personMonthView,eventBudgetSummary} from '../site/organizer-domain.mjs';

const scrypt=promisify(scryptCallback);
const COOKIE='__Host-transbora_staff';
const SESSION_AGE=7*24*3600*1000;
const INVITE_AGE=48*3600*1000;
const MAX_BODY=35_000;
const STORE='transbora-organizer-private-v1';
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const safe=(v,n=150)=>String(v??'').trim().slice(0,n).replace(/[\u0000-\u001f]/g,' ');
const email=v=>String(v??'').trim().toLowerCase();
const at=v=>/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,30}$/.test(v);
const compare=(a,b)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json=(payload,status=200,headers={})=>new Response(JSON.stringify(payload),{
  status,headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, private','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer','x-frame-options':'DENY',
    ...headers}});
const deny=(message='Accès refusé.',status=403)=>json({error:message},status);
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
function originOk(req){
  const origin=req.headers.get('origin');
  const mode=req.headers.get('sec-fetch-site');
  return origin===new URL(req.url).origin&&(!mode||mode==='same-origin'||mode==='none');
}
async function bodyOf(req){
  if(Number(req.headers.get('content-length')||0)>MAX_BODY)throw Error('Corps trop grand.');
  const raw=await req.text();
  if(raw.length>MAX_BODY)throw Error('Corps trop grand.');
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('JSON incorrect.');
  return parsed;
}
async function passwordHash(password,salt){
  const derived=await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return derived.toString('hex');
}
function passwordOk(password){return typeof password==='string'&&password.length>=12&&password.length<=128;}
async function newPassword(password){
  const salt=randomBytes(24).toString('hex');
  return {salt,derived:await passwordHash(password,salt)};
}
async function matchesPassword(password,stored){
  if(!stored?.salt||!stored?.derived)return false;
  const derived=await passwordHash(password,stored.salt);
  return compare(derived,stored.derived);
}
function key(type,org,id){return `${type}/${org}/${id}`;}
const requireId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{10,80}$/.test(id);
const formatDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
  !Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const money=n=>n===null||n===undefined||(Number.isSafeInteger(n)&&n>=0&&n<=100_000_000);
async function requireItem(store,entity,org,id){
  if(!requireId(id))throw Error('Identifiant invalide.');
  const item=await store.get(key(entity,org,id),{type:'json'});
  if(!item||item.organizationId!==org)throw Error('Enregistrement introuvable dans cet espace.');
  return item;
}
async function all(store,type,org){
  const {blobs}=await store.list({prefix:`${type}/${org}/`});
  if(blobs.length>1000)throw Error('Trop de lignes pour le pilote : exporter les données.');
  return (await Promise.all(blobs.map(x=>store.get(x.key,{type:'json'}))))
    .filter(x=>x&&x.organizationId===org);
}
function passFields(kind,body,old,org){
  const base={id:old?.id||random(),organizationId:org,
    createdAt:old?.createdAt||new Date().toISOString()};
  if(kind==='person'){
    const name=safe(body.name,100);
    if(!name)throw Error('Le nom est obligatoire.');
    const mail=safe(body.email,180);
    if(mail&&!at(mail))throw Error('Adresse électronique invalide.');
    return {...base,name,email:mail,departure:safe(body.departure,150),
      phone:safe(body.phone,50),reductionCards:safe(body.reductionCards,240),
      preferences:safe(body.preferences,600)};
  }
  if(kind==='event'){
    const title=safe(body.title,120),date=safe(body.startDate,10);
    if(!title||!formatDate(date))throw Error('Titre ou date invalide.');
    const budget=body.budgetCents??null;
    if(!money(budget))throw Error('Enveloppe budgétaire invalide.');
    return {...base,title,startDate:date,budgetCents:budget,
      destination:safe(body.destination,160),theater:safe(body.theater,160)};
  }
  throw Error('Type de fiche interdit.');
}
export function createWorkspaceHandler({getStore,masterKey,clock=()=>Date.now()}){
 return async function handle(req){
  if(req.method!=='POST')return deny('Méthode non autorisée.',405);
  if(!originOk(req))return deny('Origine non autorisée.',403);
  let body;
  try{body=await bodyOf(req);}catch{return deny('Requête incorrecte.',400);}
  const store=getStore(STORE), action=safe(body.action,40);
  try{
    if(action==='bootstrap'){
      const secret=masterKey();
      if(typeof secret!=='string'||secret.length<20||
        !compare(hash(secret),hash(String(body.setupKey||''))))
        return deny('Initialisation non autorisée.');
      const mail=email(body.email);
      if(!at(mail)||!passwordOk(body.password)||!safe(body.organizationName,100))
        return deny('Organisation, courriel ou mot de passe invalide (12 caractères minimum).',400);
      const userKey='user/'+hash(mail);
      if(await store.get(userKey,{type:'json'}))
        return deny('Compte déjà enregistré.',409);
      const organizationId=random();
      const record={organizationId,name:safe(body.organizationName,100),createdAt:clock()};
      const user={organizationId,email:mail,role:'manager',
        password:await newPassword(body.password),createdAt:clock()};
      const created=await store.setJSON(userKey,user,{onlyIfNew:true});
      if(!created.modified)return deny('Compte déjà enregistré.',409);
      await store.setJSON('organization/'+organizationId,record,{onlyIfNew:true});
      return json({created:true,organizationName:record.name},201);
    }
    if(action==='accept_invite'){
      const invitationToken=String(body.token||'');
      if(!/^[A-Za-z0-9_-]{40,90}$/.test(invitationToken))
        return deny('Invitation incorrecte.',400);
      const inviteKey='invite/'+hash(invitationToken);
      const invite=await store.get(inviteKey,{type:'json'});
      if(!invite||invite.expiresAt<clock()||invite.claimedAt)return deny('Invitation expirée ou utilisée.',410);
      const mail=email(body.email);
      if(!passwordOk(body.password)||mail!==invite.email)
        return deny('Courriel ou mot de passe invalide.',400);
      const ukey='user/'+hash(mail);
      const user={organizationId:invite.organizationId,email:mail,
        role:invite.role,password:await newPassword(body.password),createdAt:clock()};
      const created=await store.setJSON(ukey,user,{onlyIfNew:true});
      if(!created.modified)return deny('Ce compte existe déjà.',409);
      await store.setJSON(inviteKey,{...invite,claimedAt:clock()});
      return json({created:true},201);
    }
    if(action==='login'){
      const mail=email(body.email),user=at(mail)?
        await store.get('user/'+hash(mail),{type:'json'}):null;
      // Hash a dummy value as well: do not allow easy account enumeration.
      const ok=await matchesPassword(String(body.password||''),user?.password||
        {salt:'0'.repeat(48),derived:'0'.repeat(128)});
      if(!user||!ok)return deny('Identifiants incorrects.',401);
      const token=random(),session={email:mail,organizationId:user.organizationId,
        role:user.role,expiresAt:clock()+SESSION_AGE};
      await store.setJSON('session/'+hash(token),session);
      return json({connected:true,role:user.role,organizationId:user.organizationId},
        200,{'set-cookie':cookie(token,Math.floor(SESSION_AGE/1000))});
    }
    const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim())
      .find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
    const session=/^[A-Za-z0-9_-]{40,90}$/.test(token)?
      await store.get('session/'+hash(token),{type:'json'}):null;
    if(!session||session.expiresAt<=clock())return deny('Connexion requise.',401);
    const current=await store.get('user/'+hash(session.email),{type:'json'});
    if(!current||current.organizationId!==session.organizationId||
       current.role!==session.role)return deny('Session révoquée.',401);
    const org=session.organizationId;
    if(action==='logout'){
      await store.delete('session/'+hash(token));
      return json({connected:false},200,{'set-cookie':cookie('',0)});
    }
    if(action==='me'){
      const organization=await store.get('organization/'+org,{type:'json'});
      return json({email:session.email,role:session.role,organizationId:org,
        organizationName:organization?.name||''});
    }
    if(action==='invite'){
      if(session.role!=='manager')return deny('Réservé à la direction.');
      const mail=email(body.email);
      const role=body.role;
      if(!at(mail)||!['manager','editor'].includes(role))return deny('Invitation invalide.',400);
      if(await store.get('user/'+hash(mail),{type:'json'}))
        return deny('Cette adresse possède déjà un compte.',409);
      const inviteToken=random();
      await store.setJSON('invite/'+hash(inviteToken),
        {email:mail,role,organizationId:org,expiresAt:clock()+INVITE_AGE,claimedAt:null});
      // No email service / no automated sending. Owner copies the private URL.
      return json({inviteToken,expiresAt:clock()+INVITE_AGE},201);
    }
    if(action==='list'){
      const type=body.type;
      if(!['person','event','participation','option','choice','booking','note'].includes(type))
        return deny('Catégorie invalide.',400);
      return json({items:await all(store,type,org)});
    }
    if(action==='save'){
      if(!['manager','editor'].includes(session.role))return deny('Lecture seule.');
      const type=body.type,obj=body.record;
      if(!obj||typeof obj!=='object'||Array.isArray(obj))return deny('Fiche invalide.',400);
      if(!['person','event','participation','option','choice','booking','note'].includes(type))
        return deny('Catégorie invalide.',400);
      const existing=obj.id?await requireItem(store,type,org,obj.id):null;
      let result;
      if(type==='person'||type==='event'){
        result=passFields(type,obj,existing,org);
      }else{
        const common={id:existing?.id||random(),organizationId:org,
          createdAt:existing?.createdAt||clock(),updatedAt:clock()};
        if(type==='participation'){
          await requireItem(store,'event',org,obj.eventId);
          await requireItem(store,'person',org,obj.personId);
          result={...common,eventId:obj.eventId,personId:obj.personId,
            outwardOrigin:safe(obj.outwardOrigin,150),
            returnDestination:safe(obj.returnDestination,150)};
        }else if(type==='option'){
          const p=await requireItem(store,'participation',org,obj.participationId);
          const legs=obj.legs;
          if(!['A','R'].includes(obj.direction)||!formatDate(obj.travelDate)||
             !Array.isArray(legs)||!legs.length||legs.length>8||
             !money(obj.estimatedCents??null))
            return deny('Trajet invalide.',400);
          const segments=legs.map((l,i)=>({order:i+1,from:safe(l.from,150),to:safe(l.to,150),
            departure:safe(l.departure,36),arrival:safe(l.arrival,36),
            operator:safe(l.operator,70),mode:safe(l.mode,25)||'rail'}));
          if(segments.some(l=>!l.from||!l.to||!l.departure||!l.arrival))
            return deny('Tronçon incomplet.',400);
          if(existing&&(existing.participationId!==p.id||existing.direction!==obj.direction))
            return deny('Impossible de changer le trajet auquel cette option appartient.');
          result={...common,participationId:p.id,direction:obj.direction,
            travelDate:obj.travelDate,source:'manual',estimatedCents:obj.estimatedCents??null,
            legs:segments};
        }else if(type==='choice'){
          const p=await requireItem(store,'participation',org,obj.participationId);
          if(!['A','R'].includes(obj.direction))return deny('Sens invalide.',400);
          const validOption=async id=>{
            if(!id)return null;
            const o=await requireItem(store,'option',org,id);
            if(o.participationId!==p.id||o.direction!==obj.direction)
              throw Error('Proposition d’un autre trajet.');
            return id;
          };
          const firstOptionId=await validOption(obj.firstOptionId);
          const backupOptionId=await validOption(obj.backupOptionId);
          if(firstOptionId&&firstOptionId===backupOptionId)
            return deny('Options nº1 et nº2 identiques.',400);
          // One saved choice per traveler + direction.
          const id='c-'+hash(p.id+':'+obj.direction).slice(0,42);
          result={...common,id,participationId:p.id,direction:obj.direction,
            firstOptionId,backupOptionId,confirmedBy:session.email};
        }else if(type==='booking'){
          const o=await requireItem(store,'option',org,obj.optionId);
          if(!['PROPOSED','IN_CART','PAID','FILED'].includes(obj.stage)||
             !money(obj.paidCents??null))return deny('Statut ou montant invalide.',400);
          const id='b-'+hash(o.id).slice(0,42);
          const earlier=await store.get(key('booking',org,id),{type:'json'});
          if(obj.stage==='FILED'&&!obj.receiptReference)
            return deny('Indiquez où le billet est classé.',400);
          if(earlier?.paidAt&&['PROPOSED','IN_CART'].includes(obj.stage))
            return deny('Un achat déjà confirmé nécessite une correction explicite.',409);
          result={...common,id,participationId:o.participationId,optionId:o.id,
            inCartAt:obj.stage==='IN_CART'||obj.stage==='PAID'||obj.stage==='FILED'?
              earlier?.inCartAt||clock():null,
            paidAt:['PAID','FILED'].includes(obj.stage)?earlier?.paidAt||clock():null,
            filedAt:obj.stage==='FILED'?earlier?.filedAt||clock():null,
            paidCents:['PAID','FILED'].includes(obj.stage)?obj.paidCents??null:null,
            receiptReference:obj.stage==='FILED'?safe(obj.receiptReference,400):'',
            updatedBy:session.email};
        }else{
          const targetType=obj.targetType;
          if(!['person','event'].includes(targetType))return deny('Cible de note invalide.',400);
          const t=await requireItem(store,targetType,org,obj.targetId);
          const content=safe(obj.content,2000);
          if(!content)return deny('Note vide.',400);
          if(existing&&(existing.targetType!==targetType||existing.targetId!==t.id))
            return deny('La note ne peut pas changer de cible.',400);
          result={...common,targetType,targetId:t.id,content,visibility:'private',
            updatedBy:session.email};
        }
      }
      result.updatedAt=clock();
      // No blind overwriting of someone else's data. Every key includes org.
      await store.setJSON(key(type,org,result.id),result);
      return json({saved:true,item:result});
    }
    if(action==='person_month'||action==='event_budget'){
      const data={organizationId:org};
      for(const [prop,type] of [['people','person'],['events','event'],
        ['participations','participation'],['options','option'],
        ['choices','choice'],['bookings','booking']]){
        data[prop]=await all(store,type,org);
      }
      return json(action==='person_month'?
        personMonthView({...data,personId:body.personId,month:body.month}):
        eventBudgetSummary({...data,eventId:body.eventId}));
    }
    return deny('Action inconnue.',400);
  }catch(error){
    // Never disclose infrastructure stack, secret or internal exceptions.
    return deny(/^Enregistrement introuvable|^Identifiant invalide|^Option de voyage invalide|^Un billet classé|^Tronçons invalides|^Personne absente|^Événement absent|^Choix principal|^Proposition d’un autre trajet/.test(error.message||'')?
      error.message:'Opération impossible, vérifiez les informations.',400);
  }
 };
}
