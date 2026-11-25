// Run with `node tests/death-scope.test.cjs` after npm dependencies are installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/utils/deathScope.ts');
const script = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(script, { module: mod, exports: mod.exports, require(id) { throw new Error(`Unexpected runtime import ${id}`); } }, { filename });
const { getDeathScopeWindow, scopedDeathTimes } = mod.exports;
const summary = {
  targets: {
    boss1: { startTime: 100, endTime: 130 },
    boss2: { startTime: 210, endTime: 240 },
    trash: { startTime: 90, endTime: 110 },
    missing: {},
    broken: { startTime: 220, endTime: 100 },
  },
  players: { a: { damageByTarget: { missing: { startTime: 300, endTime: 340 } } } },
};
const deaths = [80, 105, 125, 175, 218, 240, 300, 340, 400];
const scoped = (times, id, window) => Array.from(scopedDeathTimes(times, id, window));
const w1 = getDeathScopeWindow(summary, 'boss1', ['boss1']);
const w2 = getDeathScopeWindow(summary, 'boss2', ['boss2']);
assert.deepEqual(scoped(deaths, 'boss1', w1), [105, 125]);
assert.deepEqual(scoped(deaths, 'boss2', w2), [218, 240]);
assert.deepEqual(scoped(deaths, 'group_run_1', getDeathScopeWindow(summary, 'group_run_1', ['boss1', 'trash'])), [105, 125]);
assert.deepEqual(scoped(deaths, 'group_run_all', getDeathScopeWindow(summary, 'group_run_all', ['boss1', 'boss2'])), [105, 125, 175, 218, 240]);
assert.deepEqual(scoped(deaths, null, null), deaths);
assert.deepEqual(scoped(deaths, 'group_missing', null), []);
assert.deepEqual(scoped(deaths, 'broken', getDeathScopeWindow(summary, 'broken', ['broken'])), []);
assert.deepEqual(scoped(deaths, 'missing', getDeathScopeWindow(summary, 'missing', ['missing'])), [300, 340]);
assert.deepEqual(scoped([130, 99, 100, NaN], 'boss1', w1), [100, 130]);
console.log('Death flag scope regression passed (9 assertions)');
