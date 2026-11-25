// Exercise the existing encounter classifiers, not mocked display labels.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(__dirname, '../src/utils', name + '.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));
  const mod={exports:{}};
  vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,require(id){
    assert(id.startsWith('./'), 'Unexpected dependency: '+id); return load(id.slice(2));
  }},{filename});
  cache.set(name,mod.exports); return mod.exports;
}
const {getReportNaming,reportDownloadName}=load('reportExportNaming');
const nov23=new Date(2026,10,23,12).getTime()/1000;
const nov24=new Date(2026,10,24,12).getTime()/1000;
function recording(startTime,races) {
  return {startTime,encounterDuration:600,totalDamage:0,players:{},damageTaken:{},targets:Object.fromEntries(races.map((raceId,i)=>['t'+i,{
    raceId,name:'Target',startTime:startTime+i*30,endTime:startTime+i*30+20,hpHistory:[{time:0,currentHp:100,maxHp:100}]
  }]))};
}
const a=getReportNaming(recording(nov23,[7600,7601,7602,7603]));
const b=getReportNaming(recording(nov24,[7602]));
const c=getReportNaming(recording(nov24,[7603]));
const d=getReportNaming(recording(nov23+100,[7600]));
assert.deepEqual(Array.from(a.encounters),['Bri Leith']);
assert.equal(reportDownloadName([b,c,d,a],'zip'),'11 23 26 Bri Leith.zip');
assert.equal(reportDownloadName([a],'html'),'11 23 26 Bri Leith.html');
assert.equal(reportDownloadName([c,b],'zip'),'11 24 26 Bri Leith.zip');
const mixed=recording(nov23,[7602,193810]);
assert.equal(reportDownloadName([getReportNaming(mixed)],'html'),'11 23 26 Mixed Encounters.html');
assert.equal(reportDownloadName([getReportNaming(mixed,'t1')],'html'),'11 23 26 Crom Bas Abyss.html');
assert.equal(reportDownloadName([getReportNaming(mixed,'t0')],'html'),'11 23 26 Bri Leith.html');
assert.equal(reportDownloadName([getReportNaming(recording(nov23,[121001]))],'html'),'11 23 26 Fahmes Ruin.html');
assert.equal(reportDownloadName([getReportNaming(recording(nov23,[195000,195001]))],'html'),'11 23 26 Alby Shineseeker.html');
const unknown=getReportNaming(recording(nov23,[999999]));
assert.equal(reportDownloadName([unknown],'html'),'11 23 26 Combat Report.html');
assert.equal(reportDownloadName([unknown,b],'zip'),'11 23 26 Mixed Encounters.zip');
assert.equal(reportDownloadName([getReportNaming({targets:{}},'',nov24)],'zip'),'11 24 26 Combat Reports.zip');
assert.equal(reportDownloadName([getReportNaming({targets:{}})],'zip'),'Combat Reports.zip');
assert.equal(reportDownloadName([getReportNaming(recording(nov23,[7602,999999]),'t1')],'html'),'11 23 26 Combat Report.html');
const panel=fs.readFileSync(path.join(__dirname,'../src/components/SessionPanel.vue'),'utf8');
assert(panel.includes("reportDownloadName(reports.map(r=>r.naming),'zip')"),'ZIP name uses successful report metadata only');
assert(panel.includes("getReportNaming(summary,'',session.startTime)"),'use the loaded recording and fallback date');
const portable=fs.readFileSync(path.join(__dirname,'../src/utils/portableReport.ts'),'utf8');
assert(portable.includes("reportDownloadName([getReportNaming(summary,targetId,fallbackStart)],'html')"));
console.log('Report filename dates, recognized families, selected targets, mixed and missing evidence passed');
