/** Cloudflare Pages Function: same-origin API backed by D1.
 * Compatibility date >= 2026-08-04 enables built-in node:crypto.
 * NO Netlify, no credit-based hosting, no cross-origin public API.
 */
import {createChoiceHandler} from '../../backend/choice-core.mjs';
import {createD1Stores} from '../../cloudflare/d1-store.mjs';

export async function onRequest({request,env}){
  if(!env?.TRANSBORA_DB){
    return Response.json({error:'Base de données non configurée.'},{status:503});
  }
  const getStore=createD1Stores(env.TRANSBORA_DB);
  // In this pilot, openDemo remains enabled just as on the current site:
  // no secret in the frontend; the backend requires a matching Origin.
  // Before opening to external organizations, add login/account quotas.
  const handler=createChoiceHandler({
    getStore,
    masterKey:()=>env.TRANSBORA_MASTER_KEY||'',
    openDemo:()=>true
  });
  return handler(request);
}
