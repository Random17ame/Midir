// Exercise the production report, recognition, Companion and ZIP code together.
// Optional MIDIR_BUNDLE_FIXTURES writes the same test archives for importer QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash, webcrypto} = require('node:crypto');
const ts = require('typescript');
const {inflateRawSync} = require('node:zlib');
const root = path.resolve(__dirname, '..');
const talents = require('../../cmd/dilmeterapi/static_data/talents.json');
const cache = new Map();
function load(name, sourceRoot=root, useCrypto=true, compression=CompressionStream) {
  const key=sourceRoot+":"+name+":"+useCrypto+":"+(compression?compression.name:"none");
  if (cache.has(key)) return cache.get(key).exports;
  const m = {exports:{}}; cache.set(key,m);
  const filename = path.join(sourceRoot,'src/utils',name+'.ts');
  const transpiled = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert(!transpiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));
  vm.runInNewContext(transpiled.outputText,{module:m,exports:m.exports,TextEncoder,Blob,Response,CompressionStream:compression,crypto:useCrypto?webcrypto:undefined,require(dep){
    if (dep.endsWith('/talents.json?raw')) return JSON.stringify(talents);
    if (dep==='@/util') return {getClassColor:(_name,color)=>color||'hsl(0, 0%, 50%)'};
    if (dep.startsWith('./')) return load(dep.slice(2),sourceRoot,useCrypto,compression);
    throw new Error('Unexpected dependency: '+dep);
  }},{filename});
  return m.exports;
}
const {buildPortableReportPayload,buildPortableReportHTML} = load('portableReport');
const {prepareBundleReport,makeSessionBundle} = load('sessionBundle');
const {makeReportZip} = load('batchZip');
const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
const extract = html=>html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1];
const id = n=>'recording-'+n.toString(16).padStart(32,'0');
const start=1795471200;
const playerId='90071992547409931', targetId='90071992547409939';
const sharp=Object.values(talents.arcanas).find(a=>a.arcana_name==='Alchemic Sharpshooter');
const guardian=Object.values(talents.arcanas).find(a=>a.arcana_name==='Sacred Guardian');
const skills=[sharp.related_skill_ids[0],guardian.related_skill_ids[0]];
const names={[skills[0]]:'Fixture Sharpshooter skill',[skills[1]]:'Fixture Guardian skill'};
function summary(recordingId, n=12, arcanaIndex=0, historical=false) {
  const skillId=skills[arcanaIndex], duration=90;
  const hitList=Array.from({length:n},(_,i)=>({atMs:start*1000+1000+i*10,skillId,targetId,damage:100+i%17,critical:i%3===0,delayed:i%7===0}));
  const total=hitList.reduce((s,h)=>s+h.damage,0), critCount=hitList.filter(h=>h.critical).length;
  const stats={totalDamage:total,count:n,critCount,maxDamage:Math.max(...hitList.map(h=>h.damage)),totalDamageCrit:hitList.filter(h=>h.critical).reduce((s,h)=>s+h.damage,0),totalDamageNonCrit:hitList.filter(h=>!h.critical).reduce((s,h)=>s+h.damage,0)};
  const buckets=new Map();
  for(const h of hitList){const t=Math.floor((h.atMs-start*1000)/1000);let b=buckets.get(t);if(!b)buckets.set(t,b={timestamp:t,totalDmg:0,skills:[{skillId,damage:0,hitCount:0,critCount:0,maxDamage:0}]});const sk=b.skills[0];b.totalDmg+=h.damage;sk.damage+=h.damage;sk.hitCount++;sk.critCount+=Number(h.critical);sk.maxDamage=Math.max(sk.maxDamage,h.damage);}
  const skillUses=[...buckets.values()].map(b=>({...b,...(!historical?{targets:[{targetId,...b.skills[0]}]}:{})}));
  return {recordingId,startTime:start,endTime:start+duration,encounterDuration:duration,totalDamage:total,damageTaken:{},
    healingIncomplete:arcanaIndex===1,targets:{[targetId]:{name:'Bronntanas',raceId:7602,startTime:start,endTime:start+duration,seenAppear:true,seenDead:true,hpHistory:[{time:0,maxHp:total,currentHp:total},{time:90,maxHp:total,currentHp:0}]}},
    players:{[playerId]:{id:playerId,name:arcanaIndex?'Étoile 별':'例示玩家 Ω',overallStats:{totalDamage:total,skills:{[skillId]:stats},conditions:{}},damageByTarget:{[targetId]:{totalDamage:total,skills:{[skillId]:stats}}},overallHealing:{totalDamage:0,skills:{}},healingByTarget:{},skillUses,damageEvents:historical?[]:hitList,
      skillActivations:historical?[]:[{atMs:start*1000-500,skillId,targetId},{atMs:start*1000+1250,skillId,targetId}],skillObservations:historical?[]:[{atMs:start*1000+1260,opcode:0x7926,skillId,actorVerified:true,fields:['test'],fieldTypes:[2]}],deaths:[],revives:[start+3]}}};
}
// Legacy ID fixture uses the documented original-event-line hash. These are
// synthetic NDJSON test events, not a captured gameplay recording.
const legacyEvents=[JSON.stringify({EventId:3,At:start,Id:playerId,TargetId:targetId,SkillId:skills[0],Damage:100})+'\n',JSON.stringify({EventId:3,At:start+90,Id:playerId,TargetId:targetId,SkillId:skills[0],Damage:100})+'\n'].join('');
const legacyId='legacy-sha256-'+sha(legacyEvents);
const A=summary(id(1)),B=summary(id(2),14,1),C=summary(legacyId,2,0,true), title='Bri Gate 2 — 例示';
const entry=(s,storageId='session-123.ndjson',name=title,scope='all')=>prepareBundleReport(s,name,storageId,scope,names);
const a=entry(A), b=entry(B), c=entry(C,'2026-01-01_20-00-00_Historical.ndjson','Historical summary');
const fixed='2026-12-01T00:00:00.000Z';
const fixtureDir=process.env.MIDIR_BUNDLE_FIXTURES;
if(fixtureDir) fs.mkdirSync(fixtureDir,{recursive:true});
// Independent ZIP directory reader; validates central/local path, size, method,
// UTF-8 flag, and exact bytes. External Python zipfile also verifies CRC in QA.
function readZip(bytes){
  const end=bytes.length-22;assert.equal(bytes.readUInt32LE(end),0x06054b50);
  const count=bytes.readUInt16LE(end+10),dir=bytes.readUInt32LE(end+16);
  assert.equal(bytes.readUInt32LE(end+12),end-dir);
  let at=dir; const files=new Map();
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(at),0x02014b50);
    assert.equal(bytes.readUInt16LE(at+8),0x800);const method=bytes.readUInt16LE(at+10);assert([0,8].includes(method));
    const size=bytes.readUInt32LE(at+24),compressedSize=bytes.readUInt32LE(at+20),n=bytes.readUInt16LE(at+28),offset=bytes.readUInt32LE(at+42);
    const name=bytes.subarray(at+46,at+46+n).toString('utf8');assert(!files.has(name));
    assert.equal(bytes.readUInt32LE(offset),0x04034b50);assert.equal(bytes.readUInt16LE(offset+6),0x800);
    assert.equal(bytes.readUInt16LE(offset+8),method);assert.equal(bytes.readUInt32LE(offset+18),compressedSize);assert.equal(bytes.readUInt32LE(offset+22),size);assert.equal(bytes.readUInt32LE(offset+14),bytes.readUInt32LE(at+16));
    const nl=bytes.readUInt16LE(offset+26);assert.equal(bytes.subarray(offset+30,offset+30+nl).toString('utf8'),name);
    const dataStart=offset+30+nl+bytes.readUInt16LE(offset+28);assert(dataStart+compressedSize<=dir);
    const stored=bytes.subarray(dataStart,dataStart+compressedSize);const data=method===8?inflateRawSync(stored):stored;assert.equal(data.length,size);files.set(name,data);at+=46+n+bytes.readUInt16LE(at+30)+bytes.readUInt16LE(at+32);
  }
  assert.equal(at,end);return files;
}
async function bundle(items,filename,createdAt=fixed){
  const result=await makeSessionBundle(items,createdAt), bytes=Buffer.from(await result.blob.arrayBuffer());
  const files=readZip(bytes),manifest=JSON.parse(files.get('manifest.json'));
  assert.equal(manifest.format,'midir-session-bundle');assert.equal(manifest.schemaVersion,1);assert.equal(manifest.exporterVersion,'49.a');
  assert.equal(manifest.createdAt,createdAt);assert.equal(manifest.sessionCount,items.length);assert.equal(files.size,items.length+1);
  assert.equal(manifest.sessions.length,items.length);
  const seen=new Set();
  for(const [i,e] of manifest.sessions.entries()){
    assert(!seen.has(e.path.normalize('NFC').toLowerCase()));seen.add(e.path.normalize('NFC').toLowerCase());
    assert(!e.path.includes('\\'));assert(files.has(e.path));
    const file=files.get(e.path),payload=extract(file.toString());
    assert.equal(e.payloadFormat,'html-report');
    assert.equal(e.payloadSha256,sha(payload));assert.equal(e.fileSha256,sha(file));assert.equal(payload,items[i].payload);
    const p=JSON.parse(payload);assert.equal(e.id,p.exportMetadata.id);assert.equal(e.id,items[i].metadata.id);assert.equal(e.startAt,p.exportMetadata.startAt);assert.equal(e.endAt,p.exportMetadata.endAt);
    assert.deepEqual(e.scope,p.exportMetadata.scope);assert.equal(e.healingIncomplete,p.exportMetadata.healingIncomplete);
    assert.equal(e.dataSchemaVersion,p.companion.version);assert.equal(e.dataSchemas.skillUse,p.skillUseSchemaVersion);assert.equal(e.dataSchemas.skillObservation,p.skillObservationSchemaVersion);assert.equal(e.dataSchemas.damageHit,p.damageHitSchemaVersion);assert.equal(e.dataSchemas.encounter,p.encounterSchemaVersion);
  }
  if(fixtureDir&&filename)fs.writeFileSync(path.join(fixtureDir,filename),bytes);
  return {manifest,files,size:bytes.length,bytes};
}
async function main(){
  // Identical names and start times must not collapse distinct IDs; Unicode
  // names, 64-bit entity IDs, raw observation/activation and hit streams persist.
  const p=JSON.parse(a.payload);assert.equal(p.companion.format,'midir-companion');assert.equal(p.companion.version,1);
  assert.equal(p.companion.players[0].entityId,playerId);assert.equal(p.companion.players[0].arcana,sharp.arcana_name);
  assert.equal(JSON.parse(b.payload).companion.players[0].arcana,guardian.arcana_name);
  assert.equal(p.damageHitEvents.length,12);assert.equal(p.skillUseEvents.length,2);assert.equal(p.skillObservations.length,1);assert.equal(p.skillUseEvents[0].relativeMs,-500);assert.equal(p.encounters.length,1);
  assert.equal(JSON.parse(c.payload).damageHitEvents.length,0);assert.equal(JSON.parse(c.payload).skillUseEvents.length,0);
  assert.equal(JSON.parse(c.payload).skillObservations.length,0);
  assert.equal(JSON.parse(extract(buildPortableReportHTML(A,title,'all',names))).exportMetadata.id,id(1));
  assert.equal(extract(buildPortableReportHTML(A,title,'all',names)),a.payload);
  assert.equal(buildPortableReportPayload(A,title,'all',names),a.payload);
  assert.equal(entry(A,'renamed.ndjson','Renamed recording').metadata.id,a.metadata.id);
  assert.notEqual(entry(A,'renamed.ndjson','Renamed recording').payload,a.payload);
  assert.notEqual(a.metadata.id,b.metadata.id);
  const single=await bundle([a],'single.zip');
  const multi=await bundle([a,b,c],'standard.zip');
  const store=Buffer.from(await (await makeReportZip([...multi.files].map(([name,html])=>({name,html:html.toString()})),false)).arrayBuffer());
  assert(multi.size<store.length);
  assert.deepEqual(readZip(store),multi.files);
  assert.equal(single.files.get(single.manifest.sessions[0].path).toString(),buildPortableReportHTML(A,title,'all',names));
  const fallback=load('sessionBundle',root,true,null);
  const fallbackZip=await fallback.makeSessionBundle([a,b,c],fixed);
  assert.deepEqual(readZip(Buffer.from(await fallbackZip.blob.arrayBuffer())),multi.files);
  if(fixtureDir)fs.writeFileSync(path.join(fixtureDir,'store.zip'),store);
  // Explicit unsupported raw DEFLATE constructor and non-beneficial compression fall back to STORE.
  class Unsupported {constructor(){throw new TypeError('unsupported');}}
  const fallbackWriter=load('batchZip',root,true,Unsupported);
  const small=Buffer.from(await (await fallbackWriter.makeReportZip([{name:'tiny.html',html:'x'}])).arrayBuffer());
  assert.equal(small.readUInt16LE(8),0);
  const tiny=Buffer.from(await (await makeReportZip([{name:'tiny.html',html:'x'}])).arrayBuffer());assert.equal(tiny.readUInt16LE(8),0);
  assert.equal(multi.bytes.readUInt16LE(8),8);
  assert.equal(single.manifest.sessions[0].payloadSha256,multi.manifest.sessions[0].payloadSha256);
  const overlapA=await bundle([a,b],'overlap-a.zip');
  const overlapB=await bundle([b,c],'overlap-b.zip','2026-12-02T00:00:00.000Z');
  assert.equal(overlapA.manifest.sessions[1].id,overlapB.manifest.sessions[0].id);
  assert.equal(overlapA.manifest.sessions[1].payloadSha256,overlapB.manifest.sessions[0].payloadSha256);
  assert.equal(new Set([...overlapA.manifest.sessions,...overlapB.manifest.sessions].map(e=>e.id)).size,3);
  const partial=entry(A,'session-123.ndjson',title,playerId);
  const filtered=await bundle([partial],'one-player.zip');
  assert.equal(filtered.manifest.sessions[0].id,id(1));assert.equal(filtered.manifest.sessions[0].scope.playerId,playerId);
  assert.notEqual(filtered.manifest.sessions[0].payloadSha256,single.manifest.sessions[0].payloadSha256);
  const targetPayload=JSON.parse(extract(buildPortableReportHTML(A,title,'all',names,targetId)));
  assert.equal(targetPayload.exportMetadata.id,id(1));assert.equal(targetPayload.exportMetadata.scope.targetId,targetId);
  const revised=structuredClone(A);revised.players[playerId].damageEvents[0].critical=!revised.players[playerId].damageEvents[0].critical;
  const revision=await bundle([entry(revised)]);assert.equal(revision.manifest.sessions[0].id,id(1));assert.notEqual(revision.manifest.sessions[0].payloadSha256,single.manifest.sessions[0].payloadSha256);
  const oldHtml=buildPortableReportHTML({...C,recordingId:undefined},'Historical summary','all',names);
  if(process.env.MIDIR_BASELINE_FRONT){
    const baseline=load('portableReport',process.env.MIDIR_BASELINE_FRONT);
    assert.equal(oldHtml,baseline.buildPortableReportHTML({...C,recordingId:undefined},'Historical summary','all',names));
    for(const s of [A,B,C]){
      const before=baseline.buildPortableReportHTML(s,title,'all',names);
      const after=buildPortableReportHTML(s,title,'all',names);
      const payload=JSON.parse(extract(after));delete payload.exportMetadata;
      assert.deepEqual(payload,JSON.parse(extract(before)),'preserve every baseline payload field');
      assert.equal(after.replace(extract(after),extract(before)),before,'preserve baseline viewer byte-for-byte');
    }
    console.log('48.a baseline viewer and all original payload fields match');
  }
  const oldData=JSON.parse(extract(oldHtml));assert(!oldData.exportMetadata);assert.equal(oldData.companion.version,1);
  const oldZip=Buffer.from(await (await makeReportZip([{name:'historical.html',html:oldHtml}],false)).arrayBuffer());
  assert.equal(readZip(oldZip).size,1);assert(!readZip(oldZip).has('manifest.json'));
  if(fixtureDir){fs.writeFileSync(path.join(fixtureDir,'legacy.zip'),oldZip);fs.writeFileSync(path.join(fixtureDir,'individual.html'),buildPortableReportHTML(A,title,'all',names));fs.writeFileSync(path.join(fixtureDir,'legacy-id-input.ndjson'),legacyEvents);}
  const malicious=structuredClone(A);malicious.players[playerId].name='Example </script> 玩家';
  const safe=entry(malicious,'safe.ndjson','<script>test</script>');assert(!safe.payload.includes('<'));assert.equal(JSON.parse(safe.payload).companion.players[0].name,'Example </script> 玩家');
  assert.throws(()=>entry({...A,recordingId:undefined}),/no reliable export identity/);
  assert.throws(()=>entry({...A,liveCompact:true}),/Load the saved session/);
  await assert.rejects(makeReportZip([{name:'../escape.html',html:'x'}]),/Invalid ZIP/);
  await assert.rejects(makeReportZip([{name:'A.html',html:'a'},{name:'a.html',html:'b'}]),/Duplicate ZIP/);
  await assert.rejects(makeSessionBundle([]),/No reports/);
  const longName=entry(A,'a'.repeat(240)+'.ndjson','🌍'.repeat(100));
  const unicode=await bundle([longName,longName]);
  assert(unicode.manifest.sessions.every(e=>Buffer.byteLength(e.path)<255));
  const noCrypto=load('sessionBundle',root,false);
  const noHash=await noCrypto.makeSessionBundle([a],fixed);
  const noHashManifest=JSON.parse(readZip(Buffer.from(await noHash.blob.arrayBuffer())).get('manifest.json'));
  assert(!Object.hasOwn(noHashManifest.sessions[0],'payloadSha256')&&!Object.hasOwn(noHashManifest.sessions[0],'fileSha256'));
  const ui=fs.readFileSync(path.join(root,'src/components/SessionPanel.vue'),'utf8');
  assert(!ui.includes("batchDialog.mode")&&!ui.includes("Bundle format"));
  assert(ui.includes('await getSessionSummary(id)')&&ui.includes('await makeSessionBundle(reports)'));
  assert(ui.includes('if(!reports.length)throw new Error')&&ui.includes('skipped.push'));

  const dense=entry(summary(id(3),6000), 'dense.ndjson','Large evidence fixture');
  assert.equal(JSON.parse(dense.payload).damageHitEvents.length,6000);
  const largeItems=[dense,...Array.from({length:127},(_,i)=>entry(summary(id(100+i),12,i%2),`session-${i}.ndjson`,title))];
  const large=await bundle(largeItems,'large.zip');assert.equal(large.manifest.sessionCount,128);
  const largeStore=await makeReportZip([...large.files].map(([name,html])=>({name,html:html.toString()})),false);assert(large.size<largeStore.size);
  console.log(`Bundle regression passed: ${multi.size} DEFLATE bytes / ${store.length} STORE bytes (${(100*(1-multi.size/store.length)).toFixed(1)}% smaller); ${large.size} compressed / ${largeStore.size} STORE bytes for 128 sessions, 6000-hit entry; identities, hashes, scope, Unicode, historical and standalone parity verified.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
