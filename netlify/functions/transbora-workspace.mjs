import {getStore} from '@netlify/blobs';
import {createWorkspaceHandler} from '../../backend/workspace-core.mjs';

/** New private organizer domain: deliberately separate from public demo. */
export default async function organizerWorkspace(request){
  const secret=globalThis.Netlify?.env?.get('TRANSBORA_MASTER_KEY')||
    process.env.TRANSBORA_MASTER_KEY||'';
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
