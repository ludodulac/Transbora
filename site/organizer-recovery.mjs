/**
 * Explicit cross-preview recovery for LOCAL rehearsal data only.
 *
 * A new deploy-preview subdomain is a DIFFERENT browser origin. The browser
 * cannot read that old localStorage. This validated backup transport is the
 * only opt-in way to carry a locally saved rehearsal to a new preview.
 *
 * Never accept owner keys, native invitation capabilities, authorization
 * cookies or arbitrary fields from the input backup.
 */
const kinds=['person','event','participation','need','option','choice','booking','note'];
const limits={person:500,event:250,participation:1000,need:2000,option:2000,
  choice:2000,booking:2000,note:1000};
const pick=(row,field,max=120)=>String(row?.[field]??'').slice(0,max);
const id=row=>{
  const value=pick(row,'id',100);
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw Error('Identifiant de sauvegarde invalide.');
  return value;
};
const iso=x=>/^\d{4}-\d{2}-\d{2}$/.test(x);
const cents=x=>x==null||(Number.isSafeInteger(x)&&x>=0);
const stamp=x=>Number.isFinite(x)?x:Date.now();
const requireFlag=(condition,message)=>{if(!condition)throw Error(message)};
export function validateRehearsalBackup(raw){
 requireFlag(raw&&typeof raw==='object'&&!Array.isArray(raw)&&
  raw.type==='local-rehearsal'&&raw.version===1,
  'Le fichier ne contient pas une sauvegarde de démonstration TRANSBORA compatible.');
 const data={version:1};
 for(const kind of kinds){
  const rows=kind==='need'?(raw.need||[]):raw[kind];
  requireFlag(Array.isArray(rows)&&rows.length<=limits[kind],
    'Taille ou liste invalide : '+kind);
  const ids=new Set();
  data[kind]=rows.map(row=>{
    requireFlag(row&&typeof row==='object'&&!Array.isArray(row),
      'Enregistrement invalide : '+kind);
    const identifier=id(row);
    requireFlag(!ids.has(identifier),'Identifiant en double : '+kind);
    ids.add(identifier);
    const base={id:identifier,organizationId:'local-rehearsal',
      createdAt:stamp(row.createdAt),updatedAt:stamp(row.updatedAt)};
    if(kind==='person'){
      requireFlag(pick(row,'name',200).trim(),'Nom manquant.');
      return {...base,name:pick(row,'name',200),departure:pick(row,'departure',200),
        email:pick(row,'email',200),phone:pick(row,'phone',100),
        reductionCards:pick(row,'reductionCards',240),preferences:pick(row,'preferences',600)};
    }
    if(kind==='event'){
      requireFlag(pick(row,'title',160).trim()&&iso(row.startDate||'')&&
        cents(row.budgetCents),'Événement invalide.');
      return {...base,title:pick(row,'title',160),startDate:pick(row,'startDate',10),
        destination:pick(row,'destination',160),theater:pick(row,'theater',160),
        budgetCents:row.budgetCents??null,
        startTime:pick(row,'startTime',5),endDate:pick(row,'endDate',10),
        endTime:pick(row,'endTime',5),arrivalLeadMinutes:
          Number.isInteger(row.arrivalLeadMinutes)?row.arrivalLeadMinutes:60};
    }
    if(kind==='participation'){
      return {...base,eventId:pick(row,'eventId',100),
        personId:pick(row,'personId',100),active:row.active!==false};
    }
    if(kind==='need'){
      requireFlag(['A','R'].includes(row.direction)&&iso(row.targetDate||'')&&
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.targetTime||'')&&
        pick(row,'origin',160)&&pick(row,'destination',160),'Déplacement invalide.');
      return {...base,participationId:pick(row,'participationId',100),
        direction:row.direction,targetDate:pick(row,'targetDate',10),
        targetTime:pick(row,'targetTime',5),origin:pick(row,'origin',160),
        destination:pick(row,'destination',160),customized:row.customized===true,
        note:pick(row,'note',400)};
    }
    if(kind==='option'){
      requireFlag(['A','R'].includes(row.direction)&&iso(row.travelDate||'')&&
        cents(row.estimatedCents)&&Array.isArray(row.legs)&&
        row.legs.length>0&&row.legs.length<=6,'Proposition de voyage invalide.');
      const legs=row.legs.map((l,index)=>{
        requireFlag(l&&typeof l==='object'&&l.from&&l.to&&l.departure&&l.arrival,
          'Tronçon de voyage incomplet.');
        return {order:index+1,from:pick(l,'from',150),to:pick(l,'to',150),
          departure:pick(l,'departure',5),arrival:pick(l,'arrival',5),
          mode:l.mode==='bus'?'bus':'rail',operator:pick(l,'operator',100),
          departureDate:pick(l,'departureDate',10),arrivalDate:pick(l,'arrivalDate',10)};
      });
      return {...base,participationId:pick(row,'participationId',100),
        direction:row.direction,travelDate:pick(row,'travelDate',10),
        estimatedCents:row.estimatedCents??null,source:pick(row,'source',200),
        sourceKey:pick(row,'sourceKey',6000),legs};
    }
    if(kind==='choice'){
      requireFlag(['A','R'].includes(row.direction),'Sens de choix invalide.');
      return {...base,participationId:pick(row,'participationId',100),
        direction:row.direction,firstOptionId:pick(row,'firstOptionId',100)||null,
        backupOptionId:pick(row,'backupOptionId',100)||null,
        origin:pick(row,'origin',40),nativeEventId:pick(row,'nativeEventId',100)};
    }
    if(kind==='booking'){
      requireFlag(cents(row.paidCents),'Montant payé invalide.');
      return {...base,participationId:pick(row,'participationId',100),
        optionId:pick(row,'optionId',100),inCartAt:row.inCartAt?stamp(row.inCartAt):null,
        paidAt:row.paidAt?stamp(row.paidAt):null,
        filedAt:row.filedAt?stamp(row.filedAt):null,
        paidCents:row.paidCents??null,receiptReference:pick(row,'receiptReference',400)};
    }
    requireFlag(['person','event'].includes(row.targetType)&&pick(row,'content',2000),
      'Note invalide.');
    return {...base,targetType:row.targetType,targetId:pick(row,'targetId',100),
      content:pick(row,'content',2000),updatedBy:pick(row,'updatedBy',200)};
  });
 }
 const ids=kind=>new Set(data[kind].map(row=>row.id));
 const people=ids('person'),events=ids('event'),parts=ids('participation'),options=ids('option');
 for(const row of data.participation)
  requireFlag(people.has(row.personId)&&events.has(row.eventId),'Inscription orpheline.');
 for(const row of data.need)
  requireFlag(parts.has(row.participationId),'Déplacement sans participant.');
 for(const row of data.option)
  requireFlag(parts.has(row.participationId),'Trajet sans participant.');
 for(const row of data.choice){
  requireFlag(parts.has(row.participationId),'Choix sans participant.');
  for(const k of [row.firstOptionId,row.backupOptionId])
   if(k&&k!=='NONE')requireFlag(options.has(k),'Choix sans trajet.');
 }
 for(const row of data.booking)
  requireFlag(parts.has(row.participationId)&&options.has(row.optionId),
    'Billet sans trajet.');
 for(const row of data.note)
  requireFlag((row.targetType==='person'?people:events).has(row.targetId),
    'Note sans fiche.');
 return data;
}
