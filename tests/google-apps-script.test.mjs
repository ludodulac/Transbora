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
   return {
    getDisplayValues:()=>rows.slice(start-1,start-1+count).map(row=>row.slice(col-1,col-1+width)),
    setValues(data){
      data.forEach((entry,i)=>{
        while(rows.length<start+i)rows.push([]);
        for(let j=0;j<entry.length;j++)rows[start+i-1][col+j-1]=entry[j];
      });
    }
   };
  },
  clearContents(){rows.length=0;},
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
  getUrl:()=> 'https://docs.google.com/spreadsheets/d/private-test-sheet/edit',
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
  FormApp:{openById:(id)=>forms.find(f=>f.getId()===id),create(name){
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
  LockService:{getDocumentLock:()=>({tryLock:()=>true,waitLock:()=>{},releaseLock:()=>{}}),
    getScriptLock:()=>({tryLock:()=>true,waitLock:()=>{},releaseLock:()=>{}})},
  HtmlService:{createHtmlOutput:(html)=>({html,setTitle(title){this.title=title;return this;}})},
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


test('forms for 27 travelers are created in two resumable batches with only one trigger',()=>{
 const x=runtime();
 const template=x.sheet.Propositions.values[1];
 for(let i=2;i<=27;i++){
   const id='P-'+String(i).padStart(3,'0');
   x.sheet.Propositions.values.push([...template.slice(0,3),id,'Test',String(i),
     'Brest',...template.slice(7)]);
 }
 x.sandbox.creerFormulairesTransbora();
 assert.equal(x.forms.length,20);
 assert.equal(x.triggers.length,1);
 x.sandbox.creerFormulairesTransbora();
 assert.equal(x.forms.length,27);
 assert.equal(x.triggers.length,1);
 assert.equal(x.sheet.Liens.values.length,28);
 x.sandbox.creerFormulairesTransbora();
 assert.equal(x.forms.length,27);
});


test('one-click private web app creates Forms and returns actual participant links',()=>{
 const x=runtime();
 x.sandbox.verifierFeuillesTransbora();
 const headers=[...x.sheet.Propositions.values[0]];
 const rows=x.sheet.Propositions.values.slice(1).map(r=>[...r]);
 const result=x.sandbox.doPost({parameter:{payload:JSON.stringify({headers,rows})}});
 assert.ok(result.html.includes('Vos formulaires sont prêts'));
 assert.ok(result.html.includes('docs.google.com/forms'));
 assert.ok(result.html.includes('private-test-sheet'));
 assert.equal(x.forms.length,1);
 assert.equal(x.sheet.Liens.values.length,2);
 assert.equal(x.triggers.length,1);
 const repeated=x.sandbox.doPost({parameter:{payload:JSON.stringify({headers,rows})}});
 assert.equal(x.forms.length,1,'same event ID must never create duplicate Forms');
 assert.ok(repeated.html.includes('déjà enregistré'));
});
test('private web app rejects spreadsheet formula injection and mixed batch IDs',()=>{
 const x=runtime();
 x.sandbox.verifierFeuillesTransbora();
 const headers=[...x.sheet.Propositions.values[0]],rows=x.sheet.Propositions.values.slice(1).map(r=>[...r]);
 rows[0][4]='=HYPERLINK("evil")';
 const first=x.sandbox.doPost({parameter:{payload:JSON.stringify({headers,rows})}});
 assert.ok(first.html.includes('Création impossible'));
 assert.equal(x.forms.length,0);
 assert.equal(x.sheet.Propositions.values.length,4,'invalid request must not erase existing sheet rows');
 rows[0][4]='Sophie';rows[1][0]='EV-OTHER';
 const second=x.sandbox.doPost({parameter:{payload:JSON.stringify({headers,rows})}});
 assert.ok(second.html.includes('Création impossible'));
 assert.equal(x.forms.length,0);
});
