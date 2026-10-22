/** Practical short-list for the artist: do not pad five slots with journeys
 * vastly longer than the best available option. Preserve the fastest arrival
 * on returns, and at least one meaningful alternate transport mode.
 * Ranking uses only published schedules: never infer seat availability.
 */
import {parisInstant} from './time-zones.mjs';
const duration=j=>Math.max(0,j.arrival-j.departure);
const moment=(j,field)=>+parisInstant(j.date,j[field]);
function mode(j){
 const legs=j.legs?.length?j.legs:[j];
 const modes=new Set(legs.map(l=>l.mode));
 return modes.size>1?'mixed':modes.has('bus')?'bus':'rail';
}
export function curateJourneys(input,kind){
 if(!Array.isArray(input)||input.length<3)return input||[];
 const candidates=[...input];
 const quickest=Math.min(...candidates.map(duration));
 // A factor AND a minimum absolute time gap avoid removing normal variety
 // on 2-4h trips while filtering extreme 20h detours on 13h alternatives.
 const threshold=Math.max(quickest*1.5,quickest+6*3600);
 const reasonable=candidates.filter(j=>duration(j)<=threshold);
 const modes=new Set(reasonable.map(mode));
 const chosen=new Set(reasonable);
 // Always retain the first ranked return: earliest actual arrival at home.
 if(kind==='R')chosen.add(candidates[0]);
 // Keep at most ONE long alternative in each otherwise missing transport mode.
 // Example: one 13h train + one overnight coach, rather than four coaches.
 for(const kindOfTransport of new Set(candidates.map(mode))){
   if(modes.has(kindOfTransport))continue;
   const best=candidates.filter(j=>mode(j)===kindOfTransport)
     .sort((a,b)=>duration(a)-duration(b))[0];
   if(best)chosen.add(best);
 }
 let output=candidates.filter(j=>chosen.has(j));
 if(kind==='R'&&output.length>=2){
   const earliest=output[0],at=moment(earliest,'arrival');
   const d0=duration(earliest);
   const practical=output.slice(1).filter(j=>
     moment(j,'arrival')-at<=4*3600*1000 && d0-duration(j)>=2*3600)
     .sort((a,b)=>duration(a)-duration(b))[0];
   if(practical){
     output=[earliest,{...practical,efficientAlternative:true},
       ...output.slice(1).filter(j=>j!==practical)];
   }
 }
 return output;
}
