import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../integrations/google-forms/Code.gs',import.meta.url),'utf8');
function testSheet(matrix) {
 const rows=matrix.map(r=>r.slice());
 return {
  getDataRange(){return {getDisplayValues:()=>rows,getValues:()=>rows};},
  getLastRow(){return rows.length;},
  getRange(start,col,count,width){
   return {getDisplayValues:()=>rows.slice(start-1,start-1+count).map(row=>row.slice(col-1,col-1+width))};
  },
  appendRow(row){rows.push(row.slice());},
  values:rows
 };
}
function runtime(){
 const headers=['Dossier ID','Événement','Mode','Voyageur ID','Prénom','Nom','Ville de départ','Sens','Option ID','Proposition','Date'];
 const tsv=[
  headers,
  ['EV-TEST-001','Festival test','individuel','P-001','Sophie','Martin','Brest','A','train-1','1. 08:00 vers 12:00','2026-11-25'],
  ['EV-TEST-001','Festival test','individuel','P-001','Sophie','Martin','Brest','A','train-2','2. 09:00 vers 13:00','2026-11-25'],
  ['EV-TEST-001','Festival test','individuel','P-001','Sophie','Martin','Brest','R','NONE','Aucun horaire trouvé','2026-11-26']
 ];
 const sheet={
  Propositions:testSheet(tsv),
  Liens:testSheet([['Dossier ID','Événement','Mode','Voyageur ID','Voyageur','URL participant','URL édition','ID formulaire','Créé le']]),
  IndexQuestions:testSheet([['ID formulaire','ID question','Voyageur ID','Voyageur','Sens','Choix affiché','Option ID','Dossier ID','Ville de départ']]),
  Réponses:testSheet([['ID événement','Événement','Voyageur','Départ','Aller / retour','Choix du trajet','Statut','Date réponse','Note','ID réponse','ID formulaire']])
 };
 const spreadsheet={
  getId:()=> 'private-test-sheet',
  getSheetByName:(name)=>sheet[name],
  setActiveSheet:()=>{}
 };
 const forms=[],triggers=[];
 const ui={Button:{OK:'OK'},ButtonSet:{OK_CANCEL:'OK_CANCEL',OK:'OK'},
  alert:(...args)=>args.length>1?'OK':undefined,
  createMenu:()=>({addItem(){return this;},addToUi(){}})};
 const properties={};
 const sandbox={
  SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,openById:()=>spreadsheet,getUi:()=>ui},
  PropertiesService:{getScriptProperties:()=>({setProperty:(k,v)=>properties[k]=v,getProperty:k=>properties[k]})},
  DriveApp:{getFileById:()=>({getParents:()=>({hasNext:()=>false})})},
  FormApp:{openById:(id)=>forms.find(f=>f.getId()===id),create(name)=>{
   const id='form-'+(forms.length+1);
   const form={name,getId:()=>id,getPublishedUrl:()=>'https://docs.google.com/forms/d/e/'+id+'/viewform',
     getEditUrl:()=>'https://docs.google.com/forms/d/'+id+'/edit',
     responses:[],getResponses(){return this.responses;},
     setDescription:()=>{},setCollectEmail:()=>{},setConfirmationMessage:()=>{},
     addMultipleChoiceItem(){
      const q={id:String(forms.length*100+Math.random()),title:'',choices:[],
       getId(){return this.id;},setTitle(x){this.title=x;return this;},
       setHelpText(){return this;},setRequired(){return this;},
       setChoiceValues(arr){this.choices=arr;return this;}};
      (form.questions||=[]).push(q);return q;
     }};
   forms.push(form);return form;
  }},
  ScriptApp:{getProjectTriggers:()=>triggers.map(t=>({getHandlerFunction:()=>t})),
    newTrigger:(name)=>({timeBased(){return this;},everyHours(){return this;},
      create(){triggers.push(name)}})},
  LockService:{getDocumentLock:()=>({tryLock:()=>true,waitLock:()=>{},releaseLock:()=>{}})},
  Date,Map,Set,String,Array,console
 };
 vm.runInNewContext(source,sandbox,{filename:'Code.gs'});
 return {sandbox,forms,triggers,sheet,properties};
}
test('bound Google Sheets script parses rows, creates a form, and links the response sheet',()=>{
 const x=runtime();
 x.sandbox.onOpen();
 x.sandbox.verifierFeuillesTransbora();
 x.sandbox.creerFormulairesTransbora();
 assert.equal(x.forms.length,1);
 assert.equal(x.forms[0].questions.length,2);
 assert.equal(x.forms[0].questions[0].choices.length,3);
 assert.equal(x.forms[0].questions[1].choices.length,2);
 assert.equal(x.sheet.Liens.values.length,2);
 assert.equal(x.sheet.IndexQuestions.values.length,6);
 assert.equal(x.properties.TRANSBORA_SPREADSHEET_ID,'private-test-sheet');
 assert.equal(x.triggers.length,1);
 assert.equal(x.triggers[0],'synchroniserReponsesTransbora');
 // Re-run is idempotent and reuses the original Form URL.
 x.sandbox.creerFormulairesTransbora();
 assert.equal(x.forms.length,1);
});
test('Form responses are appended automatically with no manual Excel upload',()=>{
 const x=runtime();
 x.sandbox.creerFormulairesTransbora();
 const q=x.forms[0].questions[0];
 const response={getId:()=> 'response-123', getTimestamp:()=>new Date('2026-11-20T10:00:00Z'),
  getItemResponses:()=>[{getResponse:()=>q.choices[0],
    getItem:()=>({getId:()=>q.getId()})}]};
 x.forms[0].responses.push(response);
 x.sandbox.synchroniserReponsesTransbora();
 assert.equal(x.sheet.Réponses.values.length,2);
 assert.equal(x.sheet.Réponses.values[1][2],'Sophie Martin');
 assert.equal(x.sheet.Réponses.values[1][4],'Aller');
 assert.equal(x.sheet.Réponses.values[1][6],'À réserver');
 x.sandbox.synchroniserReponsesTransbora();
 assert.equal(x.sheet.Réponses.values.length,2);
});
