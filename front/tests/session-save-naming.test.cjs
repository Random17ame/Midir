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
const {suggestSessionSaveName,observedParticipantCount}=load('sessionSaveNaming');
const start=1795400000, fallback='Session @ 12:34:56';
function recording(races,n) {
  return {startTime:start,encounterDuration:600,totalDamage:100,players:Object.fromEntries(Array.from({length:n},(_,i)=>[String(i+1),{id:String(i+1),overallStats:{totalDamage:100}}])),damageTaken:{},targets:Object.fromEntries(races.map(([raceId,hp],i)=>['t'+i,{
    raceId,name:'Target',startTime:start+i*30,endTime:start+i*30+20,hpHistory:hp==null?[]:[{time:0,currentHp:100,maxHp:100},{time:20,currentHp:hp,maxHp:100}]
  }]))};
}
const name=(races,n)=>suggestSessionSaveName(recording(races,n),fallback);
assert.equal(name([[193364,0],[193359,0]],4),'Crom Clear');
assert.equal(name([[193364,0],[193359,45]],4),'Crom Fail');
assert.equal(name([[193364,50]],4),'Crom Fail');
assert.equal(name([[193364,0]],4),'Crom');
assert.equal(name([[193359,null]],4),'Crom');
assert.equal(name([[193359,0]],3),'Crom Clear 3p');
assert.equal(name([[193359,0],[193359,45]],4),'Crom');
assert.equal(name([[7585,10],[7586,60],[7587,0]],6),'Glenn 6p');
assert.equal(name([[7585,10],[7586,60],[7587,0]],8),'Glenn');
assert.equal(name([[7587,0]],8),fallback);
assert.equal(name([[7602,0],[7603,0]],4),'Gate 2 & 3 4p');
assert.equal(name([[7603,0]],8),'Gate 3');
assert.equal(name([[7603,0]],9),'Gate 3');
assert.equal(name([[7603,0]],0),'Gate 3');
// Gate 1 needs a linked terminal replacement, not just a first-form zero.
assert.equal(name([[7600,50],[7601,0],[7602,0],[7603,0]],4),'Bri 4p');
assert.equal(name([[7600,50],[7601,0],[7602,0],[7603,0]],8),'Bri');
assert.equal(name([[7600,50],[7601,0],[7602,0],[7603,25]],4),'Gate 1 & 2 4p');
assert.equal(name([[7600,50],[7601,20],[7602,0],[7603,0]],6),'Gate 2 & 3 6p');
assert.equal(name([[7600,50],[7601,0],[7602,30],[7603,0]],4),'Gate 1 & 3 4p');
assert.equal(name([[7600,0],[7602,0]],4),'Gate 2 4p');
assert.equal(name([[7600,0]],4),'Bri Attempt 4p');
assert.equal(name([[7602,0],[7603,30],[7603,0],[7602,30]],4),'Gate 2 & 3 4p');
assert.equal(name([[7602,0],[7603,null]],8),'Gate 2');
assert.equal(name([[7603,25]],4),'Bri Attempt 4p');
assert.equal(name([[7615,0]],4),'Gate 4 4p');
assert.equal(name([[7600,50],[7601,0],[7602,0],[7603,0],[7615,0]],8),'Gate 1, 2, 3 & 4');
assert.equal(name([[7600,50],[7601,0],[7602,0],[7603,0],[193359,0]],4),'Variety 4p');
assert.equal(name([[195012,0]],3),'Phantasm 3p');
assert.equal(name([[195012,0]],4),'Phantasm');
assert.equal(name([[193810,0]],3),'Crom Abyss');
assert.equal(name([[7603,0],[193359,0]],4),'Variety 4p');
assert.equal(name([[193359,0],[195012,0]],4),'Variety 4p');
assert.equal(name([[7585,10],[7586,60],[7587,0],[7603,0]],6),'Variety 6p');
assert.equal(name([[7585,10],[7586,60],[7587,0],[7603,0]],8),'Variety 8p');
assert.equal(name([[193359,0],[7603,0],[195012,0]],3),'Variety 3p');
assert.equal(name([[7603,0],[193359,0]],9),'Variety');
assert.equal(name([[7603,0],[193359,0]],0),'Variety');
assert.equal(name([[7603,0],[7603,0]],4),'Gate 3 4p');
assert.equal(name([[193359,0],[7603,0]],4),'Variety 4p');
assert.equal(name([[999999,0]],4),fallback);
const support=recording([[7603,50]],2);
support.players['3']={id:'3',overallHealing:{totalDamage:100}};
support.players['4']={id:'4',overallHealing:{overshieldProvided:20}};
support.players['5']={id:'5',skillActivations:[{atMs:start*1000,skillId:1}]};
support.players['6']={id:'6',overallStats:{totalDamage:0}};
support.players['misc-anonymous-healing']={id:'misc-anonymous-healing',overallHealing:{totalDamage:9999}};
support.damageTaken={'1':{playerId:'1',totalDamage:1},'7':{playerId:'7',totalDamage:20}};
support.currentEntities=[{id:'8',category:'player'}];
assert.equal(observedParticipantCount(support),6);
assert.equal(suggestSessionSaveName(support,fallback),'Bri Attempt 6p');
const app=fs.readFileSync(path.join(__dirname,'../src/App.vue'),'utf8');
assert(app.includes('activeSessionId.value === "live" && !fightSummary.liveCompact && !fightSummary.minimalistMode ? fightSummary : await getLiveSummary()'));
assert(app.includes('saveSessionName.value = suggested'));
assert(app.includes('const name = saveSessionName.value.trim()'));
console.log('Editable live session naming, Crom outcomes, observed participants, mixed and missing evidence passed');

// Formatting remains independent of the encounter evidence and uses local
// recording dates rather than save time or the currently selected recording.
const {normalizeSessionNamePreferences, formatSessionName, activeNameTemplate, validSessionNameTemplate, nextDailyRun, recordingLocalDate} = load('sessionNameFormat');
const monday = new Date(2026, 10, 23, 23, 23);
const sunday = new Date(2026, 10, 22, 23, 23);
const wednesday = new Date(2026, 10, 25, 23, 23);
const thursday = new Date(2026, 10, 26, 0, 5);
const friday = new Date(2026, 10, 27, 12, 1);
const defaults = normalizeSessionNamePreferences();
assert.equal(formatSessionName('Bri 4p',monday,defaults),'Bri 4p @ 11:23p 11/23/26');
assert.equal(formatSessionName('Bri 4p',monday,{...defaults,includeTime:false}),'Bri 4p @ 11/23/26');
assert.equal(formatSessionName('Bri 4p',monday,{...defaults,includeDate:false}),'Bri 4p @ 11:23p');
assert.equal(formatSessionName('Bri 4p',monday,{...defaults,includeDate:false,includeTime:false}),'Bri 4p');
assert.equal(formatSessionName('',thursday,defaults),'Session @ 12:05a 11/26/26');
assert.equal(formatSessionName('Crom Clear',friday,defaults),'Crom Clear @ 12:01p 11/27/26');
const custom = normalizeSessionNamePreferences({customEnabled:true,labels:['Weekend Group','Weekend Group','','Friends Group','Company Team','','']});
assert.equal(formatSessionName('Bri 4p',sunday,custom,1),'Bri 4p Weekend Group 1 11/22/26');
assert.equal(formatSessionName('Bri 4p',monday,custom,2),'Bri 4p Weekend Group 2 11/23/26');
assert.equal(formatSessionName('Bri 4p',wednesday,custom,1),'Bri 4p Friends Group 1 11/25/26');
assert.equal(formatSessionName('Gate 2 & 3 6p',thursday,custom,3),'Gate 2 & 3 6p Company Team 3 11/26/26');
assert.equal(formatSessionName('Variety 4p',friday,custom,2),'Variety 4p @ 12:01p 11/27/26');
assert.equal(formatSessionName('Bri 4p',monday,{...custom,includeDate:false,includeTime:false},1),'Bri 4p Weekend Group 1 11/23/26');
assert.equal(formatSessionName('Bri 4p',monday,custom),'Bri 4p Weekend Group 11/23/26');
assert.equal(formatSessionName('Bri 4p',friday,{...custom,applyEveryDay:true,template:'{weekday} {encounter} #{run} {time}'},4),'Friday Bri 4p #4 12:01p');
assert.equal(formatSessionName('Bri 4p',monday,{...custom,template:'{unknown}'},1),'Bri 4p @ 11:23p 11/23/26');
assert.equal(formatSessionName('Bri 4p',monday,{...custom,template:'  '},1),'Bri 4p @ 11:23p 11/23/26');
assert.equal(formatSessionName('Bri 4p',monday,{...custom,template:'{encounter} {label}',labels:['','{date}']},1),'Bri 4p {date}');
assert(!validSessionNameTemplate('{encounter')); assert(!validSessionNameTemplate('{label} {bad}'));
assert(!activeNameTemplate(custom,friday));
assert.equal(normalizeSessionNamePreferences({includeDate:false,includeTime:false,labels:[null,12]}).labels.join(','),',,,,,,');
const saved = [
  {id:'a',startTime:new Date(2026,10,23,0,1).getTime()/1000,name:'Renamed'},
  {id:'b',startTime:new Date(2026,10,23,23,59).getTime()/1000},
  {id:'a',startTime:monday.getTime()/1000},
  {id:'live',startTime:monday.getTime()/1000},
  {id:'c',startTime:sunday.getTime()/1000},
  {id:'d',startTime:0},
];
assert.equal(nextDailyRun(monday,saved),3);
assert.equal(nextDailyRun(wednesday,saved),1);
assert.equal(recordingLocalDate(monday.getTime()/1000).getTime(),monday.getTime());
assert.equal(recordingLocalDate(0,sunday).getTime(),sunday.getTime());
assert(app.includes('run = nextRunNumber(date, await getSessions(), preferences)'));
assert(app.includes('formatSessionName(encounter, date, preferences, run)'));
const settings=fs.readFileSync(path.join(__dirname,'../src/components/SettingsView.vue'),'utf8');
assert(settings.includes('v-model="sessionNamePreferences.labels[index]"'));
assert(settings.includes('v-model="sessionNamePreferences.includeDate"'));
assert(settings.includes('v-model="sessionNamePreferences.includeTime"'));
console.log('Local dates, time toggles, configurable weekday labels, template validation, fallback and daily run numbering passed');

// Group scheduler: dates are local, intervals are half-open, overnight starts
// belong to the previous selected weekday, and overlapping rules use priority.
const {newGroupSchedule,matchGroupSchedule,nextRunNumber,needsRunNumber,validGroupSchedule}=load('sessionNameFormat');
const d=(day,h,m=0)=>new Date(2026,10,day,h,m);
const rec=(id,day,h,m=0)=>({id,startTime:d(day,h,m).getTime()/1000});
const group={...newGroupSchedule(),label:'Friends Group',days:[3,4],start:'18:00',end:'04:00'};
const other={...newGroupSchedule(),label:'Company Team',days:[4],start:'00:00',end:'06:00'};
const schedule=normalizeSessionNamePreferences({...custom,schedules:[group,other]});
assert.equal(matchGroupSchedule(schedule,d(25,17,59)),undefined);
assert.equal(matchGroupSchedule(schedule,d(25,18)).group.label,'Friends Group');
assert.equal(matchGroupSchedule(schedule,d(26,0)).group.label,'Friends Group');
assert.equal(matchGroupSchedule(schedule,d(26,3,59)).start.getTime(),d(25,18).getTime());
assert.equal(matchGroupSchedule(schedule,d(26,4)).group.label,'Company Team');
assert.equal(matchGroupSchedule(schedule,d(26,6)),undefined);
assert.equal(matchGroupSchedule(schedule,d(27,3)).group.label,'Friends Group');
assert.equal(matchGroupSchedule({...schedule,schedules:[other,group]},d(26,1)).group.label,'Company Team');
assert.equal(matchGroupSchedule({...schedule,schedules:[{...group,enabled:false},other]},d(26,1)).group.label,'Company Team');
assert.equal(formatSessionName('Bri 4p',d(26,1),schedule,2),'Bri 4p Friends Group 2 11/26/26');
assert.equal(formatSessionName('Bri 4p',d(26,5),schedule,1),'Bri 4p Company Team 1 11/26/26');
assert.equal(formatSessionName('Bri 4p',d(23,23,23),schedule,3),'Bri 4p Weekend Group 3 11/23/26');
assert.equal(formatSessionName('Bri 4p',d(28,12),schedule,3),'Bri 4p @ 12:00p 11/28/26');
assert.equal(needsRunNumber(defaults,d(25,18)),false);
assert.equal(needsRunNumber(schedule,d(25,18)),true);
assert.equal(needsRunNumber({...schedule,schedules:[{...group,template:'{encounter} {label}'}]},d(25,18)),false);
assert.equal(needsRunNumber({...defaults,includeRun:true},d(25,18)),true);
assert.equal(formatSessionName('Glenn 6p',d(25,18),{...defaults,includeRun:true,includeTime:false},3),'Glenn 6p 3 @ 11/25/26');
assert.equal(validGroupSchedule({...group,start:'25:00'}),false);
assert.equal(validGroupSchedule({...group,template:'{bad}'}),false);
assert.equal(validGroupSchedule({...group,days:[]}),false);
assert.equal(matchGroupSchedule({...schedule,schedules:[{...group,start:'18:00',end:'18:00'}]},d(26,17)).group.label,'Friends Group');
assert.equal(matchGroupSchedule({...schedule,schedules:[{...group,days:[6]}]},d(29,2)).group.label,'Friends Group');
const history=[rec('old',19,6),rec('week',19,7),rec('early',25,17),rec('a',25,18),rec('a',25,18),rec('b',26,0,30),rec('other',26,5),rec('next',26,19),rec('live',26,1),{id:'invalid',startTime:0}];
assert.equal(nextRunNumber(d(26,1),history,schedule),3);
assert.equal(nextRunNumber(d(26,19),history,schedule),2);
assert.equal(nextRunNumber(d(26,5,30),history,schedule),2);
const weeklyGroup={...group,count:{...group.count,mode:'weekly',weekDay:0,weekTime:'00:00'}};
assert.equal(nextRunNumber(d(26,20),history,{...schedule,schedules:[weeklyGroup,other]}),4);
const weekly={...defaults,includeRun:true,count:{...defaults.count,mode:'weekly',weekDay:4,weekTime:'07:00'}};
assert.equal(nextRunNumber(d(26,6,59),history,weekly),6);
assert.equal(nextRunNumber(d(26,7),history,weekly),2);
const rolling={...defaults,includeRun:true,count:{...defaults.count,mode:'rolling',hours:12}};
assert.equal(nextRunNumber(d(26,5),history,rolling),5);
assert.equal(nextRunNumber(d(26,5,1),history,rolling),4);
assert.equal(nextRunNumber(d(26,4),history,{...defaults,count:{...defaults.count,mode:'scheduled'}}),4);
assert.equal(normalizeSessionNamePreferences({schedules:[{label:'Friends Group',days:[3,3,8],count:{hours:-5}}]}).schedules[0].days.join(','),'3');
assert.equal(normalizeSessionNamePreferences({schedules:[{label:'Friends Group',count:{hours:-5}}]}).schedules[0].count.hours,1);
assert.equal(normalizeSessionNamePreferences(custom).labels[3],'Friends Group');
const appearance=settings.match(/<v-window-item value="appearance">([\s\S]*?)<\/v-window-item>/)?.[1];
const capture=settings.match(/<v-window-item value="capture">([\s\S]*?)<\/v-window-item>/)?.[1];
assert(appearance.includes('Group Run Scheduler'));
assert(appearance.includes('v-model="sessionNamePreferences.includeRun"'));
assert(!capture.includes('Session Naming'));
assert(capture.includes('Minimalist Mode'));
assert(app.includes('needsRunNumber(preferences, date)'));
console.log('Scheduled group naming, overnight and overlapping windows, group-scoped counts, weekly resets, rolling windows, legacy preferences and Appearance placement passed');
