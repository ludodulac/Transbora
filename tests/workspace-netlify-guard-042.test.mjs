import test from 'node:test';
import assert from 'node:assert/strict';
import organizerWorkspace from '../netlify/functions/transbora-workspace.mjs';

test('private workspace must never run on deploy-preview even without CONTEXT env',async()=>{
 const preview='https://deploy-preview-40--transbora-ludo.netlify.app';
 const req=new Request(preview+'/api/transbora-workspace',{method:'POST',
  headers:{'content-type':'application/json',origin:preview},
  body:JSON.stringify({action:'me'})});
 const response=await organizerWorkspace(req);
 assert.equal(response.status,403);
 assert.match((await response.json()).error,/site principal/);
});
test('private workspace refuses user-supplied unrelated public hosts',async()=>{
 const host='https://my-untrusted-preview.example';
 const req=new Request(host+'/api/transbora-workspace',{method:'POST',
  headers:{'content-type':'application/json',origin:host},
  body:JSON.stringify({action:'me'})});
 const response=await organizerWorkspace(req);
 assert.equal(response.status,403);
});
