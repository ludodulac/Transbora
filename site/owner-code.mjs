/** Persistent owner's activation on their own browser (prototype).
 * Never store passwords in GitHub, URLs, exports, participant drafts or logs.
 * On shared machines, use the explicit "Forget" control when finished.
 */
export const OWNER_CODE_KEY='transbora_owner_activation_v1';
export function savedOwnerCode(storage){
  try{
    const value=storage?.getItem(OWNER_CODE_KEY)||'';
    return typeof value==='string' && value.length<=160 ? value:'';
  }catch{return '';}
}
export function rememberOwnerCode(storage,code){
  if(typeof code!=='string'||!code.trim()||code.length>160)return false;
  try{storage.setItem(OWNER_CODE_KEY,code.trim());return true;}catch{return false;}
}
export function forgetOwnerCode(storage){
  try{storage.removeItem(OWNER_CODE_KEY);return true;}catch{return false;}
}
