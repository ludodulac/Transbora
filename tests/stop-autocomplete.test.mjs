import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateStopName} from '../site/events-model.mjs';

test('corrects exact doubled station names from mobile autocomplete',()=>{
 assert.equal(deduplicateStopName('Villefranche-de-RouergueVillefranche-de-Rouergue'),
   'Villefranche-de-Rouergue');
 assert.equal(deduplicateStopName('ParisParis'),'Paris');
 assert.equal(deduplicateStopName('villefranche-de-rouergueVillefranche-de-Rouergue'),
   'villefranche-de-rouergue');
});
test('does not alter genuine station names or unrelated text',()=>{
 assert.equal(deduplicateStopName('Paris Montparnasse Hall 2'),'Paris Montparnasse Hall 2');
 assert.equal(deduplicateStopName('Villefranche-de-Rouergue'),'Villefranche-de-Rouergue');
 assert.equal(deduplicateStopName('Chambéry - Challes-les-Eaux'),'Chambéry - Challes-les-Eaux');
});
