import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Netlify production function actually enables the no-code prototype',()=>{
 const deployed=readFileSync(new URL('../netlify/functions/transbora-api.mjs',import.meta.url),'utf8');
 const core=readFileSync(new URL('../backend/choice-core.mjs',import.meta.url),'utf8');
 assert.match(deployed,/openDemo:\s*\(\)\s*=>\s*true/,
  'Do not rely on an unset Netlify env flag; it caused create to return 403');
 assert.match(core,/isOpenDemo=Boolean\(openDemo\(\)/,
  'Backend still has a code-free path when enabled for test instance');
 assert.match(deployed,/rateLimit:/,'Netlify throttling remains in place');
});

test('test UI never requires users to enter an organizer code',()=>{
 const html=readFileSync(new URL('../site/events.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="native-master-key"|id="owner-code-setup"/);
 assert.match(html,/id="prepare-native-group"/);
 assert.match(html,/id="prepare-native-individual"/);
});
