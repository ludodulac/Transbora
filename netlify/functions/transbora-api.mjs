import {getStore} from '@netlify/blobs';
import {createChoiceHandler} from '../../backend/choice-core.mjs';
import {syncNativeWorkspaceEvent} from '../../backend/workspace-native-sync.mjs';

// Only the Netlify runtime can access these stores and the admin secret.
export default async function handler(request){
  const key=globalThis.Netlify?.env?.get('TRANSBORA_MASTER_KEY') ||
    process.env.TRANSBORA_MASTER_KEY || '';
  const nativeStores=name=>getStore({name,consistency:'strong'});
  const isCanonical=new URL(request.url).hostname==='transbora-ludo.netlify.app';
  const context=process.env.CONTEXT||globalThis.Netlify?.env?.get('CONTEXT')||'';
  const serve=createChoiceHandler({
    getStore:nativeStores,
    masterKey:()=>key,
    onAnswerSaved:async nativeEventId=>{
      // Netlify previews share the backing Blobs: previews must NEVER update
      // a production organizer's private records.
      if(!isCanonical||(context&&context!=='production'))return;
      const store=getStore({name:'transbora-organizer-private-v1',
        region:'eu-central-1',consistency:'strong'});
      const nativeStatus=async(eventId,ownerKey)=>{
        const statusRequest=new Request('https://transbora-ludo.netlify.app/api/transbora',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({action:'status',eventId,ownerKey})
        });
        const response=await serve(statusRequest);
        if(!response.ok)throw Error('Native status unavailable');
        return response.json();
      };
      await syncNativeWorkspaceEvent({store,nativeEventId,nativeStatus});
    },
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
