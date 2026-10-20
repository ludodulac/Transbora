/** City-first suggestions for the shared datalist. A city value still uses
 * the existing transport engine's all-stations matching, no geocoding API.
 */
export const COMMON_CITIES=['Paris','Brest','Rennes','Nantes','Lyon','Bordeaux',
  'Toulouse','Lille','Marseille','Nice','Lorient','Quimper','Montpellier','Strasbourg',
  'Angers','Tours','Le Mans','Dijon','Grenoble','Rochefort'];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('fr-FR').trim();
export function stationSuggestions(stations,input='',maximum=45){
  const q=fold(input);
  const cities=COMMON_CITIES.filter(city=>!q||fold(city).includes(q));
  const names=(Array.isArray(stations)?stations:[]).filter(s=>typeof s==='string');
  const ranked=names.filter(s=>!q||fold(s).includes(q)).sort((a,b)=>{
    const rating=s=>{const v=fold(s);
      return v===q?0:v.startsWith(q+' ')?1:v.startsWith(q)?2:3;};
    return rating(a)-rating(b)||a.localeCompare(b,'fr-FR');
  });
  const seen=new Set(),result=[];
  for(const place of [...cities,...ranked]){
    const k=fold(place);
    if(seen.has(k))continue;
    seen.add(k);result.push({value:place,kind:cities.includes(place)?'ville':'arrêt'});
    if(result.length>=maximum)break;
  }
  return result;
}
