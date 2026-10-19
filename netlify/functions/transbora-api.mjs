import {getStore} from '@netlify/blobs';
import {createChoiceHandler} from '../../backend/choice-core.mjs';

// Only the Netlify runtime can access these stores and the admin secret.
export default async function handler(request){
  const key=globalThis.Netlify?.env?.get('TRANSBORA_MASTER_KEY') ||
    process.env.TRANSBORA_MASTER_KEY || '';
  const serve=createChoiceHandler({
    getStore:name=>getStore({name,consistency:'strong'}),
    masterKey:()=>key
  });
  return serve(request);
}
export const config={
  path:'/api/transbora',
  // Light throttling against accidental repeated submissions and scripted abuse.
  rateLimit:{action:'rate_limit',aggregateBy:'ip',to:'/api/transbora',windowSize:60,windowLimit:80}
};
