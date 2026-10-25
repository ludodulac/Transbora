import {getStore} from '@netlify/blobs';
import {createWorkspaceHandler} from '../../backend/workspace-core.mjs';

/** New private organizer domain: deliberately separate from public demo. */
export default async function organizerWorkspace(request){
  // Site-wide Blobs are SHARED by preview and production deploys.
  // Never allow private organizer data access from a deploy preview.
  const context=process.env.CONTEXT||globalThis.Netlify?.env?.get('CONTEXT')||'production';
  if(context!=='production')
    return new Response(JSON.stringify({error:'Disponible uniquement sur le site principal.'}),
      {status:403,headers:{'content-type':'application/json','cache-control':'no-store'}});
  const secret=globalThis.Netlify?.env?.get('TRANSBORA_WORKSPACE_SETUP_KEY')||
    process.env.TRANSBORA_WORKSPACE_SETUP_KEY||'';
  const handle=createWorkspaceHandler({
    getStore:name=>getStore({name,consistency:'strong'}),
    masterKey:()=>secret
  });
  return handle(request);
}
export const config={
  path:'/api/transbora-workspace',
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:60}
};
