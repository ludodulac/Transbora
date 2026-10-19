import {getStore} from '@netlify/blobs';
import {createChoiceHandler} from '../../backend/choice-core.mjs';

// Only the Netlify runtime can access these stores and the admin secret.
export default async function handler(request){
  const key=globalThis.Netlify?.env?.get('TRANSBORA_MASTER_KEY') ||
    process.env.TRANSBORA_MASTER_KEY || '';
  const serve=createChoiceHandler({
    getStore:name=>getStore({name,consistency:'strong'}),
    masterKey:()=>key,
    // Transbora is currently a TEST instance: creating links is open
    // to same-origin visitors, with the Netlify rate limiter below.
    // Switch this off and add user accounts before any commercial launch.
    // IMPORTANT: do not rely on an environment variable here: the former
    // flag was not present in the deployed function, causing HTTP 403.
    openDemo:()=>true
  });
  return serve(request);
}
export const config={
  path:'/api/transbora',
  // Light throttling against accidental repeated submissions and scripted abuse.
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:80}
};
