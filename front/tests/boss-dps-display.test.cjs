// Damage Dealt: secondary boss DPS must remain a display-only comparison.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/utils/bossDpsDisplay.ts'), 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  reportDiagnostics: true,
});
assert(!result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error));

const groups = {
  group_gate2: ['gate2'],
  group_gate1: ['gate1first', 'gate1second'],
  group_gate3: ['gate3', 'halo80', 'halo40', 'otherAttempt'],
  group_run: ['irusan', 'glas', 'minor', 'minor'],
  group_minor: ['minor', 'halo80'],
  group_unknown: [],
};
const knownBosses = [
  {id:'gate1first',entityIds:['gate1first','gate1second']},
  {id:'gate2',entityIds:['gate2']},
  {id:'gate3',entityIds:['gate3']},
  {id:'irusan',entityIds:['irusan','glas']},
  {id:'otherAttempt',entityIds:['otherAttempt']},
];
const mod = {exports:{}};
vm.runInNewContext(result.outputText, {
  module:mod,exports:mod.exports,require(id) {
    if (id === './targetGrouping') return {
      isGroupTargetId: id => id.startsWith('group_'),
      getGroupMemberTargetIds: id => groups[id] || [],
    };
    if (id === './reportEncounters') return {findReportEncounters: () => knownBosses};
    throw new Error('Unexpected import: '+id);
  }
}, {filename:'bossDpsDisplay.js'});
const {bossIdsForDpsComparison, bossDpsForPlayerDisplay} = mod.exports;
const summary = {players:{},targets:{}};
const ids = selected => Array.from(bossIdsForDpsComparison(summary,selected));
assert.deepEqual(ids(''), [], 'full session remains primary DPS only');
assert.deepEqual(ids('gate2'), [], 'individual Gate 2 boss stays single DPS');
assert.deepEqual(ids('group_gate2'), [], 'single-member boss group stays single DPS');
assert.deepEqual(ids('group_gate1'), [], 'both Vertrag forms are boss-only');
assert.deepEqual(ids('group_gate3'), ['gate3'], 'Gate 3 boss + halos enables comparison without borrowing the later boss');
assert.deepEqual(ids('group_run'), ['irusan','glas'], 'multiple verified bosses in one run');
assert.deepEqual(ids('group_minor'), [], 'trash and mechanic groups have no boss DPS');
assert.deepEqual(ids('group_unknown'), [], 'missing evidence does not invent a boss');

const player = {damageByTarget:{gate3:{totalDamage:600000},halo80:{totalDamage:250000},halo40:{totalDamage:150000},irusan:{totalDamage:400000},glas:{totalDamage:200000},minor:{totalDamage:400000}}};
const row = {id:'p1',totalDamage:1000000,dps:20000};
const original = {...row};
assert.equal(bossDpsForPlayerDisplay(player,ids('group_gate3'),row.totalDamage,row.dps),12000);
assert.equal(bossDpsForPlayerDisplay(player,ids('group_run'),row.totalDamage,row.dps),12000);
assert.deepEqual(row,original,'secondary value must not mutate source DPS or sorting fields');
assert.equal(bossDpsForPlayerDisplay({damageByTarget:{halo80:{totalDamage:1000}}},['gate3'],1000,100),0, 'players who hit only adds show 0 boss DPS');
assert.equal(bossDpsForPlayerDisplay(player,[],1000000,20000),null);
assert.equal(bossDpsForPlayerDisplay(player,['gate3'],0,20000),null);
assert.equal(bossDpsForPlayerDisplay(player,['gate3'],1000000,0),null);
assert.equal(bossDpsForPlayerDisplay(player,['gate3'],1000,20000),null,'bad scope totals stay unreported');

const ui = fs.readFileSync(path.join(root,'src/components/applyDamageBySkill.vue'),'utf8');
assert.equal((ui.match(/bossDpsForPlayer\(item\) !== null/g)||[]).length,2,'both List and Cards use the same display guard');
assert(ui.includes('class="boss-dps-context"'));
assert(ui.includes('.sort((a, b) => b.totalDamage - a.totalDamage)'), 'existing damage sorting remains unchanged');
assert(ui.includes('background: getPlayerBarBackground(item, percentage)'), 'existing bar width uses primary damage');
console.log('Boss DPS display: 18 scoped, numeric, and presentation assertions passed');
