import {getStore} from '@netlify/blobs';
import {createWorkspaceHandler} from '../../backend/workspace-core.mjs';
import {createChoiceHandler} from '../../backend/choice-core.mjs';

/** New private organizer domain: deliberately separate from public demo. */
export default async function organizerWorkspace(request){
  // Site-wide Blobs are SHARED by preview and production deploys.
  // Never allow private organizer data access from a deploy preview.
  const context=process.env.CONTEXT||globalThis.Netlify?.env?.get('CONTEXT')||'';
  // A preview runtime can omit CONTEXT: trust neither environment nor the
  // incoming Host header by itself. Only the canonical Netlify primary host
  // is allowed in this pilot, combined with a non-preview context.
  if(new URL(request.url).hostname!=='transbora-ludo.netlify.app'||
     (context&&context!=='production'))
    return new Response(JSON.stringify({error:'Disponible uniquement sur le site principal.'}),
      {status:403,headers:{'content-type':'application/json','cache-control':'no-store'}});
  const secret=globalThis.Netlify?.env?.get('TRANSBORA_WORKSPACE_SETUP_KEY')||
    process.env.TRANSBORA_WORKSPACE_SETUP_KEY||'';
  // Access the native owner-only status entirely server-side.
  // The owner capability is never returned to an organizer browser.
  const native=createChoiceHandler({
    getStore:name=>getStore({name,consistency:'strong'}),
    masterKey:()=>'',openDemo:()=>false
  });
  const nativeStatus=async(eventId,ownerKey)=>{
    const request=new Request('https://transbora-ludo.netlify.app/api/transbora',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'status',eventId,ownerKey})
    });
    const response=await native(request);
    if(!response.ok)throw Error('Réponses des voyageurs indisponibles.');
    return response.json();
  };
  const handle=createWorkspaceHandler({
    getStore:name=>getStore({name,region:'eu-central-1',consistency:'strong'}),
    masterKey:()=>secret,nativeStatus
  });
  return handle(request);
}
export const config={
  path:'/api/transbora-workspace',
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:60}
};
