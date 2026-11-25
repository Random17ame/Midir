// Midir 46.a: self-contained, manually requested Arcana burst comparisons.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const talents = require('../../cmd/dilmeterapi/static_data/talents.json');
const arcana = Object.values(talents.arcanas);
const sharp = arcana.find(a => a.arcana_name === 'Alchemic Sharpshooter');
const guardian = arcana.find(a => a.arcana_name === 'Sacred Guardian');
assert(sharp && guardian);
const sharpId = sharp.related_skill_ids[0], guardianId = guardian.related_skill_ids[0];
const arcanaTools = {
  getSkillArcana(id) { const a = arcana.find(a => a.related_skill_ids.includes(Number(id))); return a && { name: a.arcana_name, color: a.color, icon: a.icon }; },
  listArcanaIdentities() { return arcana.map(a => ({ name: a.arcana_name, color: a.color, icon: a.icon })); }
};
const moduleCache = {};
function load(name) {
  if (moduleCache[name]) return moduleCache[name];
  const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/' + name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }, reportDiagnostics: true });
  assert(!compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error));
  const m = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: m, exports: m.exports,
    require(dep) {
      if (dep === './arcanaEncounter') return arcanaTools;
      if (dep === './phantasmEncounter') return { findPhantasmRuns: () => [] };
      if (dep === './targetGrouping') return { getGroupMemberTargetIds: () => [] };
      if (dep === './petLabels') return { PET_DAMAGE_SKILL_ID: 9999, PET_DAMAGE_SKILL_LABEL: 'Pets' };
      if (dep === './burstLeaderboard') return load('burstLeaderboard');
      if (dep.startsWith('./')) return load(dep.slice(2));
      throw new Error('Unexpected source import: ' + dep);
    }
  }, { filename: name + '.js' });
  return moduleCache[name] = m.exports;
}
const burst = load('burstLeaderboard');
const exporter = load('burstComparisonExport');
const t = 1790000000000;
const hit = (ms, dmg, id, crit=false, targetId='boss') => ({ atMs: t+ms, damage: dmg, skillId: id, targetId, critical: crit });
const use = (ms,id) => ({ atMs:t+ms,skillId:id });
const one = { id: '123', name: 'SamplePlayerOne', damageEvents: [
  hit(100,1000,sharpId),hit(5000,500,0),hit(12000,100,sharpId,true),hit(35000,700,guardianId)
], skillActivations: [use(100,sharpId),use(110,0),use(200,sharpId),use(12050,0),use(35000,guardianId)] };
const two = { id: '567', name: 'SamplePlayerTwo', damageEvents: [hit(100,2200,sharpId),hit(14000,80,sharpId)], skillActivations:[use(100,sharpId)] };
const tsBase=t/1000;
const boss=(race,start,end)=>({name:'Boss',raceId:race,startTime:tsBase+start/1000,endTime:tsBase+end/1000,hpHistory:[{time:0,maxHp:100,currentHp:100}]});
one.damageEvents[3].targetId='boss2';
const summary={startTime:tsBase,players:{'123':one,'567':two},targets:{boss:boss(7602,0,15000),boss2:boss(7603,34000,40000)}};
const all = burst.computeSessionBursts(summary,'mix.ndjson','Mixed content');
assert.equal(all.length,3);
const rec1 = all.find(r => r.playerKey === 'sampleplayerone' && r.arcanaName === 'Alchemic Sharpshooter');
const rec2 = all.find(r => r.playerKey === 'sampleplayertwo' && r.arcanaName === 'Alchemic Sharpshooter');
assert(rec1 && rec2);
const p1 = exporter.prepareBurstComparison(rec1, summary, { [sharpId]:'Ignis Plume',[guardianId]:'Divine Retribution' }, 2);
const p2 = exporter.prepareBurstComparison(rec2, summary, { [sharpId]:'Ignis Plume' }, 1);
assert.equal(p1.damage,1600);
assert.equal(p1.sessionStartMs,t, 'comparison should preserve original session start, independent of burst time');
assert.equal(rec1.sessionStartMs,t, 'new indexes record the saved session start date');
assert.equal(rec1.playerId,'123');
const correctedName = { ...summary, players: { ...summary.players, '123': { ...one, name: 'Corrected Display Name' } } };
assert.equal(exporter.prepareBurstComparison(rec1,correctedName,{},2).damage,rec1.damage,'source player ID survives name correction');
// Indexing and export must use the identical winning hit slice, including
// linked boss forms, repeated attempts and dense/equal-timestamp damage hits.
const linkedSummary={startTime:tsBase,players:{'123':{id:'123',name:'SamplePlayerOne',damageEvents:[
  hit(1000,1300,sharpId,false,'first'),hit(1000,800,0,false,'first'),
  hit(8000,1200,0,false,'first'),hit(16500,700,0,false,'second'),
  hit(17500,1200,0,false,'second'),hit(20000,1000000,0,false,'add'),
  hit(62000,2700,sharpId,false,'third'),hit(63500,300,0,false,'third')
],skillActivations:[use(18000,sharpId),use(65000,sharpId)]}},targets:{
  first:boss(7600,0,10000),second:boss(7601,15000,25000),
  third:boss(7603,60000,68000), add:boss(7616,0,27000)
}};
const linkedRecords=burst.computeSessionBursts(linkedSummary,'linked.ndjson','Multi-encounter');
assert.equal(linkedRecords.length,1);
const linkedResult=exporter.prepareBurstComparison(linkedRecords[0],linkedSummary,{},1);
assert.equal(linkedResult.damage,linkedRecords[0].damage);
assert.equal(linkedResult.hits,linkedRecords[0].hits);
assert.equal(linkedResult.events.filter(e=>e.kind==='hit').reduce((sum,e)=>sum+(e.damage||0),0),linkedRecords[0].damage);
const winning=burst.bestPlayerBurstWindow(linkedSummary.players['123'],linkedSummary,sharp.arcana_name);
assert.equal(winning.damage,linkedResult.damage);
assert.equal(winning.damageHits.length,linkedResult.hits);
// Regression over heavy recorded hit streams (one scan, no re-bucketing).
const dense=Array.from({length:2000},(_,i)=>hit((i*53)%120000,100+i%9, i%11===0?sharpId:0));
const denseSummary={startTime:tsBase,players:{'123':{id:'123',name:'SamplePlayerOne',damageEvents:dense}},targets:{boss:boss(7602,0,125000)}};
const denseRecord=burst.computeSessionBursts(denseSummary,'dense.ndjson','Dense')[0];
assert(denseRecord);
const denseResult=exporter.prepareBurstComparison(denseRecord,denseSummary,{},1);
assert.equal(denseResult.damage,denseRecord.damage);
assert.equal(denseResult.hits,denseRecord.hits);
assert.equal(p1.hits,3);
assert.equal(p1.events.filter(e => e.kind === 'hit').length,3);
assert.equal(p1.events.filter(e => e.kind === 'use').length,4);
assert.equal(p1.skills.find(s => s.id === sharpId).damage,1100);
assert.equal(p1.skills.find(s => s.id === sharpId).observedUses,2);
assert.equal(p1.events.some(e => e.skillId === guardianId),false,'never include later Arcana switch in the comparison window');
assert.equal(p2.damage,2280);
assert.equal(p2.hits,2);
assert.equal(p2.rank,1);
assert.equal(p1.rank,2);
assert.throws(() => exporter.prepareBurstComparison({ ...rec1, damage:999999 },summary,{},1), /no longer matches/);
const restored=burst.computeSessionBursts(summary,rec1.sessionId,rec1.sessionName)
  .find(r=>r.playerId===rec1.playerId && r.arcanaName===rec1.arcanaName);
assert(restored,'targeted refresh recovers the original indexed player');
assert.equal(exporter.prepareBurstComparison(restored,summary,{},1).damage,restored.damage,
  'a refreshed record must be immediately exportable from the same saved summary');
assert.equal(exporter.BurstRecordMismatchError.name, 'BurstRecordMismatchError');
assert.throws(()=>exporter.buildBurstComparisonHTML(sharp.arcana_name,[p1,{...p1,rank:1}]),/only appear once/);
assert.throws(()=>exporter.buildBurstComparisonHTML(sharp.arcana_name,[p1,{...p2,arcanaName:guardian.arcana_name}]),/share the selected Arcana/);
const html=exporter.buildBurstComparisonHTML(sharp.arcana_name,[p2,p1]);
assert(html.startsWith('<!doctype html>'));
assert.match(html, /class="grid" id="players"/);
assert.match(html, /id="overlay-mode"/, 'allow users to overlap all 30-second burst windows');
assert.match(html, /id="side-mode"/, 'preserve side-by-side view');
assert.match(html, /id="overlay-chart"/, 'overlaid comparison needs a shared scatter');
assert.match(html, /id="clear-skill"/, 'skill selection is independently clearable');
assert.match(html, /id="clear-hit"/, 'individual hits are independently clearable');
assert.match(html, /chosen-hit/, 'single hit highlight remains on top of skill highlights');
assert.match(html, /recordedDate/, 'report shows the original saved-session date');
assert.match(html, /Observed skill use/);
assert.match(html, /pointerdown/);
assert.match(html, /touch-action:none/);
assert.match(html, /Reset zoom/);
assert(!html.includes('https://'),'self-contained HTML cannot require remote resources');
const data=html.match(/<script id="burst-data" type="application\/json">(.*?)<\/script>/s);
assert(data);
const embedded=JSON.parse(data[1]);
assert.equal(embedded.players.length,2);
assert.equal(embedded.players[0].sessionStartMs,t);
assert.equal(embedded.players[1].sessionStartMs,t);
assert.equal(embedded.players[0].events.filter(e => e.kind === 'hit').length,2);
assert.equal(embedded.players[1].events.filter(e => e.kind === 'hit').length,3);
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert(scripts.length >= 2);
new vm.Script(scripts.at(-1)[1], { filename: 'comparison-report.js' });
const evil=exporter.buildBurstComparisonHTML(sharp.arcana_name,[{...p1,name:'<script>alert(1)</script>',sessionName:'<img src=x onerror=alert(1)>'}]);
assert(!evil.includes('<script>alert(1)</script>'),'embedded JSON must escape raw HTML');
const ui=fs.readFileSync(path.resolve(__dirname,'../src/components/PersonalBestsView.vue'),'utf8');
assert.match(ui, /@click="exportComparison"/);
assert.match(ui, /formatSessionDate\(record\)/, 'leaderboard shows the saved session date');
assert.match(ui, /signature = ledger.value.sessions\[record.sessionId\]/, 'legacy caches should resolve dates without rescanning sessions');
assert.match(ui, /:model-value="isCompared\(record.playerKey\)"/);
assert.match(ui, /MAX_COMPARISON_PLAYERS = 8/);
assert.match(ui, /const summaries = new Map/);
assert.match(ui, /const uniqueIds = \[\.\.\.new Set\(records.map/);
assert.match(ui, /error instanceof BurstRecordMismatchError/);
assert.match(ui, /const updatedRecords = computeSessionBursts\(summary/);
assert.match(ui, /staleRecord = record/);
assert.match(ui, /Repeating Export will not fix it/);
assert.doesNotMatch(ui, /onMounted\s*\(/,'must not start scanning on page open');
fs.writeFileSync(path.resolve(__dirname, '../../../midir-burst-comparison-preview.html'),html);
console.log('Midir 46.a burst comparison: matching, deduped selection, explicit uses, skill-by-skill evidence, stale-cache checks, safe self-contained report, and no background fetch passed.');
