// Midir 46.b: saved-session-only, encounter-scoped Arcana, boss-only 30s bursts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const talents = require('../../cmd/dilmeterapi/static_data/talents.json');
const arcs = Object.values(talents.arcanas);
const sharp = arcs.find(a => a.arcana_name === 'Alchemic Sharpshooter');
const guardian = arcs.find(a => a.arcana_name === 'Sacred Guardian');
assert(sharp && guardian);
assert.equal(arcs.length, 10);
const sharpId = sharp.related_skill_ids[0], guardianId = guardian.related_skill_ids[0];
const arcanaTools = {
  getSkillArcana(id) {
    const a = arcs.find(a => a.related_skill_ids.includes(Number(id)));
    return a && { name: a.arcana_name, icon: a.icon, color: a.color };
  },
};
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }, reportDiagnostics: true });
  assert(!output.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error));
  const mod = { exports: {} };
  vm.runInNewContext(output.outputText, {
    module: mod, exports: mod.exports,
    require(dep) {
      if (dep === './arcanaEncounter') return arcanaTools;
      if (dep === './phantasmEncounter') return { findPhantasmRuns: () => [] };
      if (dep === './targetGrouping') return { getGroupMemberTargetIds: () => [] };
      if (dep.startsWith('./')) return load(dep.slice(2));
      throw new Error('Unexpected dependency ' + dep);
    }
  }, { filename: name + '.js' });
  return cache[name] = mod.exports;
}
const {
  BURST_WINDOW_MS, BURST_INDEX_VERSION, newBurstIndex, computeSessionBursts,
  rankBurstRecords, burstSessionSignature, loadBurstIndex, retainAvailableBurstSessions,
  assignedHits
} = load('burstLeaderboard');
assert.equal(BURST_WINDOW_MS, 30000);
assert.equal(BURST_INDEX_VERSION, 3);
const base = 1790000000000;
const sec = base / 1000;
const hit = (ms, damage, skillId = 1, targetId = 'boss') =>
  ({ atMs: base + ms, damage, skillId, targetId });
const use = (ms, skillId, targetId) => ({ atMs: base + ms, skillId, ...(targetId ? {targetId} : {}) });
const target = (raceId, startMs, endMs) => ({name: 'Boss',raceId,
  startTime:sec + startMs/1000,endTime:sec + endMs/1000,
  hpHistory:[{time:0, currentHp:100, maxHp:100}]});
const boss = target(7602,0,31000), secondBoss=target(7603,100180,101000);
function makeSummary(players, targets = {boss}) {
  return { startTime: sec, endTime: sec + 200, players, targets };
}
const get=(summary,id,name)=>computeSessionBursts(summary,id,name);

// The earlier 100 damage has no Arcana skill. A later skill in the SAME boss
// encounter identifies it retrospectively; adds, off-target and unrecognized
// enemies never inflate the boss-only total.
const recording1=makeSummary({a:{name:'SamplePlayerOne',damageEvents:[
  hit(0,100), hit(10000,500,sharpId), hit(29000,200), hit(30000,1000),
  hit(11000,90000,sharpId,'add'), hit(12000,80000,sharpId,'unrecognized')
] }}, {boss,add:target(7616,0,31000),unrecognized:target(999999,0,31000)});
const a=get(recording1,'s1.ndjson','First');
assert.deepEqual(JSON.parse(JSON.stringify(get({...recording1,healingIncomplete:true},'s1.ndjson','First'))),JSON.parse(JSON.stringify(a)));
assert.throws(()=>get({...recording1,liveCompact:true},'s1.ndjson','First'),/Load the saved session/);
assert.equal(a.length,1);
assert.equal(a[0].damage,1700,'30-second window includes only exact boss targets');
assert.equal(a[0].playerId,'a','indexed records retain source entity ID');
assert.equal(a[0].hits,3);
assert.equal(a[0].arcanaName,'Alchemic Sharpshooter');
assert.equal(assignedHits(recording1.players.a,recording1).find(x=>x.atMs===base).arcana,'Alchemic Sharpshooter');

// Historical shared-skill hits qualify when a *later explicit skill-use*
// identifies the player's Arcana within the same recognized boss encounter.
const lateActivation=makeSummary({a:{name:'Late Arcana',damageEvents:[
  hit(1000,410,0),hit(8000,590,1)
],skillActivations:[use(18000,sharpId)]}});
assert.equal(get(lateActivation,'use.ndjson','Later use')[0].damage,1000);

// Exact recipient IDs are mandatory. An older, unattributed event cannot be
// claimed as boss damage even when its skill clearly belongs to an Arcana.
const unattributed=makeSummary({a:{name:'No Target',damageEvents:[
  {atMs:base+1000,damage:999999,skillId:sharpId},
  hit(4000,300,sharpId)
]}});
assert.equal(get(unattributed,'missing-target.ndjson','Missing target')[0].damage,300);

// A session can have a different Arcana on a different boss; per-target
// attribution must never borrow that evidence into the earlier encounter.
const mixed=makeSummary({c:{name:' sampleplayerone ',damageEvents:[
  hit(100000,900,sharpId,'first'),hit(100100,100,0,'first'),
  hit(100200,3000,guardianId,'second'),hit(100300,200,0,'second')
]}},{first:target(7602,99900,100150),second:secondBoss});
const c=get(mixed,'s3.ndjson','Third');
assert.equal(c.length,2);
assert.equal(c.find(r=>r.arcanaName==='Alchemic Sharpshooter').damage,1000);
assert.equal(c.find(r=>r.arcanaName==='Sacred Guardian').damage,3200);

// Linked forms are eligible boss targets together; a 30s window can include
// both, without adding any incidental enemy damage.
const forms=makeSummary({d:{name:'Forms',damageEvents:[
  hit(3000,200,0,'form1'),hit(8000,500,sharpId,'form1'),
  hit(17000,700,0,'form2'),hit(19000,100000,sharpId,'add')
]}},{form1:target(7600,0,11000),form2:target(7601,15000,22000),
  add:target(7616,0,24000)});
assert.equal(get(forms,'forms.ndjson','Forms')[0].damage,1400);

// No recorded boss entity, or an encounter without Arcana evidence, is not
// eligible for the rankings even if the player's total damage is large.
assert.equal(get(makeSummary({a:{name:'No Boss',damageEvents:[hit(0,100000,sharpId,'add')]}},
  {add:target(7616,0,31000)}),'none','No boss').length,0);
assert.equal(get(makeSummary({a:{name:'No Evidence',damageEvents:[hit(0,5000)]}}),'unknown','Unknown').length,0);
const conflict=makeSummary({a:{name:'Conflicted',damageEvents:[hit(0,1000,sharpId),hit(5000,1500,guardianId)]}});
assert.equal(get(conflict,'conflict','Conflict').length,0,'conflicting Arcana evidence within one boss cannot be guessed');

// Same normalized player name gets just one leaderboard position per Arcana.
const recording2=makeSummary({b:{name:'SAMPLEPLAYERONE',damageEvents:[
  hit(60000,2200,sharpId),hit(65000,100)
]},other:{name:'Teammate',damageEvents:[hit(70000,1900,sharpId)]}},
  {boss:target(7602,59000,71000)});
const b=get(recording2,'s2.ndjson','Second');
assert.equal(b.length,2);
const index=newBurstIndex();
index.sessions['s1.ndjson']={signature:'a',records:a};
index.sessions['s2.ndjson']={signature:'b',records:b};
index.sessions['s3.ndjson']={signature:'c',records:c};
const sharpRank=rankBurstRecords(index,'Alchemic Sharpshooter');
assert.equal(sharpRank.length,2);
assert.equal(sharpRank[0].damage,2300);
assert.equal(sharpRank[0].playerName,'SAMPLEPLAYERONE');
assert.equal(sharpRank[1].playerName,'Teammate');
assert.equal(rankBurstRecords(index,'Sacred Guardian')[0].playerKey,'sampleplayerone');
assert.equal(rankBurstRecords(loadBurstIndex(JSON.stringify(index)),'Alchemic Sharpshooter').length,2);
assert.equal(loadBurstIndex('{bad').version,index.version);
assert.equal(loadBurstIndex(JSON.stringify({...index,version:1})).sessions['s1.ndjson'],undefined,
  'v46.a all-target cache must be invalidated when moving to boss-only records');
const sessionInfo={id:'s1.ndjson',startTime:100,endTime:120};
assert.equal(burstSessionSignature(sessionInfo),burstSessionSignature({...sessionInfo}));
assert.equal(burstSessionSignature({...sessionInfo,fileSize:100,modifiedMs:200}),burstSessionSignature({...sessionInfo,fileSize:100,modifiedMs:200,name:'Renamed'}));
assert.notEqual(burstSessionSignature({...sessionInfo,fileSize:100,modifiedMs:200}),burstSessionSignature({...sessionInfo,fileSize:101,modifiedMs:200}),'file size change must invalidate cache');
assert.notEqual(burstSessionSignature({...sessionInfo,fileSize:100,modifiedMs:200}),burstSessionSignature({...sessionInfo,fileSize:100,modifiedMs:201}),'file timestamp change must invalidate cache');
assert.notEqual(burstSessionSignature(sessionInfo),burstSessionSignature({...sessionInfo,endTime:150}));
assert.equal(retainAvailableBurstSessions(index,new Set(['s1.ndjson','s3.ndjson'])),1);
assert.equal(rankBurstRecords(index,'Alchemic Sharpshooter').length,1);

// Opening the UI never starts a saved-session scan or live capture work.
const ui=fs.readFileSync(path.resolve(__dirname,'../src/components/PersonalBestsView.vue'),'utf8');
assert.match(ui, /@click="scanNewSessions">Update Leaderboards/);
assert.match(ui, /v-progress-linear v-if="scanning"[^>]*:model-value="progressPercent"/);
assert.match(ui, /Processing \$\{completed\} \/ \$\{toProcess\}/);
assert.doesNotMatch(ui,/onMounted\s*\(/);
assert.match(ui,/const newSessions = available\.filter\(/);
assert.match(ui,/s\.id !== 'live-session\.ndjson'/);
assert.match(ui,/if \(scanning\.value\) return;/);
assert.match(fs.readFileSync(path.resolve(__dirname,'../src/App.vue'),'utf8'),
  /defineAsyncComponent\(\(\) => import\("@\/components\/PersonalBestsView\.vue"\)\)/);
console.log('Midir 46.b: encounter-wide Arcana evidence, exact boss-only hits, linked forms, 30s windows, username ranking, index migration and manual update passed.');
