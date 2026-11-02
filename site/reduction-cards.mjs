/** Verified names of French rail discount cards, subscriptions and regional rights (Nov 2026).
 * Labels only: recording ownership never implies fare eligibility or live prices.
 * Source: https://www.sncf-connect.com/catalogue/cartes-et-abonnements
 *         https://www.sncf-connect.com/aide/l-offre-pour-les-enfants-et-les-familles
 *         https://www.ter.sncf.com/bretagne/tarifs-cartes/cartes-reduction-ter-sncf
 *         https://www.ter.sncf.com/bretagne/abonnements/tous-les-abonnements/abonnements-ter/abonnement-mensuel-ter
 */
export const FRENCH_RAIL_CARDS=Object.freeze([
  {group:'SNCF · Cartes',name:'Carte Avantage Jeune'},
  {group:'SNCF · Cartes',name:'Carte Avantage Adulte'},
  {group:'SNCF · Cartes',name:'Carte Avantage Senior'},
  {group:'SNCF · Cartes',name:'Carte Liberté'},
  {group:'SNCF · Cartes',name:'Carte Familles Nombreuses'},
  {group:'SNCF · Abonnements',name:'MAX JEUNE'},
  {group:'SNCF · Abonnements',name:'MAX SENIOR'},
  {group:'SNCF · Abonnements',name:'MAX ACTIF'},
  {group:'SNCF · Abonnements',name:'MAX ACTIF+'},
  {group:'SNCF · Abonnements',name:'Pass hebdomadaire ou mensuel TGV INOUI'},
  {group:'TER BreizhGo',name:'Abonnement TER BreizhGo hebdomadaire'},
  {group:'TER BreizhGo',name:'Abonnement TER BreizhGo mensuel'},
  {group:'TER BreizhGo',name:'Abonnement TER BreizhGo annuel'},
  {group:'TER BreizhGo',name:'BreizhGo Solidaire'}
]);
export const knownRailCards=new Set(FRENCH_RAIL_CARDS.map(c=>c.name));
/** Accept existing free-text cards without deleting or inventing a classification. */
export function unpackRailCards(value){
 const entries=String(value??'').split(' | ').map(x=>x.trim()).filter(Boolean);
 const recognized=[],other=[];
 for(const name of entries){
  if(knownRailCards.has(name))recognized.push(name);
  else other.push(name);
 }
 return {known:[...new Set(recognized)],other:other.join(' | ')};
}
export function packRailCards(chosen,other=''){
 const values=[...new Set((chosen||[]).filter(x=>knownRailCards.has(x)))];
 const addition=String(other??'').trim();
 if(addition)values.push(addition);
 const text=values.join(' | ');
 if(text.length>200)throw Error('Trop de cartes : 200 caractères maximum.');
 return text;
}
