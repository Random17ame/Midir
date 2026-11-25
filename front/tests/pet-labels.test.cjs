// Labels are display-only; the pet damage ID and generic fallback are stable.
// Run with `npm test` from front/ after dependencies are installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/utils/petLabels.ts');
const script = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(script, { module: mod, exports: mod.exports }, { filename });
const { PET_DAMAGE_SKILL_ID, PET_DAMAGE_SKILL_LABEL, PET_UNIDENTIFIED_EVENT_LABEL, petEventLabel } = mod.exports;
assert.equal(PET_DAMAGE_SKILL_ID, 9999);
assert.equal(PET_DAMAGE_SKILL_LABEL, 'Pet / Summon Effects');
assert.equal(PET_UNIDENTIFIED_EVENT_LABEL, 'Pets');
assert.equal(petEventLabel('Mir Dragon'), 'Mir Dragon');
assert.equal(petEventLabel(null), 'Pets');
assert.equal(petEventLabel(''), 'Pets');
console.log('Pet display label compatibility regression passed');
