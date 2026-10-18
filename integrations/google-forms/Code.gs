/**
 * TRANSBORA · Google Forms dans TON Google Drive.
 *
 * Installation unique : ouvrir le Google Sheet "Transbora — Réponses de test"
 * > Extensions > Apps Script > coller ce fichier dans Code.gs > enregistrer.
 * Puis revenir au Sheet, actualiser, menu Transbora > Créer les formulaires.
 *
 * AUCUNE application Web, aucun déploiement public, aucun jeton dans GitHub.
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
    .addItem('Vérifier les feuilles','verifierFeuillesTransbora')
    .addToUi();
}

function readPropositions_(ss){
  var sheet=ss.getSheetByName('Propositions');
  if(!sheet)throw new Error('Feuille "Propositions" introuvable.');
  var values=sheet.getDataRange().getDisplayValues();
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
  // Register only after the form exists, so test responses reach the same Sheet.
  ScriptApp.newTrigger('onTransboraFormSubmit').forForm(form).onFormSubmit().create();
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
    var links=ss.getSheetByName('Liens');
    var index=ss.getSheetByName('IndexQuestions');
    if(!links||!index)throw new Error('Feuilles Liens/IndexQuestions manquantes. Ouvrez le tableau Transbora préparé.');
    var existing=existingLinks_(links,data.dossier);
    var batches=data.mode==='collectif'?
      [{key:'TOUS',name:'Organisateur',participants:people}]:
      people.map(function(p){return {key:p.id,name:p.name,participants:[p]};});
    var created=0,reused=0;
    // Apps Script may have creation quotas: resume by rerunning menu.
    batches.slice(0,20).forEach(function(batch){
      if(existing.has(batch.key)){reused++;return;}
      var form=prepareForm_(ss,data,batch.participants,batch.name,index);
      links.appendRow([data.dossier,data.event,data.mode,batch.key,batch.name,
        form.url,form.edit,form.id,new Date()]);
      created++;
    });
    ss.setActiveSheet(links);
    ui.alert('Formulaires prêts',
      created+' nouveau(x) formulaire(s), '+reused+' déjà présent(s).\n'+
      (batches.length>20?'Jusqu’à 20 voyageurs par exécution : relancez le menu pour la suite.\n':'')+
      'Les liens sont dans la feuille « Liens ». Partagez uniquement les URL participant.',
      ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}
function verifierFeuillesTransbora(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var required=['Propositions','Liens','Réponses','IndexQuestions'];
  var missing=required.filter(function(name){return !ss.getSheetByName(name);});
  SpreadsheetApp.getUi().alert(missing.length?
    'Feuilles manquantes : '+missing.join(', '):
    'Toutes les feuilles Transbora sont présentes. Copiez les propositions en Propositions!A1.');
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
