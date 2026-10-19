/**
 * TRANSBORA · Google Forms dans TON Google Drive.
 *
 * Installation unique : ouvrir le Google Sheet "Transbora — Réponses de test"
 * > Extensions > Apps Script > coller ce fichier dans Code.gs > enregistrer.
 * Puis revenir au Sheet, actualiser, menu Transbora > Créer les formulaires.
 *
 * OPTION : une application Web PRIVÉE (accès : Vous uniquement)
 * peut recevoir la sélection de Transbora en un clic.
 * N'utilisez JAMAIS « Tout le monde » : elle crée des fichiers dans votre Drive.
 * Aucun jeton personnel ni URL de déploiement ne doit être mis dans GitHub.
 * Les réponses sont lues chaque heure (ou immédiatement via le menu Sheets).
 * L'utilisateur garde la main sur les autorisations Google.
 *
 * Entrée : coller depuis transbora/events.html en A1 de "Propositions".
 * Sorties : "Liens" (liens à transmettre), "Réponses" (choix de voyageurs).
 */
var TRANSBORA={
  headers:['Dossier ID','Événement','Mode','Voyageur ID','Prénom','Nom','Ville de départ','Sens','Option ID','Proposition','Date'],
  name:'Transbora'
};

function onOpen(){
  SpreadsheetApp.getUi().createMenu('Transbora')
    .addItem('Créer les formulaires','creerFormulairesTransbora')
    .addItem('Actualiser les réponses','synchroniserReponsesTransbora')
    .addItem('Vérifier les feuilles','verifierFeuillesTransbora')
    .addToUi();
}

function parsePropositions_(values){
  if(values.length<2)throw new Error('Collez les propositions Transbora dans la cellule A1.');
  for(var h=0;h<TRANSBORA.headers.length;h++){
    if(String(values[0][h]).trim()!==TRANSBORA.headers[h])
      throw new Error('En-tête invalide en colonne '+(h+1)+' : '+TRANSBORA.headers[h]+'. Recollez depuis Transbora en A1.');
  }
  var first=values[1], dossier=String(first[0]||'').trim(),
    mode=String(first[2]||'').trim(),event=String(first[1]||'').trim();
  if(!/^[A-Za-z0-9_-]{5,80}$/.test(dossier))
    throw new Error('Code dossier manquant. Recopiez les propositions depuis Transbora.');
  if(mode!=='collectif'&&mode!=='individuel')throw new Error('Mode de questionnaire invalide.');
  if(!event||event.length>90)throw new Error('Nom événement invalide.');
  var rows=[], seen=new Set();
  for(var r=1;r<values.length;r++){
    var x=values[r];
    if(String(x[0]||'').trim()!==dossier)continue; // previous pasted batches still present
    if(String(x[2]||'').trim()!==mode)continue;
    var v=x.slice(0,11).map(function(c){return String(c||'').trim();});
    if(!/^[A-Za-z0-9_-]{1,45}$/.test(v[3]))throw new Error('Code voyageur invalide, ligne '+(r+1));
    if(!['A','R'].includes(v[7]))throw new Error('Sens invalide, ligne '+(r+1));
    if(!v[4]||!v[5]||!v[6]||!v[8]||!v[9])throw new Error('Informations incomplètes, ligne '+(r+1));
    var unique=v[3]+'|'+v[7]+'|'+v[8];
    if(seen.has(unique))continue;
    seen.add(unique); rows.push(v);
  }
  if(!rows.length)throw new Error('Aucune proposition compatible avec ce dossier.');
  if(rows.length>1250)throw new Error('Trop de propositions : réduire le nombre de voyageurs.');
  return {dossier:dossier,mode:mode,event:event,rows:rows};
}

function readPropositions_(ss){
  var sheet=ss.getSheetByName('Propositions');
  if(!sheet)throw new Error('Feuille "Propositions" introuvable.');
  return parsePropositions_(sheet.getDataRange().getDisplayValues());
}

function personGroups_(input){
  var persons=new Map();
  input.rows.forEach(function(x){
    var pid=x[3],p=persons.get(pid);
    if(!p){
      p={id:pid,name:x[4]+' '+x[5],departure:x[6],questions:{A:[],R:[]}};
      persons.set(pid,p);
    }
    if(p.name!==x[4]+' '+x[5]||p.departure!==x[6])
      throw new Error('Même code pour deux voyageurs différents : '+pid);
    p.questions[x[7]].push({id:x[8],label:x[9],date:x[10]});
  });
  if(persons.size>100)throw new Error('100 voyageurs maximum.');
  return Array.from(persons.values());
}

function existingLinks_(sheet,dossier){
  var existing=new Map();
  if(sheet.getLastRow()<2)return existing;
  var values=sheet.getRange(2,1,sheet.getLastRow()-1,9).getDisplayValues();
  values.forEach(function(row){
    if(row[0]===dossier && row[7] && row[3])
      existing.set(row[3],row[7]);
  });
  return existing;
}
function addQuestion_(form,person,sens,options,dossier,indexSheet){
  if(!options.length)return;
  var title=person.name+' — '+(sens==='A'?'ALLER':'RETOUR');
  var item=form.addMultipleChoiceItem();
  item.setTitle(title).setHelpText('Départ : '+person.departure)
    .setRequired(true);
  var choices=options.map(function(x){return x.label;});
  // A unique label per option, even if two trains share the same time.
  choices.push('Aucun de ces horaires');
  item.setChoiceValues(choices);
  var questionId=String(item.getId());
  var rows=options.map(function(x){
    return [form.getId(),questionId,person.id,person.name,sens,x.label,x.id,dossier,person.departure];
  });
  rows.push([form.getId(),questionId,person.id,person.name,sens,
    'Aucun de ces horaires','NONE',dossier,person.departure]);
  rows.forEach(function(row){indexSheet.appendRow(row);});
}
function prepareForm_(ss,input,people,label,indexSheet){
  var title='Transbora · '+input.event+' · '+label;
  var form=FormApp.create(title,true);
  form.setDescription('Sélectionnez un horaire pour chaque trajet demandé. Les horaires sont théoriques : ni place ni billet réservé. Les gares, correspondances et prix sont à confirmer.');
  form.setCollectEmail(false);
  form.setConfirmationMessage('Merci ! Vos choix ont été transmis à l’organisateur. Aucun billet n’est réservé à ce stade.');
  people.forEach(function(p){
    addQuestion_(form,p,'A',p.questions.A,input.dossier,indexSheet);
    addQuestion_(form,p,'R',p.questions.R,input.dossier,indexSheet);
  });
  var folderParents=DriveApp.getFileById(ss.getId()).getParents();
  if(folderParents.hasNext()){
    DriveApp.getFileById(form.getId()).moveTo(folderParents.next());
  }
  // Single hourly sync for all forms: Google Apps Script permits only
  // 20 simultaneous triggers per user/script; no per-form trigger is created.
  return {url:form.getPublishedUrl(),edit:form.getEditUrl(),id:form.getId()};
}

/** Run from the Transbora menu of the private Google Sheet. */
function creerFormulairesTransbora(){
  var lock=LockService.getDocumentLock();
  if(!lock.tryLock(25000))throw new Error('Création déjà en cours. Réessayez plus tard.');
  try {
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var data=readPropositions_(ss);
    var people=personGroups_(data);
    PropertiesService.getScriptProperties().setProperty('TRANSBORA_SPREADSHEET_ID',ss.getId());
    var ui=SpreadsheetApp.getUi();
    var count=data.mode==='collectif'?1:people.length;
    var reply=ui.alert('Créer les formulaires ?',
      data.event+'\n'+count+' formulaire(s) Google dans votre Drive.\nSeuls les liens que vous partagez seront accessibles aux destinataires.',
      ui.ButtonSet.OK_CANCEL);
    if(reply!==ui.Button.OK)return;
    var result=createFormsForData_(ss,data);
    ss.setActiveSheet(ss.getSheetByName('Liens'));
    ui.alert('Formulaires prêts',
      result.created+' nouveau(x), '+result.reused+' déjà présent(s).\n'+
      (result.remaining?'Encore '+result.remaining+' formulaire(s) à créer : relancez le menu.\n':'')+
      'Les liens sont dans la feuille « Liens ». Partagez uniquement les URL participant.',
      ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}
function createFormsForData_(ss,data){
  var people=personGroups_(data);
  PropertiesService.getScriptProperties().setProperty('TRANSBORA_SPREADSHEET_ID',ss.getId());
  var links=ss.getSheetByName('Liens');
  var index=ss.getSheetByName('IndexQuestions');
  if(!links||!index)throw new Error('Feuilles Liens/IndexQuestions manquantes.');
  var existing=existingLinks_(links,data.dossier);
  var batches=data.mode==='collectif'?
    [{key:'TOUS',name:'Organisateur',participants:people}]:
    people.map(function(p){return {key:p.id,name:p.name,participants:[p]};});
  var pending=batches.filter(function(batch){return !existing.has(batch.key);});
  var created=0,reused=batches.length-pending.length;
  pending.slice(0,20).forEach(function(batch){
    var form=prepareForm_(ss,data,batch.participants,batch.name,index);
    links.appendRow([data.dossier,data.event,data.mode,batch.key,batch.name,
      form.url,form.edit,form.id,new Date()]);
    created++;
  });
  installerSynchronisationTransbora_();
  var all=links.getDataRange().getValues().slice(1).filter(function(row){
    return String(row[0])===data.dossier&&row[5];
  }).map(function(row){return {name:String(row[4]),url:String(row[5]),key:String(row[3])};});
  return {created:created,reused:reused,remaining:Math.max(0,pending.length-created),links:all};
}

function verifierFeuillesTransbora(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var required=['Propositions','Liens','Réponses','IndexQuestions'];
  var missing=required.filter(function(name){return !ss.getSheetByName(name);});
  if(!missing.length)PropertiesService.getScriptProperties().setProperty('TRANSBORA_SPREADSHEET_ID',ss.getId());
  SpreadsheetApp.getUi().alert(missing.length?
    'Feuilles manquantes : '+missing.join(', '):
    'Toutes les feuilles Transbora sont présentes. Copiez les propositions en Propositions!A1.');
}

/** HTML form POST from the owner's GitHub Pages site.
 * DEPLOY ONLY WITH "Execute as: Me" and "Who has access: Only myself".
 * Never allow anonymous/public access to this app: it can create Forms in Drive.
 */
function doPost(e){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))
    return HtmlService.createHtmlOutput('Transbora : une autre création est en cours. Réessayez.');
  try{
    var raw=e && e.parameter && e.parameter.payload;
    if(typeof raw!=='string'||raw.length>650000||raw.length<10)
      throw new Error('Envoi vide ou trop volumineux.');
    var payload=JSON.parse(raw);
    if(!payload||!Array.isArray(payload.headers)||!Array.isArray(payload.rows)||
       payload.rows.length<1||payload.rows.length>1250)
      throw new Error('Propositions invalides.');
    var expected=TRANSBORA.headers;
    if(expected.some(function(h,i){return h!==payload.headers[i];})||
       payload.headers.length!==expected.length)
      throw new Error('Colonnes de Transbora non reconnues.');
    var rows=[expected].concat(payload.rows.map(function(row){
      if(!Array.isArray(row)||row.length!==expected.length)throw new Error('Une ligne a un format invalide.');
      return row.map(function(cell){
        var x=String(cell==null?'':cell).trim();
        if(x.length>450||/^[=+@\-]/.test(x))
          throw new Error('Caractère dangereux dans les données du formulaire.');
        return x.replace(/[\x00-\x1f]/g,' ');
      });
    }));
    // Validate BEFORE modifying the private spreadsheet.
    var data=parsePropositions_(rows);
    if(data.rows.length!==payload.rows.length)
      throw new Error('Le lot contient plusieurs dossiers différents.');
    var sheetId=PropertiesService.getScriptProperties().getProperty('TRANSBORA_SPREADSHEET_ID');
    if(!sheetId)throw new Error('Ouvrez votre Google Sheets, puis menu Transbora → Vérifier les feuilles.');
    var ss=SpreadsheetApp.openById(sheetId);
    var proposalSheet=ss.getSheetByName('Propositions');
    if(!proposalSheet)throw new Error('Feuille Propositions introuvable.');
    proposalSheet.clearContents();
    proposalSheet.getRange(1,1,rows.length,expected.length).setValues(rows);
    var result=createFormsForData_(ss,data);
    var encode=function(x){return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');};
    var links=result.links.map(function(item){
      return '<li><a target="_blank" rel="noopener noreferrer" href="'+encode(item.url)+'">'+
         encode(item.name)+' → Choisir les trajets</a></li>';
    }).join('');
    var html='<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>Transbora · Formulaires prêts</title><style>'+
      'body{font:17px system-ui;background:#f0f8f8;color:#193f4b;margin:0;padding:18px}'+
      'main{max-width:680px;background:#fff;margin:25px auto;padding:25px;border-radius:18px}'+
      'h1{font-size:1.55rem}li{margin:15px 0}a{color:#007d84;font-weight:700;overflow-wrap:anywhere}'+
      '.btn{display:inline-block;background:#087b81;color:white;padding:13px 18px;border-radius:11px;text-decoration:none}'+
      '</style></head><body><main><h1>🚆 Vos formulaires sont prêts</h1>'+
      '<p>'+result.created+' nouveau(x), '+result.reused+' déjà enregistré(s).'+
      (result.remaining?' Encore '+result.remaining+' : relancez la création dans Transbora.':'')+'</p>'+
      '<ul>'+links+'</ul>'+
      '<p><a class="btn" href="'+encode(ss.getUrl())+'">Ouvrir mon tableau Google Sheets</a></p>'+
      '<p>Ne partagez que le lien de chaque voyageur. Aucun billet réservé.</p>'+
      '</main></body></html>';
    return HtmlService.createHtmlOutput(html).setTitle('Transbora — liens des voyageurs');
  }catch(error){
    var message=String(error.message||error).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    return HtmlService.createHtmlOutput('<h2>Création impossible</h2><p>'+message+
      '</p><p>Revenez dans Transbora et vérifiez la configuration Google.</p>');
  }finally{lock.releaseLock();}
}

/** One trigger for all events avoids Google's limit of 20 triggers per script. */
function installerSynchronisationTransbora_(){
  var handler='synchroniserReponsesTransbora';
  var present=ScriptApp.getProjectTriggers().some(function(t){
    return t.getHandlerFunction()===handler;
  });
  if(!present)ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();
}

/** Re-run from the Transbora menu to see choices immediately.
 * The hourly trigger automatically synchronizes when the menu isn't opened.
 */
function synchroniserReponsesTransbora(){
  var id=PropertiesService.getScriptProperties().getProperty('TRANSBORA_SPREADSHEET_ID');
  if(!id)throw new Error('Configurez le tableau en créant les formulaires.');
  var ss=SpreadsheetApp.openById(id);
  var links=ss.getSheetByName('Liens').getDataRange().getValues().slice(1);
  var scanned=0;
  for(var i=0;i<links.length;i++){
    var formId=String(links[i][7]||'');
    if(!formId)continue;
    var form=FormApp.openById(formId);
    var answers=form.getResponses();
    for(var j=0;j<answers.length;j++){
      onTransboraFormSubmit({source:form,response:answers[j]});
      scanned++;
    }
  }
  return scanned;
}

/** Installed FORM submission trigger; never call manually. */
function onTransboraFormSubmit(e){
  if(!e || !e.source || !e.response)throw new Error('Déclencheur Google Forms requis.');
  var lock=LockService.getDocumentLock() || LockService.getScriptLock();
  lock.waitLock(25000);
  try{
    var bookId=PropertiesService.getScriptProperties().getProperty('TRANSBORA_SPREADSHEET_ID');
    if(!bookId)throw new Error('Tableau Transbora non initialisé. Exécutez créer les formulaires.');
    var ss=SpreadsheetApp.openById(bookId);
    var links=ss.getSheetByName('Liens').getDataRange().getValues();
    var indexed=ss.getSheetByName('IndexQuestions').getDataRange().getValues();
    var out=ss.getSheetByName('Réponses');
    var formId=e.source.getId(),responseId=e.response.getId();
    var link=links.slice(1).find(function(row){return row[7]===formId;});
    if(!link)throw new Error('Formulaire inconnu : '+formId);
    if(out.getLastRow()>1){
      var seen=out.getRange(2,10,out.getLastRow()-1,1).getDisplayValues();
      if(seen.some(function(x){return x[0]===responseId;}))return;
    }
    var index=new Map();
    indexed.slice(1).forEach(function(row){
      if(row[0]!==formId)return;
      index.set(String(row[1])+'|'+row[5],row);
    });
    var when=e.response.getTimestamp()||new Date();
    e.response.getItemResponses().forEach(function(answer){
      var content=String(answer.getResponse()||'');
      var code=String(answer.getItem().getId())+'|'+content;
      var map=index.get(code);
      if(!map)throw new Error('Choix non reconnu pour le formulaire '+formId);
      var selected=String(map[6]||'');
      var status=selected==='NONE'?'À revoir':'À réserver';
      var note=selected==='NONE'?'Aucun horaire retenu':'Option '+selected;
      out.appendRow([link[0],link[1],map[3],map[8],map[4]==='A'?'Aller':'Retour',
        content,status,when,note,responseId,formId]);
    });
  } finally{lock.releaseLock();}
}
