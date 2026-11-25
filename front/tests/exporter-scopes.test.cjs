// Source-level portable-export regression, including a synthetic Gate 3 with
// confirmed kills, an unrelated Shard, and a separate later boss attempt.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, imports) {
  const full = path.join(root, 'src/utils', file);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  const m = {exports:{}};
  vm.runInNewContext(code, {module:m, exports:m.exports, require(id) {
    if (Object.hasOwn(imports,id)) return imports[id];
    throw new Error('Unexpected import ' + id + ' in ' + file);
  }}, {filename:full});
  return m.exports;
}
const grouping = load('mechanicGroups.ts', {'./gate1Encounter':{findGate1Attempts:()=>[]}});
const halo = load('gate3HaloReport.ts', {'./mechanicGroups':grouping});
const targets={};
function target(id,race,spawn,hp,zero=false) {
  targets[id]={name:race===7603?'Midir the Beloved':race===7602?'Bronntanas':'Shard of Solace',raceId:race,startTime:spawn,endTime:spawn+10,
    hpHistory:[{time:0,maxHp:hp,currentHp:hp},...(zero?[{time:4,maxHp:hp,currentHp:0}]:[])]};
}
targets['g3']={name:'Midir the Beloved',raceId:7603,startTime:1020,endTime:1110,hpHistory:[
  {time:0,maxHp:100,currentHp:100},{time:10,maxHp:100,currentHp:80},{time:30,maxHp:100,currentHp:60},
  {time:50,maxHp:100,currentHp:40},{time:80,maxHp:100,currentHp:0}]};
target('e80a',7604,1031,38300000,true);
target('e80b',7605,1031,38300000,false);
target('e80c',7606,1032,38300000,true);
target('e60a',7604,1051,63800000,true);
target('e40a',7604,1071,38300000,true);
target('e40b',7605,1071.2,38300000,true);
target('e40c',7606,1071.5,38300000,true);
target('e40d',7607,1087,38300000,true);
target('e40e',7608,1087.4,38300000,true);
target('ambient',7604,1042,23500000,true);
target('unassigned',7607,1064,38300000,true);
target('g2',7602,1150,1000000,true);
const evidenced=halo.getGate3HaloEvidence(targets,'g3');
assert.equal(evidenced.halos.filter(h=>h.phase===80).length,2);
assert.equal(evidenced.halos.filter(h=>h.phase===60).length,1);
assert.equal(evidenced.halos.filter(h=>h.phase===40).length,5);
assert.deepEqual(Array.from(evidenced.halos.filter(h=>h.phase===40).map(h=>h.round)),[1,1,1,2,2]);
assert(Array.from(evidenced.excludedShardIds).includes('ambient'));
assert(Array.from(evidenced.excludedShardIds).includes('unassigned'));
assert(!Array.from(evidenced.excludedShardIds).includes('e80b'));
assert.equal(halo.getGate3HaloEvidence(targets,'g2').halos.length,0);

// A completed 40% phase can have 5+4+3+2+1 spawns, but exactly five
// confirmed kills, one in each observed round. Neither extra spawns nor an
// unverified wipe may manufacture a defeated halo.
const secondTargets={
  secondBoss:{name:'Midir the Beloved',raceId:7603,startTime:2000,endTime:2180,hpHistory:[
    {time:0,maxHp:100,currentHp:100},{time:10,maxHp:100,currentHp:80},
    {time:30,maxHp:100,currentHp:60},{time:70,maxHp:100,currentHp:40}]}
};
let haloIndex=0;
for(const [r,count] of [5,4,3,2,1].entries()) for(let j=0;j<count;j++) {
  const id='r'+r+'-'+j,spawn=2071+r*18+j*.1;
  secondTargets[id]={name:'Shard of Solace',raceId:7604+j, startTime:spawn,endTime:spawn+10,
    hpHistory:[{time:0,maxHp:38300000,currentHp:38300000},
      ...(j===0?[{time:6,maxHp:38300000,currentHp:0}]:[])]};
  haloIndex++;
}
const fiveRounds=halo.getGate3HaloEvidence(secondTargets,'secondBoss');
assert.equal(haloIndex,15);
assert.equal(fiveRounds.halos.length,5);
assert.deepEqual(Array.from(fiveRounds.halos.map(h=>h.round)),[1,2,3,4,5]);

const scatter=load('scatterTargets.ts', {});
const names={42:'Divine Retribution'};
const arcana={
  resolvePlayerArcana:()=>({name:'Unknown',names:[],identities:[],color:'#557799'}),
  resolvePlayerArcanaForIds:()=>({name:'Unknown',names:[],identities:[],color:'#557799'}),
  resolvePlayerArcanaWindow:()=>({name:'Unknown',names:[],identities:[],color:'#557799'}),
  getSkillArcana:()=>null
};
const encounterList=[
  {id:'g3',label:'Gate 3 — Midir the Beloved · Attempt 1',entityIds:['g3'],start:20,end:110,hp:[],phases:[],clear:'observed-zero-hp'},
  {id:'g2',label:'Gate 2 — Bronntanas · Attempt 1',entityIds:['g2'],start:150,end:165,hp:[],phases:[],clear:'observed-zero-hp'}
];
const portable=load('portableReport.ts', {
  './petLabels':{PET_DAMAGE_SKILL_ID:9999,PET_DAMAGE_SKILL_LABEL:'Pets',petEventLabel:()=> 'Pets'},
  './companionExport':{buildCompanionExport:()=>({format:'midir-companion'})},
  './arcanaEncounter':arcana,
  './targetGrouping':{getGroupMemberTargetIds:()=>[]},
  './reportEncounters':{findReportEncounters:()=>encounterList},
  './enemyScatter':{identifyBossScatterSources:()=>new Map()},
  './scatterTargets':scatter,
  './gate3HaloReport':halo,
  './reportExportNaming':{getReportNaming:()=>({startTime:0,encounters:[]}),reportDownloadName:()=> 'Combat Report.html'}
});
function player(id,name,factor) {
  const individual=[['g3',1025,1000],['e40a',1075,400],['ambient',1044,800],['g2',1151,300]];
  const hits=individual.map(([targetId,t,damage])=>({atMs:t*1000,skillId:42,targetId,damage:damage*factor,critical:false}));
  const stats={};const byTarget={};
  for(const h of hits){byTarget[h.targetId]={totalDamage:h.damage,skills:{42:{totalDamage:h.damage,count:1,critCount:0,maxDamage:h.damage}}};}
  const total=hits.reduce((sum,h)=>sum+h.damage,0);
  const groups=hits.map(h=>({timestamp:h.atMs/1000-1000,totalDmg:h.damage,skills:[{skillId:42,hitCount:1,damage:h.damage,critCount:0,maxDamage:h.damage}],
    targets:[{targetId:h.targetId,skillId:42,hitCount:1,damage:h.damage,critCount:0,maxDamage:h.damage}]}));
  return {id,name,overallStats:{totalDamage:total,skills:{42:{totalDamage:total,count:4,critCount:0,maxDamage:1000*factor}}},
    damageByTarget:byTarget,skillUses:groups,damageEvents:hits,deaths:[],skillActivations:[]};
}
const summary={startTime:1000,encounterDuration:200,targets,players:{A:player('A','Alice',3),B:player('B','Bob',2),C:player('C','Carol',1)}};
const html=portable.buildPortableReportHTML(summary,'Synthetic Gate 3','all',names);
const payload=JSON.parse(html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
const minimalHtml=portable.buildPortableReportHTML({...summary,healingIncomplete:true},'Synthetic Gate 3','all',names);
assert(minimalHtml.includes('Healing Done unavailable: recording has incomplete healing data.'));
assert.equal(minimalHtml.replace('<p class="muted">Healing Done unavailable: recording has incomplete healing data.</p>',''),html,'incomplete healing changes only the report annotation');
assert.throws(()=>portable.buildPortableReportHTML({...summary,liveCompact:true},'Synthetic Gate 3','all',names),/Load the saved session/);
assert.equal(payload.views.length,5);
const boss=payload.views.find(v=>v.id==='g3:boss'),window=payload.views.find(v=>v.id==='g3:window'),gate2=payload.views.find(v=>v.id==='g2:window');
assert.equal(window.players[0].damage,(1000+400)*3,'exclude ambient from all-target damage');
assert.equal(window.players[0].bossDps,Math.round(3000/90));
assert.equal(boss.players[0].bossDps,undefined);
assert.equal(boss.players[0].damage,3000);
assert.equal(window.haloPhases[2].halos.length,5);
assert.equal(gate2.haloPhases,undefined);
assert.equal(window.players[0].skills[0].hitCount,2);
assert.deepEqual(Array.from(window.players[0].skills[0].topHits),[3000,1200]);
assert.equal(window.players[0].skills[0].lowestHit,1200);
assert.equal(window.players[0].skills[0].averageHit,2100,'average uses the exact in-scope individual hit evidence');
assert.deepEqual(Array.from(window.players[0].skills[0].topHitEventIndices),[0,1]);
assert.equal(window.players[0].skills[0].lowestHitEventIndex,1);
assert.equal(boss.players[0].skills[0].hitCount,1);
assert.equal(payload.damageHitEvents.length,12,'raw Companion evidence remains unfiltered');
assert.deepEqual(Array.from(payload.damageHitEvents.filter(h=>h.playerId==='A').map(h=>h.eventIndex).sort((a,b)=>a-b)),[0,1,2,3],
  'precise hit references retain original per-player event indexes');
assert(html.includes('data-restore='));
assert(html.includes('halo-mini'), 'halo contributions remain visible beside markers');
assert(html.includes('.halo-mini.above{'), 'top halo tags have their own positioning class');
assert(!html.includes('.halo-mini.top'), 'halo tags must not inherit the totals grid layout');
assert(html.includes("y<22?'above'"), 'top markers use the dedicated halo class');
assert(html.includes('data-detail-title'), 'custom dark-themed skill and halo tooltips are enabled');
assert(!html.includes('>BOSS</span>'), 'halo arena center is unlabeled');
assert(!html.includes('confirmed defeats'), 'remove redundant confirmation copy');
assert(html.includes('beginPinch'), 'enable two-finger touch zoom');
assert(html.includes('closestMarker'), 'enable tap-to-inspect scatter points');
assert(html.includes('Highest hits'));
assert(html.includes('Total hits'));
assert(html.includes('Average'), 'highest-hit tooltip includes the observed average above lowest');
assert(html.includes('data-pick-index'), 'individual top/lowest values offer exact-hit selection');
assert(html.includes('skill-hit-cloud'), 'selected skill can reveal every precisely recorded hit on scatter');
assert(html.includes('selected-hit-guide'), 'selected precise hit has a secondary highlight');
assert(html.includes('data-skill-row'), 'whole skill rows must be mouse/touch targets');
assert(html.includes('skill-hit-clear'), 'single hit selection is independently clearable');
assert(html.includes('skill-highlight-clear'), 'skill-wide selection is independently clearable');
assert(html.includes('if(eventIndex===null)'), 'choosing a specific hit must not overwrite skill selection');
assert(html.includes('excludedTargetIds'), 'excluded Gate 3 Shards stay excluded from highlighted hit scopes');
// Equal hit amounts must still refer to distinct, separately selectable raw events.
const duplicateSummary=structuredClone(summary);
duplicateSummary.players.A.damageEvents.push({...duplicateSummary.players.A.damageEvents[0],atMs:1025100});
const duplicatePayload=JSON.parse(portable.buildPortableReportHTML(duplicateSummary,'Duplicate hits','all',names)
  .match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
const duplicateSkills=duplicatePayload.views.find(v=>v.id==='g3:boss').players.find(p=>p.id==='A').skills[0];
assert.deepEqual(duplicateSkills.topHits.slice(0,2),[3000,3000]);
assert.deepEqual(duplicateSkills.topHitEventIndices.slice(0,2),[0,4]);
// Historical recordings without exact hit evidence retain the click-to-highlight
// grouped scatter fallback, but do not invent top, average or lowest hits.
const sparseSummary=structuredClone(summary);
for(const p of Object.values(sparseSummary.players)) p.damageEvents=[];
const sparseHtml=portable.buildPortableReportHTML(sparseSummary,'Older session','all',names);
const sparsePayload=JSON.parse(sparseHtml.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]);
assert.equal(sparsePayload.views[0].players[0].skills[0].averageHit,null);
assert.equal(sparsePayload.views[0].players[0].skills[0].topHits.length,0);
assert(sparseHtml.includes('skill-scatter-bucket'), 'use available aggregate scatter evidence when exact hit events are absent');
const inlineScript=html.match(/<script>\s*([\s\S]*?)<\/script><\/body>/)[1];
new vm.Script(inlineScript,{filename:'portable-report-inline.js'});
// A browser can exercise the same generated report without requiring game logs.
if (process.env.MIDIR_EXPORTER_PREVIEW) fs.writeFileSync(process.env.MIDIR_EXPORTER_PREVIEW,html);
console.log('Gate 3 evidence, target exclusions, skill hover, dual DPS, and portable report assertions passed');
