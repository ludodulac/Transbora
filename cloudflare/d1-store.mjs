/** Cloudflare D1 replacement for Netlify Blobs.
 * Provides ONLY the methods used by backend/choice-core.mjs.
 * Namespaces retain isolation between event records, share links, answers,
 * and booking confirmations. All SQL uses bound parameters.
 */
const namespaces=new Set([
  'transbora-event-records',
  'transbora-private-links',
  'transbora-choice-replies',
  'transbora-booking-states'
]);
export function createD1Stores(database){
  if(!database?.prepare)throw new Error('La base D1 TRANSBORA_DB doit être configurée.');
  return function getStore(namespace){
    if(!namespaces.has(namespace))throw new Error('Espace de stockage inconnu.');
    return {
      async get(key,{type='json'}={}){
        if(type!=='json')throw new Error('Seul le JSON est autorisé.');
        const row=await database.prepare(
          'SELECT value FROM transbora_records WHERE bucket = ? AND key = ?'
        ).bind(namespace,String(key)).first();
        return row?JSON.parse(row.value):null;
      },
      async setJSON(key,value,{onlyIfNew=false}={}){
        const payload=JSON.stringify(value),name=String(key);
        if(onlyIfNew){
          const result=await database.prepare(
            'INSERT OR IGNORE INTO transbora_records (bucket, key, value, updated_at) VALUES (?, ?, ?, ?)'
          ).bind(namespace,name,payload,Date.now()).run();
          if(result.meta?.changes===0)
            throw new Error('Identifiant déjà utilisé.');
          return {modified:true};
        }
        await database.prepare(
          'INSERT INTO transbora_records (bucket, key, value, updated_at) VALUES (?, ?, ?, ?) '+
          'ON CONFLICT(bucket, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        ).bind(namespace,name,payload,Date.now()).run();
        return {modified:true};
      },
      async delete(key){
        await database.prepare(
          'DELETE FROM transbora_records WHERE bucket = ? AND key = ?'
        ).bind(namespace,String(key)).run();
      }
    };
  };
}
