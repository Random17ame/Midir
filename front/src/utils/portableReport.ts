import { PET_DAMAGE_SKILL_ID, PET_DAMAGE_SKILL_LABEL, petEventLabel } from './petLabels';
import { buildCompanionExport } from './companionExport';
import { resolvePlayerArcana, resolvePlayerArcanaForIds, resolvePlayerArcanaWindow, getSkillArcana } from './arcanaEncounter';
import { getGroupMemberTargetIds } from './targetGrouping';
import { findReportEncounters } from './reportEncounters';
import { identifyBossScatterSources } from './enemyScatter';
import { scopeScatterGroups, filterScatterGroup, type ScatterGroup } from './scatterTargets';
import { getGate3HaloEvidence } from './gate3HaloReport';
import { getReportNaming, reportDownloadName } from './reportExportNaming';
import type { FightSummary, PlayerStats } from '@/protocols';

type SkillRow = { id:number; name: string; arcanaColor?: string; total: number; dps: number; biggest: number; hpm: number; hitCount:number; topHits:number[]; topHitEventIndices:number[]; averageHit:number|null; lowestHit:number|null; lowestHitEventIndex:number|null; crit: number };
type ScatterHit = {t:number;y:number;skills:{skillId:number;name:string;damage:number;hits:number;crits:number;max:number;bossDamage?:number}[]; bossDamage?:number};
type ReportPlayer = {id:string;name:string;arcana:string;arcanaEvidence:string[];arcanaIdentities:{name:string;icon:string;color:string}[];color:string;damage:number;dps:number;bossDps?:number;deaths:number;skills:SkillRow[];hits:ScatterHit[]};
type ReportEnemy = {name:string;color:string;kind:'enemy';hits:ScatterHit[]};

// Session is the container; encounters are individually selectable, with
// timestamps expressed relative to the currently displayed fight window.
// Existing companion JSON remains embedded unmodified for v1 importers.
export const SESSION_EXPORTER_VERSION = '49.a';
export type SessionExportMetadata = {
  schemaVersion: 1; id: string; exporterVersion: string;
  startAt: string | null; endAt: string | null;
  scope: { playerId: string | null; targetId: string | null; targetEntityIds: string[] };
  healingIncomplete: boolean;
};
export function getSessionExportMetadata(summary: FightSummary, scope: string, targetId = '', targetEntityIds: string[] = []): SessionExportMetadata | undefined {
  if (!summary.recordingId || !/^(?:recording-[0-9a-f]{32}|legacy-sha256-[0-9a-f]{64})$/.test(summary.recordingId)) return undefined;
  const iso = (seconds?: number) => seconds && seconds > 0 && Number.isFinite(new Date(seconds * 1000).getTime()) ? new Date(seconds * 1000).toISOString() : null;
  return { schemaVersion: 1, id: summary.recordingId, exporterVersion: SESSION_EXPORTER_VERSION,
    startAt: iso(summary.startTime), endAt: iso(summary.endTime),
    scope: { playerId: scope === 'all' ? null : String(scope), targetId: targetId || null, targetEntityIds: targetEntityIds.map(String) },
    healingIncomplete: !!summary.healingIncomplete };
}

// The exact JSON string is the portable payload for both HTML and data-only ZIPs.
export function buildPortableReportPayload(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = ''): string {
  if (summary.liveCompact) throw new Error('Load the saved session before exporting exact-hit evidence.');
  const chosenMembers=targetId?getGroupMemberTargetIds(targetId,summary):[];
  if(targetId && !chosenMembers.length) throw new Error('Selected target has no data in this session.');
  const encounters=findReportEncounters(summary,targetId);
  // Classify all observed boss SOURCE IDs, including those outside the chosen
  // recipient view. A numeric display name is never sufficient evidence.
  const enemyIdentities=identifyBossScatterSources(summary);
  const selected=Object.values(summary.players||{}).filter(p=>
    (scope==='all'||p.id===scope) && !enemyIdentities.has(p.id) &&
    !(scope==='all' && /^(?:Unknown Caster|Misc\. Anonymous Healing)$/i.test(p.name.trim())));
  if(!selected.length) throw new Error('No selected player data is available.');
  const duration=Math.max(1,Number(summary.encounterDuration)||1);
  const recognizedBossIds=new Set(encounters.flatMap(e=>e.entityIds));
  const gate3Evidence=new Map(encounters.filter(e => e.entityIds.some(id=>Number(summary.targets?.[id]?.raceId)===7603))
    .map(e=>[e.id,getGate3HaloEvidence(summary.targets||{},e.id)] as const));
  const allNames=[...new Set(Object.values(summary.targets||{}).map(t=>t.name).filter(n=>n&&n!=='Unknown'))].slice(0,12);
  const groupsToHits=(groups:ScatterGroup[],start:number,playerOutgoing:boolean):ScatterHit[]=>
    groups.map(g=>{
      const targetHits=g.targets||[];
      const bossDamage=playerOutgoing ? targetHits.filter(h=>recognizedBossIds.has(String(h.targetId)))
        .reduce((a,h)=>a+Number(h.damage||0),0) : 0;
      const skills=(g.skills||[]).map(sk=>({
        skillId:Number(sk.skillId),name:Number(sk.skillId)===PET_DAMAGE_SKILL_ID?petEventLabel(sk.petName):(names[Number(sk.skillId)] || (Number(sk.skillId)===0?'Other Damage':`Skill ${sk.skillId}`)),
        damage:Number(sk.damage)||0,hits:Number(sk.hitCount)||0,crits:Number(sk.critCount)||0,
        max:Number(sk.maxDamage)||0,
        bossDamage:playerOutgoing ? targetHits.filter(h=>Number(h.skillId)===Number(sk.skillId)&&Number(h.petRaceId||0)===Number(sk.petRaceId||0)&&recognizedBossIds.has(String(h.targetId)))
          .reduce((a,h)=>a+Number(h.damage||0),0) : 0
      }));
      return {t:Number(g.timestamp)-start,y:skills.reduce((a,sk)=>a+sk.damage,0),skills,bossDamage};
    }).filter(h=>h.y>0&&h.skills.length>0);
  // Boss-originated outgoing hit groups are CONTEXT tracks, never party DPS.
  // In boss-recipient views they are omitted so the meaning stays unambiguous.
  const makeEnemies=(start:number,end:number):ReportEnemy[] =>
    Object.values(summary.players||{}).filter(p=>enemyIdentities.has(p.id)).map(p=>{
      const identity=enemyIdentities.get(p.id)!;
      const groups=(p.skillUses||[] as ScatterGroup[]).filter(g=>
        Number.isFinite(Number(g.timestamp))&&Number(g.timestamp)>=start&&Number(g.timestamp)<=end);
      return {name:identity.name,color:identity.color,kind:'enemy' as const,hits:groupsToHits(groups as ScatterGroup[],start,false)};
    }).filter(e=>e.hits.length>0);
  const makePlayers=(ids:string[]|null, start:number, end:number, source:'session'|'boss'|'window',
    excludedIds:ReadonlySet<string>=new Set(), bossIds:string[]=[]):ReportPlayer[]=> {
    const memberIds=ids===null?null:new Set(ids);
    const period=Math.max(1,end-start);
    return selected.map((p:PlayerStats)=>{
      const groups=scopeScatterGroups(p.skillUses as ScatterGroup[]|undefined,memberIds)
        .filter(g=>Number.isFinite(Number(g.timestamp))&&Number(g.timestamp)>=start&&Number(g.timestamp)<=end)
        .map(g=>{
          if (!excludedIds.size || !(g.targets||[]).some(t=>excludedIds.has(String(t.targetId)))) return g;
          // Preserve unattributed older buckets; never guess individual targets.
          const remaining=new Set((g.targets||[]).map(t=>String(t.targetId)).filter(id=>!excludedIds.has(id)));
          return filterScatterGroup(g,remaining);
        }).filter((g):g is ScatterGroup=>g!==null);
      const hits=groupsToHits(groups,start,true);
      // Per-target breakdown is canonical for selected boss totals and highest
      // individual hit. A window-only all-target view has no reliable passive
      // damage totals; its rows are explicitly limited to plotted hit evidence.
      const stats:Record<number,{totalDamage:number;count:number;critCount:number;maxDamage:number}>={};
      let total=0;
      if(source==='window') {
        for(const g of groups) for(const hit of g.skills||[]){
          const id=Number(hit.skillId), cur=stats[id]||(stats[id]={totalDamage:0,count:0,critCount:0,maxDamage:0});
          cur.totalDamage+=Number(hit.damage)||0;cur.count+=Number(hit.hitCount)||0;
          cur.critCount+=Number(hit.critCount)||0;cur.maxDamage=Math.max(cur.maxDamage,Number(hit.maxDamage)||0);
        }
        total=Object.values(stats).reduce((a,stat)=>a+stat.totalDamage,0);
      } else if(source==='boss') {
        for(const id of ids||[]) {
          const row=p.damageByTarget?.[id]; if(!row) continue;
          total+=Number(row.totalDamage)||0;
          for(const [key,hit] of Object.entries(row.skills||{})) {
            const skillId=Number(key), cur=stats[skillId]||(stats[skillId]={totalDamage:0,count:0,critCount:0,maxDamage:0});
            cur.totalDamage+=Number(hit.totalDamage)||0;cur.count+=Number(hit.count)||0;
            cur.critCount+=Number(hit.critCount)||0;cur.maxDamage=Math.max(cur.maxDamage,Number(hit.maxDamage)||0);
          }
        }
      } else {
        total=Number(p.overallStats?.totalDamage)||0;
        for(const [key,hit] of Object.entries(p.overallStats?.skills||{}))
          stats[Number(key)]={totalDamage:Number(hit.totalDamage)||0,count:Number(hit.count)||0,
            critCount:Number(hit.critCount)||0,maxDamage:Number(hit.maxDamage)||0};
      }
      // The per-hit stream is distinct from per-second scatter aggregates. Only
      // use true individual damage events for a highest-five / lowest tooltip.
      const individualHits=new Map<number,{damage:number;eventIndex:number}[]>();
      for (const [eventIndex,h] of (p.damageEvents||[]).entries()) {
        const at=Number(h.atMs)/1000-Number(summary.startTime||0);
        if (!Number.isFinite(at) || at<start || at>end || Number(h.damage)<=0) continue;
        if (memberIds && !memberIds.has(String(h.targetId))) continue;
        if (excludedIds.has(String(h.targetId))) continue;
        const id=Number(h.skillId), hits=individualHits.get(id)||[];
        hits.push({damage:Number(h.damage),eventIndex});individualHits.set(id,hits);
      }
      const skills:SkillRow[]=Object.entries(stats).filter(([,stat])=>stat.totalDamage>0)
        .map(([key,stat])=>{
          const observed=individualHits.get(Number(key))||[];
          // Sort by damage and recorded index so repeated equal-value hits
          // remain individually selectable on the scatter plot.
          const ordered=observed.slice().sort((a,b)=>b.damage-a.damage||a.eventIndex-b.eventIndex);
          const top=ordered.slice(0,5),lowest=ordered.at(-1);
          return {id:Number(key),arcanaColor:getSkillArcana(Number(key))?.color, name:Number(key)===PET_DAMAGE_SKILL_ID?PET_DAMAGE_SKILL_LABEL:(names[Number(key)]||(Number(key)===0?'Other Damage':`Skill ${key}`)),
            total:Math.round(stat.totalDamage),dps:Math.round(stat.totalDamage/period),biggest:Math.round(stat.maxDamage),
            hpm:Math.round(stat.count*600/period)/10,hitCount:stat.count,
            topHits:top.map(h=>h.damage),topHitEventIndices:top.map(h=>h.eventIndex),
            averageHit:observed.length?Math.round(observed.reduce((sum,h)=>sum+h.damage,0)/observed.length):null,
            lowestHit:lowest?.damage??null,lowestHitEventIndex:lowest?.eventIndex??null,
            crit:stat.count?Math.round(stat.critCount/stat.count*1000)/10:0};
        })
        .sort((a,b)=>b.total-a.total);
      const arcana = source === 'session' ? resolvePlayerArcana(p, summary)
        : source === 'boss' ? resolvePlayerArcanaForIds(p, ids || [])
        : resolvePlayerArcanaWindow(p, Number(summary.startTime || 0) + start, Number(summary.startTime || 0) + end);
      return {id:String(p.id),name:p.name,arcana:arcana.name,arcanaEvidence:arcana.names,arcanaIdentities:arcana.identities,color:arcana.color,
        damage:Math.round(total),dps:Math.round(total/period),
        ...(source==='window' && bossIds.length ? {bossDps:Math.round(bossIds.reduce((sum,id)=>sum+Number(p.damageByTarget?.[id]?.totalDamage||0),0)/period)} : {}),
        deaths:(p.deaths||[]).filter(t=>Number(t)>=Number(summary.startTime||0)+start && Number(t)<=Number(summary.startTime||0)+end).length,
        skills,hits};
    }).filter(p=>p.skills.length>0||p.hits.length>0||
      selected.some(member=>String(member.id)===p.id&&(member.skillActivations||[]).some(u=>
        (Number(u.atMs)/1000-Number(summary.startTime||0))>=start&&
        (Number(u.atMs)/1000-Number(summary.startTime||0))<=end)));
  };
  type HaloPanel = {phase:number;halos:{id:string;round:number;contributions:{id:string;name:string;damage:number}[];total:number}[]};
  const views:{id:string;label:string;encounter:string;start:number;duration:number;players:ReportPlayer[];enemies:ReportEnemy[];haloPhases?:HaloPanel[];
    boss:{name:string;entityIds:string[];hp:[number,number][];phases:any[]}|null;hpSeries:{label:string;hp:[number,number][]}[];
    note:string;excludedTargetIds?:string[]}[]=[];
  if(!targetId) views.push({id:'session',label:'Entire session — all targets',encounter:'Entire recorded session',start:0,duration,
    players:makePlayers(null,0,duration,'session'),enemies:makeEnemies(0,duration),boss:null,
    hpSeries:encounters.flatMap(e=>[
      {label:e.label,hp:e.hp.map(([t,v])=>[t+e.start,v] as [number,number])},
      ...(e.hpSeries||[]).map(s=>({label:s.label,hp:s.hp.map(([t,v])=>[t+e.start,v] as [number,number])}))
    ]).filter(x=>x.hp.length>0),
    note:'All recorded damage. Enemy attacks are separate from party DPS.'});
  for(const e of encounters){
    const haloEvidence=gate3Evidence.get(e.id);
    const haloPhases: HaloPanel[]|undefined=haloEvidence ? [80,60,40].map(phase=>({phase,halos:haloEvidence.halos
      .filter(h=>h.phase===phase).map(h=>{
        const contributions=selected.map(p=>({id:String(p.id),name:p.name,damage:Math.round(Number(p.damageByTarget?.[h.id]?.totalDamage||0))}))
          .filter(p=>p.damage>0).sort((a,b)=>b.damage-a.damage);
        return {id:h.id,round:h.round,contributions,total:contributions.reduce((sum,p)=>sum+p.damage,0)};
      })})) : undefined;
    views.push({id:e.id+':boss',label:e.label+' — boss only',encounter:e.label+' · Boss only · '+(e.clear==='observed-zero-hp'?'Cleared':'Attempted'),start:e.start,
      duration:Math.max(1,e.end-e.start),players:makePlayers(e.entityIds,e.start,e.end,'boss'),enemies:[],
      boss:{name:e.label,entityIds:e.entityIds,hp:e.hp,phases:e.phases},hpSeries:e.hpSeries||[],haloPhases,
      note:'Damage to this boss only.'});
    if(!targetId) views.push({id:e.id+':window',label:e.label+' — all targets during attempt',
      encounter:e.label+' · All targets in encounter time window',start:e.start,duration:Math.max(1,e.end-e.start),
      players:makePlayers(null,e.start,e.end,'window',new Set(haloEvidence?.excludedShardIds||[]),e.entityIds),enemies:makeEnemies(e.start,e.end),boss:{name:e.label,entityIds:e.entityIds,hp:e.hp,phases:e.phases},hpSeries:e.hpSeries||[],haloPhases,excludedTargetIds:[...(haloEvidence?.excludedShardIds||[])],
      note:'All targets during this attempt, including adds. Enemy attacks do not count toward party DPS.'});
  }
  if(!views.length) views.push({id:'session',label:'Entire session — all targets',encounter:'Entire recorded session',start:0,duration,
    players:makePlayers(null,0,duration,'session'),enemies:makeEnemies(0,duration),boss:null,hpSeries:[],note:'No recognized boss HP history; displaying session-wide damage.'});
  const initial=views[0];
  // Unmodified observed skill-use packets embedded in the same readable HTML.
  // Never infer activations from damage groups; keep unknown/self target as null.
  // Include all chosen players' actions, including non-damaging preparations
  // during fight mechanics. Encounter-scoped chart filtering can come later.
  const skillUseEvents=selected.flatMap(p=>(p.skillActivations||[]).map(u=>({
    playerId:String(p.id),playerName:p.name,skillId:Number(u.skillId),
    skillName:names[Number(u.skillId)]||`Skill ${u.skillId}`,
    atMs:Number(u.atMs),relativeMs:Number(u.atMs)-Number(summary.startTime||0)*1000,
    targetId:u.targetId||null
  }))).filter(u=>Number.isFinite(u.atMs)&&u.atMs>0).sort((a,b)=>a.atMs-b.atMs);
  // One compact, unaggregated hit stream for all chart modes. Never duplicate
  // these records across the nine view objects. Keep IDs as strings to avoid
  // rounding Mabinogi's 64-bit entity IDs in JavaScript.
  const damageHitEvents=selected.flatMap(p=>(p.damageEvents||[]).map((h,eventIndex)=>({
    playerId:String(p.id),eventIndex,skillId:Number(h.skillId),atMs:Number(h.atMs),
    relativeMs:Number(h.atMs)-Number(summary.startTime||0)*1000,
    targetId:String(h.targetId||''),damage:Number(h.damage),
    critical:!!h.critical,delayed:!!h.delayed,
    ...(Number(h.skillId) === PET_DAMAGE_SKILL_ID && h.petRaceId ? {petRaceId:h.petRaceId,petName:h.petName || null}: {})
  }))).filter(h=>Number.isFinite(h.atMs)&&h.atMs>0&&h.damage>0).sort((a,b)=>a.atMs-b.atMs);
  // Raw independent skill evidence, interpreted offline by the Companion.
  // This is intentionally NOT a confirmed cast counter.
  // Typed protocol layouts discovered across unrelated skills. They supply
  // a candidate skill identity, NOT a cast count or proof of effect ownership.
  // Element types: Byte=1, Short=2, Int=3, Long=4.
  const recognizedSkillId=(o:any)=>{
    const opcode=Number(o.opcode),subtype=Number(o.subtype),f=o.fields||[],t=o.fieldTypes||[];
    if(opcode===0x7926) return Number(o.skillId||0);
    let index=-1,requiredType=0;
    if(opcode===0x9093){
      if(subtype===304||subtype===145){index=2;requiredType=2;}
      else if(subtype===419){index=1;requiredType=3;}
      else if(subtype===833||subtype===660||subtype===661){index=1;requiredType=2;}
    } else if(opcode===0x9095 && Number(f[1])===419){index=2;requiredType=3;}
    if(index<0||Number(t[index])!==requiredType) return 0;
    const id=Number(f[index]);
    return Number.isInteger(id)&&id>0&&Object.prototype.hasOwnProperty.call(names,id)?id:0;
  };
  const skillObservations=selected.flatMap(p=>(p.skillObservations||[]).map(o=>({
    playerId:String(p.id),playerName:p.name,atMs:Number(o.atMs),
    relativeMs:Number(o.atMs)-Number(summary.startTime||0)*1000,
    opcode:Number(o.opcode),skillId:Number(o.skillId||0),
    skillName:recognizedSkillId(o)?(names[recognizedSkillId(o)]||`Skill ${recognizedSkillId(o)}`):null,
    candidateSkillId:recognizedSkillId(o),
    subtype:Number(o.subtype||0),actionType:Number(o.actionType||0),actorVerified:!!o.actorVerified,fields:o.fields||[],fieldTypes:o.fieldTypes||[]
  }))).filter(o=>Number.isFinite(o.atMs)&&o.atMs>0).sort((a,b)=>a.atMs-b.atMs);
  const payload=JSON.stringify({exportMetadata:getSessionExportMetadata(summary,scope,targetId,chosenMembers),skillObservationSchemaVersion:1,skillObservations,encounterSchemaVersion:1,encounters:encounters.map(e=>({id:e.id,label:e.label,entityIds:e.entityIds,start:e.start,end:e.end,completion:e.clear,phases:e.phases.map(p=>({raceId:p.raceId,name:p.name}))})),reviveEvents:selected.flatMap(p=>(p.revives||[]).map(t=>({playerId:p.id,playerName:p.name,at:Number(t),relativeTime:Number(t)-Number(summary.startTime||0)}))),damageHitSchemaVersion:1,damageHitEvents,skillUseSchemaVersion:1,skillUseEvidence:'observed-0x6988-packets-not-verified-cast-count',skillUseEvents,
    selectedTargetId:targetId||null,selectedTargetIds:chosenMembers,
    targetScope:targetId?'selected-target':'all-targets',title:scope==='all'?title:`${selected[0].name} — Combat Report`,
    duration:initial.duration,players:initial.players,enemies:initial.enemies,encounter:initial.encounter,targets:allNames,boss:initial.boss,
    views,companion:buildCompanionExport(summary,title,scope,names,targetId)}).replace(/</g,'\\u003c');
  return payload;
}

export function renderPortableReportHTML(payload: string, healingIncomplete = false): string {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Combat Report</title><style>
  :root{color-scheme:dark;font:15px system-ui,sans-serif;background:#111823;color:#edf2f8}body{max-width:1200px;margin:auto;padding:20px}h1{font-size:1.65rem;margin-bottom:5px}h2{font-size:1.12rem}.muted{color:#9caac0}.top{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.tile,.panel{background:#1b2635;border:1px solid #37475a;border-radius:11px;padding:15px}.tile b{display:block;font-size:1.65rem;margin-top:5px;font-variant-numeric:tabular-nums}.tile span{color:#a9b7ca}.panel{margin-top:15px}.encounter{margin:16px 0 20px;border-left:4px solid #d9a963}.encounter strong{font-size:1.25rem}.player-panel{margin-top:19px;padding:0;overflow:hidden}.player-panel summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 17px;background:var(--arcana-header);color:#fff;font-size:1.26rem;font-weight:750;border-left:5px solid var(--arcana);position:relative;min-height:34px}.player-panel summary .player-name{flex:1;min-width:0;overflow-wrap:anywhere}.player-panel summary .player-dps{position:absolute;left:50%;transform:translateX(-50%);text-align:center;font-size:1.15rem;font-weight:800;white-space:nowrap;pointer-events:none}.player-panel summary .player-dps small{display:block;font-size:.67rem;font-weight:600;opacity:.85}.player-panel summary .drag-handle{margin-left:auto;cursor:grab;touch-action:none;border-radius:6px;padding:4px 7px;user-select:none;font-size:1.2rem;color:#fff;opacity:.85}.player-panel summary .drag-handle:active{cursor:grabbing}.player-panel.dragging{opacity:.55}.player-panel.drop-before{box-shadow:0 -4px 0 #f2c773}.player-panel.drop-after{box-shadow:0 4px 0 #f2c773}.player-panel summary::-webkit-details-marker{display:none}.player-panel summary::before{content:'▸';font-size:.84rem;opacity:.85;transition:transform .15s}.player-panel[open] summary::before{transform:rotate(90deg)}.player-panel summary:hover{filter:brightness(1.13)}.player-skills{padding:8px 15px 15px;overflow-x:auto;overscroll-behavior-x:contain}.skills{width:100%;border-collapse:collapse;font-size:.91rem}.skills th,.skills td{text-align:right;padding:12px 9px;border-bottom:1px solid #334154}.skills th:first-child,.skills td:first-child{text-align:left}.skills tr:hover{background:#263549}.bar-cell{position:relative;min-width:150px}.bar-cell .fill{position:absolute;top:5px;bottom:5px;left:0;opacity:.45;border-radius:4px;pointer-events:none}.bar-cell .value{position:relative;font-weight:700}.controls{display:flex;gap:9px;flex-wrap:wrap}.controls label{background:#26364a;border-radius:7px;padding:7px 10px;cursor:pointer}#chart-wrap{position:relative}svg{display:block;width:100%;height:390px;background:#152132;border-radius:8px;touch-action:none;cursor:crosshair}.dot:hover{stroke:white;stroke-width:2;opacity:1}.axis{stroke:#60728a;stroke-width:1}#tip{position:absolute;z-index:5;pointer-events:none;background:#202d3e;color:#f1f5fb;border:1px solid #71859d;box-shadow:0 8px 26px #000b;border-radius:9px;padding:11px 13px;max-width:min(290px,calc(100vw - 24px));font-size:.82rem;line-height:1.5;overflow-wrap:anywhere}#tip[hidden]{display:none}.hp-line{fill:none;stroke:#e59a67;stroke-width:2.3;stroke-linejoin:round;opacity:.95}.mark-line{stroke:#e4bb70;stroke-width:1.7;stroke-dasharray:5 4}.mark-band{fill:#e4bb70;fill-opacity:.11}.hp-search{margin:12px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hp-search input{width:74px;background:#152132;color:#fff;border:1px solid #63758d;border-radius:6px;padding:7px}.hp-search button{background:#34465f;color:#fff;border:1px solid #63758d;border-radius:6px;padding:7px 10px;cursor:pointer}.hp-search button:disabled{opacity:.4}.hp-search #match-label{color:#9caac0;font-size:.84rem}.chart-mode-control{display:none;gap:8px;flex-wrap:wrap;margin:10px 0 6px}.chart-mode-control button{background:#24364b;color:#d8e4f2;border:1px solid #63758d;border-radius:7px;padding:9px 13px;cursor:pointer}.chart-mode-control button[aria-pressed="true"]{background:#385e88;border-color:#a8c7ed;color:#fff;font-weight:700}.hp-search[hidden],.skill-use-legend[hidden],.enemy-control[hidden]{display:none!important}.skill-use-legend{display:flex;gap:14px;flex-wrap:wrap;padding:8px 0;color:#b5c5d8;font-size:.85rem}.legend-symbol{font-weight:900}.skill-timeline-note{color:#b5c5d8;line-height:1.45}.use-dot{cursor:crosshair}.use-dot:hover,.hit-marker:hover{stroke:#fff;stroke-width:2.5}.no-damage-band{fill:#675334;fill-opacity:.24}.timeline-lane{stroke:#35465a;stroke-width:1}.timeline-label{fill:#c3d0e0;font-size:12px}.timeline-summary{fill:#e3edf9;font-size:10px;pointer-events:none}.status{font-size:.8rem;font-weight:800;display:inline-block;padding:4px 9px;border-radius:6px}.status.clear{color:#7de4b0;background:#173b30}.status.attempt{color:#ff9d9d;background:#481f29}.status.session{color:#c3d0e0;background:#26364a}.status-overview{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.filter-disclosure{margin:9px 0}.filter-disclosure summary{cursor:pointer;color:#c3d0e0;font-size:.86rem}.filter-disclosure .controls{margin-top:10px}.encounter.is-clear{border-left-color:#35ba78}.encounter.is-attempt{border-left-color:#dc5962}.encounter.is-session{border-left-color:#7089a9}small{font-size:.78rem}@media(max-width:620px){.top{grid-template-columns:repeat(2,minmax(0,1fr))}.tile b{font-size:1.25rem}.skills{font-size:.75rem}.skills th,.skills td{padding:8px 4px}.player-panel summary .player-dps{position:static;transform:none;font-size:.95rem}.player-panel summary .player-name{flex:1}}

  .player-panel summary .player-hide{margin-left:3px;padding:3px 8px;border:1px solid #ffffff75;border-radius:5px;background:#101a2a70;color:#fff;font-size:1.15rem;cursor:pointer;flex:none}
  .player-panel summary .player-hide:hover{background:#c7444b}
  .player-panel summary .boss-dps{color:#c5d8f1;font-weight:600;font-size:.85em}
  .restore-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:7px 0}
  .restore-row button{padding:5px 10px;background:#26364a;color:#dceafa;border:1px solid #53677f;border-radius:6px;cursor:pointer}
  .restore-row button:hover{background:#395576}
  .stat-trigger{font:inherit;font-weight:700;color:inherit;border:0;padding:3px 2px;margin:-3px -2px;background:transparent;cursor:help;border-bottom:1px dotted #8497ad;font-variant-numeric:tabular-nums}
  .stat-trigger:hover,.stat-trigger:focus-visible{color:#fff;border-color:#d2e5ff;outline:none}
  .bar-cell .stat-trigger{position:relative}
  #detail-tip{position:fixed;z-index:10000;pointer-events:auto;background:#233348;color:#eff5fc;border:1px solid #607992;border-radius:9px;box-shadow:0 12px 28px #000b;padding:11px 13px;min-width:150px;max-width:min(295px,calc(100vw - 20px));font-size:.84rem;line-height:1.42}
  #detail-tip[hidden]{display:none!important}
  .detail-heading{font-size:.92rem;font-weight:800;border-bottom:1px solid #445a73;margin-bottom:7px;padding-bottom:7px;overflow-wrap:anywhere}
  .detail-line{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:3px 0;font-variant-numeric:tabular-nums}
  .detail-line span{color:#b5c7dd;overflow-wrap:anywhere}.detail-line b{font-weight:700;text-align:right;white-space:nowrap}
  .detail-pick{font:inherit;font-weight:750;color:#f3d78e;background:transparent;border:0;border-bottom:1px dotted #e4be6b;cursor:pointer;padding:2px;text-align:right}
  .detail-pick:hover,.detail-pick:focus-visible{color:white;border-color:white}
  .skill-select{font:inherit;color:inherit;background:transparent;border:0;padding:3px 1px;cursor:pointer;text-align:left;border-bottom:1px dotted transparent}
  .skill-select:hover,.skill-select:focus-visible{border-color:#c8ddf6;color:#fff}
  .skills tr.is-skill-selected{background:#31455d;outline:1px solid #91b7e9;outline-offset:-1px}
  .skills tr.is-skill-selected .skill-select{color:#fff;border-color:#f3d78e;font-weight:750}
  #skill-highlight{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:7px 0 10px;color:#d6e8fc;font-size:.85rem}
  #skill-highlight[hidden]{display:none!important}
  #skill-highlight-label{border-left:3px solid #66c5fb;padding:4px 8px;background:#24364b;border-radius:4px;overflow-wrap:anywhere}
  #skill-highlight-hit{color:#f2d48c;font-weight:750}
  #skill-highlight-clear,#skill-hit-clear{background:#2a3c52;color:#f3f7fd;border:1px solid #566c87;border-radius:6px;padding:4px 8px;cursor:pointer}
  #skill-highlight-clear[hidden],#skill-hit-clear[hidden]{display:none!important}
  .skills tr[data-skill-row]{cursor:pointer}.skills tr[data-skill-row]:hover:not(.is-skill-selected){background:#29384c}
  .skill-hit-cloud{pointer-events:none;fill:#75d9ff;stroke:#122033;stroke-width:.7;opacity:.96}
  .skill-scatter-bucket{stroke:#e9f9ff;stroke-width:2.3;opacity:1}
  .selected-hit-guide{pointer-events:none;stroke:#ffdb72;stroke-width:1.6;stroke-dasharray:5 4;opacity:.9}
  .selected-hit-ring{pointer-events:none;fill:none;stroke:#ffe087;stroke-width:3}
  .selected-hit-marker{cursor:crosshair;fill:#ffe087;stroke:#152132;stroke-width:1.8}
  .detail-line.detail-divider{border-top:1px solid #40566f;margin-top:4px;padding-top:7px}
  .halo-panel{margin-top:12px}.halo-panel[hidden]{display:none!important}
  .halo-panel>summary{cursor:pointer;font-weight:750;font-size:1.08rem}
  .halo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:9px;margin-top:10px}
  .halo-phase{min-width:0;padding:9px 7px 4px;background:#162233;border:1px solid #37475a;border-radius:9px}
  .halo-phase-head{display:flex;align-items:center;justify-content:center;margin:0}
  .halo-phase-head strong{font-size:1.07rem}
  .halo-arena{width:150px;aspect-ratio:1;border:2px solid #52637b;border-radius:50%;position:relative;margin:76px auto 18px;background:radial-gradient(circle,transparent 0 20%,#263c56 21% 22%,transparent 23% 58%,#263c56 59% 60%,transparent 61%);overflow:visible}
  .halo-node{position:absolute;z-index:1;transform:translate(-50%,-50%);width:25px;height:25px}
  .halo-node:hover,.halo-node:focus-within{z-index:4}
  .halo-dot{display:grid;place-items:center;border:2px solid #172332;width:25px;height:25px;border-radius:50%;background:var(--round-color);font-weight:800;color:#18212b;cursor:pointer;padding:0}
  .halo-dot:hover,.halo-dot:focus-visible{outline:2px solid #e2f1ff;outline-offset:2px}
  .halo-mini{position:absolute;top:50%;left:calc(100% + 4px);transform:translateY(-50%);width:89px;text-align:left;background:#203146c9;border:1px solid #425771;border-radius:5px;padding:3px 4px;pointer-events:none}
  .halo-mini.left{left:auto;right:calc(100% + 4px);text-align:right}
  .halo-mini.above{top:auto;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%)}
  .halo-mini-line{display:flex;justify-content:space-between;gap:3px;font-size:.63rem;line-height:1.32;white-space:nowrap}
  .halo-mini.left .halo-mini-line{flex-direction:row-reverse}
  .halo-mini-name{min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:53px;flex:1}
  .halo-mini-share{color:#e0ebfa;font-variant-numeric:tabular-nums;font-weight:700;flex:none}
  .halo-mini-more{font-size:.6rem;color:#aebfd4;line-height:1.15}
  .halo-legend{display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:5px;font-size:.68rem;color:#b6c8dd}
  .halo-swatch{width:8px;height:8px;border-radius:50%;background:var(--round-color);display:inline-block;margin-right:4px}
  @media(max-width:800px){.halo-grid{grid-template-columns:1fr}.halo-phase{padding:8px 7px}.halo-arena{margin:76px auto 18px}}
  @media(max-width:620px){body{padding:12px}.panel{padding:12px}.player-skills .skills{min-width:530px}}
  @media(max-width:420px){.halo-arena{width:calc(100% - 180px);max-width:150px}.halo-mini{width:78px}.halo-mini-name{max-width:42px}}
  @media(max-width:360px){.halo-arena{margin-bottom:30px}.halo-node.low .halo-mini{margin-top:10px}}
  </style></head><body><h1 id="title"></h1>${healingIncomplete ? '<p class="muted">Healing Done unavailable: recording has incomplete healing data.</p>' : ''}<div class="panel encounter" id="encounter-panel"><span class="muted">Encounter</span><div><strong id="encounter"></strong> <span id="encounter-status" class="status session"></span></div><div class="status-overview" id="status-overview"></div><small class="muted" id="other-targets"></small></div><div class="top" id="totals"></div><div class="panel"><h2 id="chart-heading">Damage Scatter &amp; Boss HP</h2><div class="hp-search"><label for="view-select">Encounter</label><select id="view-select" style="background:#152132;color:#fff;border:1px solid #63758d;border-radius:6px;padding:8px;max-width:100%"></select><label for="target-scope" id="target-scope-label" hidden>Targets</label><select id="target-scope" style="background:#152132;color:#fff;border:1px solid #63758d;border-radius:6px;padding:8px" hidden></select></div><p class="muted" id="view-note" hidden></p><div id="skill-legend" class="skill-use-legend" hidden><span><span class="legend-symbol">●</span> Observed Skill Use</span><span>◆ Following matched hit</span><span>Bottom band: No Damage Dealt</span></div><p id="skill-note" class="skill-timeline-note" hidden></p><details class="filter-disclosure"><summary>Chart filters</summary><div class="controls" id="toggles"></div></details><div class="hp-search" id="hp-search-controls"><label for="hp-percent">Find boss HP %</label><input id="hp-percent" type="number" min="0" max="100" step="1" value="50"><button id="hp-find">Find</button><button id="hp-prev" disabled title="Previous match">◀</button><button id="hp-next" disabled title="Next match">▶</button><button id="hp-clear">Clear</button><span id="match-label" aria-live="polite"></span></div><div id="phase-list" hidden></div><div id="skill-highlight" hidden><span id="skill-highlight-label"></span><span id="skill-highlight-hit"></span><button id="skill-hit-clear" type="button" hidden>Clear hit ×</button><button id="skill-highlight-clear" type="button" hidden>Clear skill ×</button></div><div id="chart-wrap"><svg id="chart" viewBox="0 0 1000 390" aria-label="Damage events and boss health through the encounter"></svg><div id="tip" hidden role="tooltip"></div></div></div><div id="players"></div><details class="panel halo-panel" id="halo-panel" hidden open><summary>Gate 3 · Shards of Solace</summary><div id="halo-content"></div></details><div id="detail-tip" role="tooltip" hidden></div>
  <script type="application/json" id="data">${payload}</script><script>
  (()=>{const d=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id),n=v=>Math.round(v||0).toLocaleString(),esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const headerColor=hex=>{let c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);let scale=1;while(lum(c.map(v=>v*scale))>.18)scale*=.9;return '#'+c.map(v=>Math.round(v*scale).toString(16).padStart(2,'0')).join('')};
  $('title').textContent=d.title;
  const views=d.views||[{id:'session',label:'Report',encounter:d.encounter,duration:d.duration,players:d.players,boss:d.boss,hpSeries:[],note:''}];
  const completed=new Map((d.encounters||[]).map(e=>[String(e.id),e.completion==='observed-zero-hp']));
  const clearCount=[...completed.values()].filter(Boolean).length;
  const attemptedCount=completed.size-clearCount;
  $('status-overview').innerHTML=completed.size?'<span class="status clear">'+clearCount+' cleared</span><span class="status attempt">'+attemptedCount+' attempted</span>':'';
  // Keep the exported views untouched; the UI selects encounter and target scope separately.
  const encounterViews=new Map(),groups=new Map();
  views.forEach((v,i)=>{
    const encounter=(d.encounters||[]).find(e=>String(v.id).startsWith(String(e.id)+':'));
    const key=encounter?String(encounter.id):String(v.id);
    if(!encounterViews.has(key)){
      encounterViews.set(key,{encounter,indices:[]});
      const group=encounter?(String(encounter.label).split(' — ')[0]||'Encounters'):'Session';
      if(!groups.has(group))groups.set(group,[]);
      const status=encounter?(completed.get(key)?'🟢 Cleared':'🔴 Attempted'):'Overview';
      const label=encounter?String(encounter.label).replace(/ — /g,' · ')+' · '+status:v.label;
      groups.get(group).push('<option value="'+esc(key)+'">'+esc(label)+'</option>');
    }
    encounterViews.get(key).indices.push(i);
  });
  $('view-select').innerHTML=[...groups].map(([group,options])=>'<optgroup label="'+esc(group)+'">'+options.join('')+'</optgroup>').join('');
  const scopeFor=v=>String(v.id).endsWith(':window')?'all':'boss';
  function syncScope(){
    const selected=encounterViews.get($('view-select').value);
    if(!selected)return;
    const choices=selected.indices.map(i=>({index:i,scope:scopeFor(views[i])}));
    const multiple=choices.length>1;
    $('target-scope').hidden=$('target-scope-label').hidden=!multiple;
    $('target-scope').innerHTML=choices.map(c=>'<option value="'+c.index+'">'+(c.scope==='all'?'All targets':'Boss only')+'</option>').join('');
    const currentIndex=views.indexOf(current);
    if(choices.some(c=>c.index===currentIndex))$('target-scope').value=String(currentIndex);
  }
  let current=views[0],ps=current.players,enemies=current.enemies||[],dur=Math.max(1,current.duration),actors=[];
  function skillBarPaint(p,s){return s.arcanaColor||arcanaHeader(p);}
  function arcanaHeader(p){const colors=(p.arcanaIdentities||[]).map(a=>a.color);if(colors.length<2)return headerColor(p.color);return 'linear-gradient(90deg,'+colors.map((c,i)=>c+' '+(i*100/(colors.length-1))+'%').join(',')+')';}
  const playerOrder=(views[0].players||[]).slice().sort((a,b)=>b.dps-a.dps).map(p=>p.id);
  let manuallyOrdered=false;
  const hiddenPlayers=new Set();
  let selectedSkill=null,selectedHit=null,selectedSkillHits=[];
  const roundColors=['#d7ab46','#aebbc9','#b9784d','#5e9bd9','#cb5c60'];
  function haloRoundColor(round){return roundColors[round-1]||'#8d9aaf';}
  function rememberPanelOrder(){
    if(!manuallyOrdered){
      const defaultIds=ps.slice().sort((a,b)=>b.dps-a.dps).map(p=>p.id);
      playerOrder.splice(0,playerOrder.length,...defaultIds,...playerOrder.filter(id=>!defaultIds.includes(id)));
      manuallyOrdered=true;
    }
    const visible=[...$('players').querySelectorAll('.player-panel')].map(el=>el.dataset.playerId);
    const visibleIds=new Set(visible);let next=0;
    const arranged=playerOrder.map(id=>visibleIds.has(id)?visible[next++]:id);
    for(const id of visible)if(!arranged.includes(id))arranged.push(id);
    playerOrder.splice(0,playerOrder.length,...arranged);
  }
  function detailButton(value,title,rows,cssClass,playerId,skillId){
    return '<button type="button" class="'+(cssClass||'stat-trigger')+'" data-detail-title="'+esc(title)+'" data-detail-rows="'+esc(JSON.stringify(rows))+'"'+(playerId!==undefined?' data-detail-owner="'+esc(playerId)+'" data-detail-skill="'+Number(skillId)+'"':'')+'>'+esc(value)+'</button>';
  }
  function markSelectedSkill(){
    $('players').querySelectorAll('tr[data-skill-row]').forEach(row=>{
      const active=!!selectedSkill&&row.dataset.playerId===selectedSkill.playerId&&Number(row.dataset.skillId)===selectedSkill.skillId;
      row.classList.toggle('is-skill-selected',active);
      row.querySelector('.skill-select')?.setAttribute('aria-pressed',String(active));
    });
    $('skill-highlight').hidden=!selectedSkill&&!selectedHit;
    $('skill-highlight-clear').hidden=!selectedSkill;
    $('skill-hit-clear').hidden=!selectedHit;
    const p=selectedSkill&&ps.find(p=>p.id===selectedSkill.playerId);
    const sk=p?.skills.find(s=>s.id===selectedSkill.skillId);
    $('skill-highlight-label').hidden=!selectedSkill;
    $('skill-highlight-label').textContent=selectedSkill?(p?.name||'Player')+' · '+(sk?.name||'Skill '+selectedSkill.skillId)+' · '+(selectedSkillHits.length?n(selectedSkillHits.length)+' recorded hits':'available scatter buckets') : '';
    const hp=selectedHit&&ps.find(p=>p.id===selectedHit.playerId);
    const hs=hp?.skills.find(s=>s.id===selectedHit?.skillId);
    $('skill-highlight-hit').textContent=selectedHit?'Hit: '+(hp?.name||'Player')+' · '+(hs?.name||'Skill '+selectedHit.skillId)+' · '+n(selectedHit.damage)+' at '+((selectedHit.relativeMs/1000)-Number(current.start||0)).toFixed(3)+'s':'';
  }
  function renderHaloPanel(){
    const panel=$('halo-panel'),phases=current.haloPhases;
    panel.hidden=!phases;
    if(!phases){$('halo-content').innerHTML='';return;}
    $('halo-content').innerHTML='<div class="halo-grid">'+phases.map(phase=>{
      const count=phase.halos.length;
      const nodes=phase.halos.map((h,i)=>{
        const angle=-Math.PI/2+2*Math.PI*i/Math.max(count,3);
        const x=50+43*Math.cos(angle),y=50+43*Math.sin(angle);
        const side=y<22?'above':x<35?'left':'right';
        const rows=h.contributions.map(p=>[p.name,n(p.damage)+' · '+(h.total?(100*p.damage/h.total).toFixed(1):'0.0')+'%']);
        rows.push(['Total',n(h.total)]);
        const marker=detailButton(String(i+1),'Halo '+(i+1)+' · Round '+h.round,rows,'halo-dot');
        const leaders=h.contributions.slice(0,2);
        const mini=leaders.map(p=>'<div class="halo-mini-line"><span class="halo-mini-name">'+esc(p.name)+'</span><span class="halo-mini-share">'+(h.total?(100*p.damage/h.total).toFixed(0):'0')+'%</span></div>').join('');
        return '<div class="halo-node'+(y>70?' low':'')+'" style="left:'+x+'%;top:'+y+'%;--round-color:'+haloRoundColor(h.round)+'">'+marker+(mini?'<div class="halo-mini '+side+'">'+mini+(h.contributions.length>2?'<div class="halo-mini-more">+'+(h.contributions.length-2)+'</div>':'')+'</div>':'')+'</div>';
      }).join('');
      return '<section class="halo-phase"><div class="halo-phase-head"><strong>'+phase.phase+'%</strong></div><div class="halo-arena">'+nodes+'</div></section>';
    }).join('')+'</div><div class="halo-legend">'+roundColors.map((c,i)=>'<span><span class="halo-swatch" style="--round-color:'+c+'"></span>'+(i+1)+'</span>').join('')+'</div>';
  }
  // One themed, viewport-clamped popup for mouse hover, keyboard focus and touch taps.
  const detailTip=$('detail-tip');let pinnedDetail=null,activeDetail=null,detailCloseTimer=null;
  function cancelDetailClose(){if(detailCloseTimer!==null){clearTimeout(detailCloseTimer);detailCloseTimer=null}}
  function closeDetail(){cancelDetailClose();detailTip.hidden=true;activeDetail=null;pinnedDetail=null}
  function scheduleDetailClose(){cancelDetailClose();detailCloseTimer=setTimeout(()=>{if(!pinnedDetail){detailTip.hidden=true;activeDetail=null}detailCloseTimer=null},240)}
  detailTip.addEventListener('pointerenter',cancelDetailClose);
  detailTip.addEventListener('pointerleave',()=>{if(!pinnedDetail)scheduleDetailClose()});
  function showDetail(trigger,pin=false){
    if(!trigger||!trigger.isConnected)return;
    const rows=JSON.parse(trigger.dataset.detailRows||'[]');
    detailTip.innerHTML='<div class="detail-heading">'+esc(trigger.dataset.detailTitle||'Details')+'</div>'+rows.map(row=>{
      const pick=Number.isInteger(row[2])&&trigger.dataset.detailOwner!==undefined;
      return '<div class="detail-line'+(row[0]==='Total'?' detail-divider':'')+'"><span>'+esc(row[0])+'</span>'+(pick?'<button type="button" class="detail-pick" aria-label="Locate '+esc(row[0])+' on scatter" data-pick-player="'+esc(trigger.dataset.detailOwner)+'" data-pick-skill="'+esc(trigger.dataset.detailSkill)+'" data-pick-index="'+row[2]+'">'+esc(row[1])+'</button>':'<b>'+esc(row[1])+'</b>')+'</div>';
    }).join('');
    cancelDetailClose();detailTip.hidden=false;activeDetail=trigger;if(pin)pinnedDetail=trigger;
    const r=trigger.getBoundingClientRect(),b=detailTip.getBoundingClientRect(),margin=8;
    let left=r.left+r.width/2-b.width/2,top=r.top-b.height-9;
    if(top<margin)top=r.bottom+9;
    left=Math.max(margin,Math.min(window.innerWidth-b.width-margin,left));
    top=Math.max(margin,Math.min(window.innerHeight-b.height-margin,top));
    detailTip.style.left=left+'px';detailTip.style.top=top+'px';
  }
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||pinnedDetail)return;const t=e.target.closest('[data-detail-title]');if(t)showDetail(t)});
  document.addEventListener('pointerout',e=>{if(pinnedDetail||!activeDetail)return;if(activeDetail===e.target||activeDetail.contains(e.target)){if(!activeDetail.contains(e.relatedTarget)&&activeDetail!==e.relatedTarget){scheduleDetailClose()}}});
  document.addEventListener('focusin',e=>{const t=e.target.closest('[data-detail-title]');if(t&&!pinnedDetail)showDetail(t)});
  document.addEventListener('focusout',e=>{if(!pinnedDetail&&activeDetail===e.target){detailTip.hidden=true;activeDetail=null}});
  document.addEventListener('click',e=>{
    const picked=e.target.closest('[data-pick-index]');
    if(picked){
      e.preventDefault();e.stopPropagation();
      const playerId=picked.dataset.pickPlayer,skillId=Number(picked.dataset.pickSkill),eventIndex=Number(picked.dataset.pickIndex);
      closeDetail();chooseSkill(playerId,skillId,eventIndex);return;
    }
    const t=e.target.closest('[data-detail-title]');
    if(t){e.stopPropagation();if(pinnedDetail===t){closeDetail()}else showDetail(t,true)}else if(pinnedDetail)closeDetail()
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail()});
  window.addEventListener('resize',()=>{if(pinnedDetail)showDetail(pinnedDetail,true);else if(activeDetail)closeDetail()});
  function renderPanels(){
    const encounterMeta=(d.encounters||[]).find(e=>String(current.id).startsWith(String(e.id)+':'));
    const state=encounterMeta?(completed.get(String(encounterMeta.id))?'clear':'attempt'):'session';
    $('encounter-panel').className='panel encounter is-'+state;
    $('encounter-status').className='status '+state;
    $('encounter-status').textContent=state==='clear'?'Cleared':state==='attempt'?'Attempted':'Session';
    $('view-select').style.borderColor=state==='clear'?'#35ba78':state==='attempt'?'#dc5962':'#63758d';
    $('encounter').textContent=encounterMeta?encounterMeta.label:current.encounter;
    $('view-note').textContent='';
    $('phase-list').innerHTML=(current.boss?.phases||[]).map(p=>'<div class="muted" style="padding:3px 0">'+esc(p.name)+' · '+p.hp.length+' HP samples</div>').join('');
    $('other-targets').textContent=current.id==='session'?'Distinct targets: '+d.targets.join(', '):'';
    const allDamage=ps.reduce((s,p)=>s+p.damage,0),allDeaths=ps.reduce((s,p)=>s+p.deaths,0),minutes=v=>Math.floor(v/60)+'m '+Math.round(v%60)+'s';
    $('totals').innerHTML=[['DPS',n(allDamage/dur),''],['Deaths',n(allDeaths),''],['Total Damage',n(allDamage),''],['Duration',n(dur)+'s','title="'+esc(minutes(dur))+'"']].map(x=>'<div class="tile" '+x[2]+'><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
    for(const p of ps)if(!playerOrder.includes(p.id))playerOrder.push(p.id);
    const sorted=ps.slice().sort((a,b)=>manuallyOrdered?(playerOrder.indexOf(a.id)-playerOrder.indexOf(b.id)):(b.dps-a.dps));
    const panels=sorted.filter(p=>!hiddenPlayers.has(p.id)).map(p=>{
      const max=Math.max(1,...p.skills.map(s=>s.total));
      const skills=p.skills.map(s=>{
        const highRows=s.topHits.length?s.topHits.map((v,i)=>['#'+(i+1),n(v),s.topHitEventIndices[i]])
          .concat([['Average',n(s.averageHit)],['Lowest',n(s.lowestHit),s.lowestHitEventIndex]])
          :[['Hits','Individual values unavailable']];
        return '<tr data-skill-row data-player-id="'+esc(p.id)+'" data-skill-id="'+s.id+'"><td><button type="button" class="skill-select" data-player-id="'+esc(p.id)+'" data-skill-id="'+s.id+'" aria-pressed="false" title="Highlight this skill on the scatter chart">'+esc(s.name)+'</button></td><td class="bar-cell"><span class="fill" style="width:'+(100*s.total/max)+'%;background:'+skillBarPaint(p,s)+'"></span><span class="value">'+detailButton(n(s.dps),'Total damage',[['Damage',n(s.total)]])+'</span></td><td>'+detailButton(n(s.biggest),'Highest hits',highRows,undefined,p.id,s.id)+'</td><td>'+detailButton(s.hpm.toFixed(1),'Hits/min',[['Total hits',n(s.hitCount)]])+'</td><td>'+s.crit.toFixed(1)+'%</td></tr>';
      }).join('');
      return '<details data-player-id="'+esc(p.id)+'" class="panel player-panel" style="--arcana:'+p.color+';--arcana-header:'+arcanaHeader(p)+'"><summary><span class="player-name">'+esc(p.name)+(p.arcanaIdentities||[]).map(a=>' <span class="arcana-name" title="'+esc(a.name)+'" style="display:inline-block;font-size:.65rem;border-bottom:3px solid '+esc(a.color)+';margin-left:7px;vertical-align:middle">'+esc(a.name)+'</span>').join('')+'</span><span class="player-dps">'+n(p.dps)+(p.bossDps!==undefined?'<span class="boss-dps"> ('+n(p.bossDps)+')</span>':'')+'<small>DPS</small></span><span class="drag-handle" role="button" tabindex="0" aria-label="Drag to reorder '+esc(p.name)+'" title="Drag to reorder">⠿</span><button type="button" class="player-hide" data-id="'+esc(p.id)+'" title="Minimize player report" aria-label="Minimize '+esc(p.name)+'">×</button></summary><div class="player-skills"><table class="skills"><thead><tr><th>Skill</th><th>DPS</th><th>Highest Hit</th><th>Hits/min</th><th>Crit %</th></tr></thead><tbody>'+skills+'</tbody></table></div></details>';
    }).join('');
    const hidden=sorted.filter(p=>hiddenPlayers.has(p.id));
    $('players').innerHTML=panels+(hidden.length?'<div class="restore-row">'+hidden.map(p=>'<button type="button" data-restore="'+esc(p.id)+'">+ '+esc(p.name)+'</button>').join('')+'</div>':'');
    renderHaloPanel();markSelectedSkill();
  }
  renderPanels();
  $('view-select').value=[...encounterViews].find(([key,item])=>item.indices.includes(0))?.[0]||'';
  syncScope();
  // Pointer-based reordering works for mouse, pen and touch, including inside
  // <details><summary>. No HTML5 native drag/drop, which is unreliable here.
  // The DOM moves only; scatter/player indices and underlying data stay fixed.
  const panels=$('players');let reorder=null,suppressHandleClick=false;
  function clearReorder(){panels.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(el=>el.classList.remove('dragging','drop-before','drop-after'));}
  function intendedDrop(y){const siblings=[...panels.querySelectorAll('.player-panel')].filter(el=>el!==reorder?.panel);for(const el of siblings){const r=el.getBoundingClientRect();if(y<r.top+r.height/2)return {el,after:false};}return siblings.length?{el:siblings[siblings.length-1],after:true}:null;}
  function showDestination(dest){panels.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));if(dest)dest.el.classList.add(dest.after?'drop-after':'drop-before');}
  panels.addEventListener('pointerdown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||e.button!==0)return;e.preventDefault();e.stopPropagation();const panel=handle.closest('.player-panel');reorder={id:e.pointerId,handle,panel,startY:e.clientY,moved:false,dest:null};handle.setPointerCapture(e.pointerId)});
  panels.addEventListener('pointermove',e=>{if(!reorder||e.pointerId!==reorder.id)return;e.preventDefault();if(!reorder.moved&&Math.abs(e.clientY-reorder.startY)<5)return;reorder.moved=true;reorder.panel.classList.add('dragging');reorder.dest=intendedDrop(e.clientY);showDestination(reorder.dest)});
  function endReorder(e,cancel){if(!reorder||e.pointerId!==reorder.id)return;e.preventDefault();e.stopPropagation();const state=reorder;reorder=null;if(!cancel&&state.moved&&state.dest){panels.insertBefore(state.panel,state.dest.after?state.dest.el.nextSibling:state.dest.el);rememberPanelOrder()}clearReorder();if(state.handle.hasPointerCapture(e.pointerId))state.handle.releasePointerCapture(e.pointerId);suppressHandleClick=true;setTimeout(()=>{suppressHandleClick=false},0);}
  panels.addEventListener('pointerup',e=>endReorder(e,false));
  panels.addEventListener('pointercancel',e=>endReorder(e,true));
  // Prevent a reorder gesture from toggling the surrounding <details>.
  panels.addEventListener('click',e=>{if(e.target.closest('.drag-handle')||suppressHandleClick){e.preventDefault();e.stopPropagation();suppressHandleClick=false;}},true);
  // Keyboard alternative: focus the grip and press Up or Down.
  panels.addEventListener('keydown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||!['ArrowUp','ArrowDown','Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();const panel=handle.closest('.player-panel'),other=e.key==='ArrowUp'?panel.previousElementSibling:panel.nextElementSibling;if(e.key==='ArrowUp'&&other)panels.insertBefore(panel,other);if(e.key==='ArrowDown'&&other)panels.insertBefore(other,panel);rememberPanelOrder();});
  panels.addEventListener('click',e=>{
    const hide=e.target.closest('.player-hide'),restore=e.target.closest('[data-restore]');
    if(!hide&&!restore)return;
    e.preventDefault();e.stopPropagation();
    if(hide)hiddenPlayers.add(hide.dataset.id);
    if(restore)hiddenPlayers.delete(restore.dataset.restore);
    renderPanels();
  });
  let colors=[],on=new Set();const svg=$('chart'),tip=$('tip'),wrap=$('chart-wrap'),W=1000,H=390,P=55,chartEnd=H-47;
  let points=[],hp=[],hpSeries=[],duration=dur,min=0,max=duration,drag=null,markers=[],matchIndex=0;
  function setSvgHeight(height){
    const width=wrap.clientWidth||svg.clientWidth||1000;
    svg.style.height=(window.innerWidth<680?Math.max(165,Math.round(width*height/1000)):height)+'px';
  }
  let chartMode='damage',timelineUses=[],timelineHeight=390,timelineDots=[],timelineHitDots=[],timelineStart=0;
  const allUses=d.skillUseEvents||[],allHits=d.damageHitEvents||[];
  // The exact recorded hits are filtered to the same encounter and target
  // scope as each skill row; one-second scatter buckets are not hit identity.
  function hitInCurrentScope(h,bossTargets,excludedTargets){
    const at=Number(h.relativeMs),start=Number(current.start||0)*1000,end=start+Number(current.duration||0)*1000;
    if(!Number.isFinite(at)||at<start||at>end)return false;
    if(bossTargets&&!bossTargets.has(String(h.targetId)))return false;
    if(excludedTargets.has(String(h.targetId)))return false;
    return true;
  }
  // Skill-wide selection and an exact hit are independent layers. Either can
  // be active alone, and selecting an individual hit never resets the skill.
  function chooseSkill(playerId,skillId,eventIndex=null){
    const bossTargets=current.id.endsWith(':boss')?new Set(current.boss?.entityIds||[]):null;
    const excludedTargets=new Set(current.excludedTargetIds||[]);
    if(eventIndex===null){
      const same=selectedSkill?.playerId===playerId&&selectedSkill?.skillId===skillId;
      selectedSkill=same?null:{playerId,skillId};
      selectedSkillHits=selectedSkill?allHits.filter(h=>h.playerId===playerId&&h.skillId===skillId&&hitInCurrentScope(h,bossTargets,excludedTargets)):[];
    }else{
      selectedHit=allHits.find(h=>h.playerId===playerId&&h.skillId===skillId&&Number(h.eventIndex)===eventIndex&&hitInCurrentScope(h,bossTargets,excludedTargets))||null;
    }
    const i=ps.findIndex(p=>p.id===playerId);
    if(i>=0){on.add(i);const toggle=$('toggles').querySelector('input[data-i="'+i+'"]');if(toggle)toggle.checked=true}
    markSelectedSkill();
    if(eventIndex!==null&&selectedHit){
      const t=Number(selectedHit.relativeMs)/1000-Number(current.start||0);
      const span=Math.min(Math.max(1,duration),12);
      setWindow(t-span/2,span);
      $('chart-wrap').scrollIntoView({behavior:'smooth',block:'center'});
    }else render();
  }
  // The whole skill row is a convenient mouse/touch target; nested statistics
  // still open their own independent tooltips.
  $('players').addEventListener('click',e=>{
    if(e.target.closest('.stat-trigger,.detail-pick,[data-detail-title],.player-hide,.drag-handle'))return;
    const row=e.target.closest('tr[data-skill-row]');if(!row)return;
    e.preventDefault();e.stopPropagation();closeDetail();chooseSkill(row.dataset.playerId,Number(row.dataset.skillId));
  });
  $('skill-highlight-clear').addEventListener('click',()=>{selectedSkill=null;selectedSkillHits=[];markSelectedSkill();render()});
  $('skill-hit-clear').addEventListener('click',()=>{selectedHit=null;markSelectedSkill();render()});
  function getTimelineUses(){
    const startMs=Number(current.start||0)*1000,endMs=startMs+Number(current.duration||0)*1000;
    const isWholeSession=current.id==='session';
    // Correlate only observed use packets to actual following damage hits, using
    // same player + skill ID. A newer use of that skill supersedes an older
    // candidate; unresolved secondary effects remain separate hit evidence.
    const uses=allUses.filter(u=>isWholeSession||(u.relativeMs>=startMs&&u.relativeMs<=endMs))
      .map((u,index)=>({...u,index,t:(u.relativeMs-startMs)/1000,damage:0,bossDamage:0,hits:0,firstHitMs:null,matchedHits:[]}));
    const usesByKey=new Map();
    for(const u of uses){const key=u.playerId+':'+u.skillId;if(!usesByKey.has(key))usesByKey.set(key,[]);usesByKey.get(key).push(u)}
    const allowedTargets=current.id.endsWith(':boss')?new Set((current.boss?.entityIds)||[]):null;
    for(const hit of allHits){
      if((!isWholeSession&&(hit.relativeMs<startMs||hit.relativeMs>endMs))||hit.damage<=0)continue;
      const relevant=usesByKey.get(hit.playerId+':'+hit.skillId);
      if(!relevant)continue;
      // sorted by timestamp, assign to last activation of the same skill,
      // bounded to 30 seconds; do not infer a use from a hit.
      let lo=0,hi=relevant.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(relevant[mid].atMs<=hit.atMs)lo=mid+1;else hi=mid}
      const u=relevant[lo-1];if(!u||hit.atMs-u.atMs>30000)continue;
      u.damage+=hit.damage;u.hits++;u.matchedHits.push(hit);
      if(u.firstHitMs===null)u.firstHitMs=hit.atMs-u.atMs;
      if(!allowedTargets||allowedTargets.has(hit.targetId))u.bossDamage+=hit.damage;
    }
    return uses;
  }
  function renderSkillTimeline(){
    const startMs=Number(current.start||0)*1000;
    const displayed=timelineUses.filter(u=>u.t>=min&&u.t<=max&&on.has(ps.findIndex(p=>p.id===u.playerId)));
    const activePlayers=ps.filter((p,i)=>on.has(i));
    const laneHeight=38,top=34,bottomBand=58,left=135,right=28;
    timelineHeight=Math.max(210,top+activePlayers.length*laneHeight+bottomBand+32);
    svg.setAttribute('viewBox','0 0 1000 '+timelineHeight);
    setSvgHeight(timelineHeight);
    const x=t=>left+(t-min)/Math.max(.001,max-min)*(1000-left-right);
    let out='<line class="axis" x1="'+left+'" x2="972" y1="'+(timelineHeight-28)+'" y2="'+(timelineHeight-28)+'"/>';
    for(let i=0;i<=5;i++){const t=min+(max-min)*i/5;out+='<text x="'+x(t)+'" y="'+(timelineHeight-8)+'" fill="#adbcd0" font-size="12" text-anchor="middle">'+t.toFixed(max-min<10?1:0)+'s</text>'}
    const laneByID=new Map(activePlayers.map((p,i)=>[p.id,top+laneHeight*i]));
    for(const [i,p] of activePlayers.entries()){
      const yy=top+i*laneHeight;
      out+='<line class="timeline-lane" x1="'+left+'" x2="972" y1="'+(yy+12)+'" y2="'+(yy+12)+'"/>';
      out+='<text class="timeline-label" x="6" y="'+(yy+17)+'">'+esc(p.name.length>19?p.name.slice(0,18)+'…':p.name)+'</text>';
    }
    const noDamageY=top+activePlayers.length*laneHeight+12;
    out+='<rect class="no-damage-band" x="0" y="'+(noDamageY-15)+'" width="1000" height="46"/>';
    out+='<text class="timeline-label" x="6" y="'+(noDamageY+10)+'">No Damage Dealt</text>';
    timelineDots=displayed;timelineHitDots=[];
    const totalVisibleHits=displayed.reduce((count,u)=>count+u.matchedHits.filter(h=>(h.relativeMs-startMs)/1000>=min&&(h.relativeMs-startMs)/1000<=max).length,0);
    const hitStride=Math.max(1,Math.ceil(totalVisibleHits/3500));
    $('skill-note').dataset.sampled=hitStride>1?'yes':'no';
    displayed.forEach((u,i)=>{
      const p=ps.find(player=>player.id===u.playerId);if(!p)return;
      const yy=u.hits>0?(laneByID.get(u.playerId)||top)+12:noDamageY+7;
      const color=p.color||'#65b5e7';
      if(u.hits>0){
        // Individual hit diamonds retain their millisecond timestamps. Only
        // draw those inside the viewport, even for multi-hit skills.
        const hitsInView=u.matchedHits.filter(h=>(h.relativeMs-startMs)/1000>=min&&(h.relativeMs-startMs)/1000<=max);
        if(hitsInView.length){
          const last=hitsInView[hitsInView.length-1];
          out+='<line x1="'+Math.max(left,x(u.t))+'" x2="'+Math.min(972,x((last.relativeMs-startMs)/1000))+'" y1="'+(yy+8)+'" y2="'+(yy+8)+'" stroke="'+color+'" opacity=".30" stroke-width="2"/>';
        }
        for(let hIndex=0;hIndex<hitsInView.length;hIndex+=hitStride){
          const h=hitsInView[hIndex];
          const hx=x((h.relativeMs-startMs)/1000),hy=yy+8;
          const index=timelineHitDots.push({hit:h,use:u})-1;
          out+='<path class="hit-marker" data-hit="'+index+'" d="M'+hx+' '+(hy-3.4)+' L'+(hx+3.4)+' '+hy+' L'+hx+' '+(hy+3.4)+' L'+(hx-3.4)+' '+hy+' Z" fill="'+color+'" stroke="#bad1e9" stroke-width=".7"/>';
        }
      }
      out+='<circle class="use-dot" data-use="'+i+'" cx="'+x(u.t)+'" cy="'+yy+'" r="'+(u.hits?5:5.6)+'" fill="'+color+'" stroke="'+(u.hits?'#b9d3f3':'#f0c77c')+'" stroke-width="1.2"/>';
    });
    if(!displayed.length){out+='<text x="555" y="'+(top+30)+'" fill="#b5c5d8" text-anchor="middle" font-size="14">No observed Skill Use events in this time window / player selection</text>'}
    svg.innerHTML=out;
    if(hitStride>1)$('skill-note').textContent+=' Hit markers are sampled at this zoom level to keep the chart responsive; zoom in for individual hit markers. Hover totals still include all matched hits.';
  }

  function resetPlot(){
    // Scatter controls only toggle party members. Boss and encounter selection
    // are handled by the dedicated selectors; do not duplicate enemies here.
    // Enemy outgoing damage remains in the embedded export data for the Companion.
    actors=ps.map(p=>({...p,kind:'player'}));
    colors=actors.map(p=>p.color);on=new Set(actors.map((_,i)=>i));
    $('toggles').innerHTML=ps.map((p,i)=>'<label><input type="checkbox" checked data-i="'+i+'"> '+esc(p.name)+'</label>').join('');
    points=actors.flatMap((p,i)=>p.hits.map(h=>Object.assign({i},h))).map((h,index)=>({...h,index}));
    hp=current.boss?.hp||[];hpSeries=current.hpSeries||[];
    timelineUses=getTimelineUses();
    timelineStart=Math.min(0,timelineUses.reduce((m,u)=>Math.min(m,u.t),0));
    duration=Math.max(1,dur,points.reduce((m,h)=>Math.max(m,h.t),0),hp.reduce((m,h)=>Math.max(m,h[0]),0),timelineUses.reduce((m,u)=>Math.max(m,u.t),0));
    min=chartMode==='skill'?timelineStart:0;max=duration;drag=null;markers=[];matchIndex=0;$('match-label').textContent='';$('hp-prev').disabled=$('hp-next').disabled=true;
    render();
  }
  $('toggles').addEventListener('change',e=>{let i=Number(e.target.dataset.i);e.target.checked?on.add(i):on.delete(i);render()});
  function switchView(index){current=views[index]||views[0];ps=current.players;enemies=current.enemies||[];dur=Math.max(1,current.duration);selectedSkill=null;selectedHit=null;selectedSkillHits=[];closeDetail();renderPanels();syncScope();resetPlot()}
  $('view-select').addEventListener('change',()=>{const selected=encounterViews.get($('view-select').value);if(selected)switchView(selected.indices[0])});
  $('target-scope').addEventListener('change',e=>switchView(Number(e.target.value)));
  // Upward-only 0.20% tolerance: 49.79 -> 49, 49.80 -> 50.
  const hpBucket=v=>Math.floor(Number(v)+.200000001);
  function findMatches(wanted){
    const results=[];let start=-1,last=-1;
    for(let i=0;i<hp.length;i++){
      const current=hpBucket(hp[i][1]),prev=i?hpBucket(hp[i-1][1]):null;
      if(current===wanted){if(start<0)start=i;last=i;}
      else{
        if(start>=0){const a=hp[start][0],b=hp[Math.max(last+1,i)][0];results.push({a,b:b-a>20?b:null,p:hp[start][1]});start=-1;last=-1;}
        // Detect a sharp HP jump which passes the requested category between samples.
        if(prev!==null&&((prev>wanted&&current<wanted)||(prev<wanted&&current>wanted))){results.push({a:hp[i][0],b:null,p:hp[i][1]});}
      }
    }
    if(start>=0){const a=hp[start][0],b=hp[last][0];results.push({a,b:b-a>20?b:null,p:hp[start][1]});}
    return results;
  }
  function goMatch(index){if(!markers.length)return;matchIndex=(index+markers.length)%markers.length;const m=markers[matchIndex];const span=Math.max(35,Math.min(duration, max-min));min=Math.max(0,Math.min(duration-span,m.a-span/2));max=Math.min(duration,min+span);$('match-label').textContent=(matchIndex+1)+' / '+markers.length+' · '+m.a.toFixed(1)+'s'+(m.b!==null?' – '+m.b.toFixed(1)+'s':'');$('hp-prev').disabled=$('hp-next').disabled=markers.length<2;render()}
  function searchHP(){const val=Number($('hp-percent').value);if(!Number.isInteger(val)||val<0||val>100){$('match-label').textContent='Enter a whole % from 0–100';return;}markers=findMatches(val);if(!markers.length){$('match-label').textContent='No matching HP sample';$('hp-prev').disabled=$('hp-next').disabled=true;render();return;}goMatch(0)}
  $('hp-find').addEventListener('click',searchHP);$('hp-percent').addEventListener('keydown',e=>{if(e.key==='Enter')searchHP()});$('hp-prev').addEventListener('click',()=>goMatch(matchIndex-1));$('hp-next').addEventListener('click',()=>goMatch(matchIndex+1));$('hp-clear').addEventListener('click',()=>{markers=[];$('match-label').textContent='';$('hp-prev').disabled=$('hp-next').disabled=true;render()});
  function render(){svg.setAttribute('viewBox','0 0 1000 390');setSvgHeight(390);const visible=points.filter(h=>on.has(h.i)&&h.t>=min&&h.t<=max),bucketHigh=visible.reduce((m,h)=>Math.max(m,h.y),1),highest=selectedSkillHits.reduce((m,h)=>{const t=Number(h.relativeMs)/1000-Number(current.start||0);return t>=min&&t<=max?Math.max(m,Number(h.damage)||0):m},Math.max(bucketHigh,Number(selectedHit?.damage)||0)),x=t=>P+(t-min)/(max-min)*(W-P-30),y=v=>chartEnd-v/highest*(chartEnd-20),hy=p=>chartEnd-p/100*(chartEnd-20);let out='<line class="axis" x1="'+P+'" x2="'+(W-25)+'" y1="'+chartEnd+'" y2="'+chartEnd+'"/><line class="axis" x1="'+P+'" x2="'+P+'" y1="15" y2="'+chartEnd+'"/>';for(let i=0;i<=5;i++){const t=min+(max-min)*i/5;out+='<text x="'+x(t)+'" y="'+(H-14)+'" fill="#adbcd0" font-size="12" text-anchor="middle">'+Math.round(t)+'s</text>'}if(hp.length){const prior=hp.filter(p=>p[0]<=min).at(-1),inView=hp.filter(p=>p[0]>=min&&p[0]<=max),after=hp.find(p=>p[0]>=max);const line=[...(prior?[[min,prior[1]]]:[]),...inView,...(after?[[max,(inView.at(-1)||prior||after)[1]]]:[])];if(line.length>1){out+='<polyline class="hp-line" points="'+line.map(p=>x(p[0])+','+hy(p[1])).join(' ')+'"/>'}for(let i=0;i<=4;i++){let val=i*25;out+='<text x="'+(W-20)+'" y="'+(hy(val)+4)+'" fill="#e59a67" font-size="12" text-anchor="end">'+val+'%</text>'}}if(markers.length){const chosen=markers[matchIndex];if(chosen.b!==null){const lo=Math.max(min,chosen.a),hi=Math.min(max,chosen.b);if(hi>lo)out+='<rect class="mark-band" x="'+x(lo)+'" y="15" width="'+(x(hi)-x(lo))+'" height="'+(chartEnd-15)+'"/>'}for(const at of [chosen.a,...(chosen.b!==null?[chosen.b]:[])])if(at>=min&&at<=max)out+='<line class="mark-line" x1="'+x(at)+'" x2="'+x(at)+'" y1="15" y2="'+chartEnd+'"/>';}for(const series of hpSeries){const inView=series.hp.filter(p=>p[0]>=min&&p[0]<=max);if(inView.length>1){out+='<polyline class="hp-line" points="'+inView.map(p=>x(p[0])+','+hy(p[1])).join(' ')+'"/>';out+='<text x="'+x(inView[0][0])+'" y="'+Math.max(17,hy(inView[0][1])-8)+'" fill="#e59a67" font-size="10">'+esc(series.label)+'</text>';}}visible.forEach(h=>{
      const matching=!!selectedSkill&&actors[h.i]?.id===selectedSkill.playerId&&h.skills.some(sk=>sk.skillId===selectedSkill.skillId);
      out+='<circle class="dot'+(matching?' skill-scatter-bucket':'')+'" data-i="'+h.index+'" cx="'+x(h.t)+'" cy="'+y(h.y)+'" r="'+(matching?'6':'4.5')+'" fill="'+colors[h.i]+'" opacity="'+(selectedSkill&&!matching?'.23':'1')+'"/>';
    });
    if(selectedSkill){
      // One SVG path represents every individual recorded hit in view, even
      // when many hits share a millisecond or an aggregated scatter bucket.
      // It is deliberately pointer-transparent so existing chart inspection
      // stays usable; the chosen highest/lowest event receives its own marker.
      const inView=selectedSkillHits.filter(h=>{const t=Number(h.relativeMs)/1000-Number(current.start||0);return t>=min&&t<=max});
      const path=inView.map(h=>{const t=Number(h.relativeMs)/1000-Number(current.start||0),xx=x(t),yy=y(Number(h.damage));return 'M'+xx.toFixed(2)+' '+(yy-3).toFixed(2)+'l3 3 -3 3 -3 -3 Z'}).join(' ');
      if(path)out+='<path class="skill-hit-cloud" d="'+path+'"/>';
    }
    if(selectedHit){
        const t=Number(selectedHit.relativeMs)/1000-Number(current.start||0);
        if(t>=min&&t<=max){const xx=x(t),yy=y(Number(selectedHit.damage));
          out+='<line class="selected-hit-guide" x1="'+xx+'" x2="'+xx+'" y1="15" y2="'+chartEnd+'"/>';
          out+='<circle class="selected-hit-ring" cx="'+xx+'" cy="'+yy+'" r="11"/>';
          out+='<circle class="selected-hit-marker" cx="'+xx+'" cy="'+yy+'" r="6"/>';
        }
    }
    svg.innerHTML=out}function hide(){tip.hidden=true}function hover(e){if(drag){hide();return}const target=e.target;
    if(target instanceof SVGCircleElement&&target.classList.contains('selected-hit-marker')&&selectedHit){
      const p=ps.find(p=>p.id===selectedHit.playerId),skill=p?.skills.find(s=>s.id===selectedHit.skillId);
      const t=Number(selectedHit.relativeMs)/1000-Number(current.start||0);
      tip.innerHTML='<b>'+esc(p?.name||'Player')+'</b><div>'+esc(skill?.name||'Skill '+selectedHit.skillId)+' · '+t.toFixed(3)+'s</div><div><b>'+n(selectedHit.damage)+' damage</b>'+(selectedHit.critical?' · Critical':'')+'</div>';
      tip.hidden=false;const r=wrap.getBoundingClientRect(),tr=tip.getBoundingClientRect();
      tip.style.left=Math.max(5,Math.min(e.clientX-r.left+12,r.width-tr.width-5))+'px';
      tip.style.top=Math.max(5,Math.min(e.clientY-r.top+12,r.height-tr.height-5))+'px';return;
    }
    if(chartMode==='skill'){
    if(target instanceof SVGPathElement&&target.classList.contains('hit-marker')){
      const item=timelineHitDots[Number(target.dataset.hit)];if(!item){hide();return;}
      const u=item.use,h=item.hit;tip.innerHTML='<b>'+esc(u.playerName)+'</b><div>'+esc(u.skillName)+' · '+((h.relativeMs-Number(current.start||0)*1000)/1000).toFixed(3)+'s</div><div><b>'+n(h.damage)+' damage</b> · '+((h.atMs-u.atMs)/1000).toFixed(3)+'s after observed use'+(h.critical?' · Critical':'')+(h.delayed?' · Delayed':'')+'</div>';
      tip.hidden=false;const r=wrap.getBoundingClientRect(),tr=tip.getBoundingClientRect();let xx=e.clientX-r.left+14,yy=e.clientY-r.top+14;if(xx+tr.width>r.width)xx-=tr.width+28;if(yy+tr.height>r.height)yy-=tr.height+28;tip.style.left=Math.max(5,Math.min(xx,r.width-tr.width-5))+'px';tip.style.top=Math.max(5,Math.min(yy,r.height-tr.height-5))+'px';return;
    }
    if(!(target instanceof SVGCircleElement)||!target.classList.contains('use-dot')){hide();return;}
    const u=timelineDots[Number(target.dataset.use)];if(!u){hide();return;}
    const p=ps.find(p=>p.id===u.playerId);const playerColor=p?.color||'#65b5e7';
    tip.innerHTML='<b style="color:'+playerColor+'">'+esc(u.playerName)+'</b><div>'+esc(u.skillName)+' · '+u.t.toFixed(3)+'s</div><div>'+(u.hits?'<b>'+n(u.damage)+' damage</b> · '+n(u.hits)+' matched hit'+(u.hits===1?'':'s')+' · first hit '+(u.firstHitMs/1000).toFixed(3)+'s after use':'<b>No Damage Dealt</b> (no matching recorded hits)')+'</div>'+(current.id.endsWith(':boss')&&u.hits?'<div>Boss-recipient damage: '+n(u.bossDamage)+'</div>':'')+(u.targetId?'<div>Use target ID: '+esc(u.targetId)+'</div>':'');
    tip.hidden=false;const r=wrap.getBoundingClientRect(),tr=tip.getBoundingClientRect();let xx=e.clientX-r.left+14,yy=e.clientY-r.top+14;if(xx+tr.width>r.width)xx-=tr.width+28;if(yy+tr.height>r.height)yy-=tr.height+28;tip.style.left=Math.max(5,Math.min(xx,r.width-tr.width-5))+'px';tip.style.top=Math.max(5,Math.min(yy,r.height-tr.height-5))+'px';return;
  }if(!(target instanceof SVGCircleElement)||!target.classList.contains('dot')){hide();return}const hit=points[Number(target.dataset.i)];if(!hit)return;const hpAt=hp.reduce((last,s)=>s[0]<=hit.t?s[1]:last,null);tip.innerHTML='<b style="color:'+colors[hit.i]+'">'+esc(actors[hit.i].name)+'</b><div>'+hit.t.toFixed(1)+'s · <b>'+n(hit.y)+(actors[hit.i].kind==='enemy'?' outgoing enemy damage':' player damage')+'</b>'+(hpAt!==null?' · Boss '+hpAt.toFixed(2)+'%':'')+'</div>'+(hit.bossDamage&&current.id==='session'?'<div>Known boss damage: <b>'+n(hit.bossDamage)+'</b></div>':'')+hit.skills.map(s=>'<div>'+esc(s.name)+': '+n(s.damage)+' · '+n(s.hits)+' hits · '+n(s.crits)+' crits'+(s.bossDamage&&current.id==='session'?' · <b>'+n(s.bossDamage)+' to known bosses</b>':'')+'</div>').join('');tip.hidden=false;const r=wrap.getBoundingClientRect(),tr=tip.getBoundingClientRect();let left=e.clientX-r.left+14,top=e.clientY-r.top+14;if(left+tr.width>r.width)left-=tr.width+28;if(top+tr.height>r.height)top-=tr.height+28;tip.style.left=Math.max(5,Math.min(left,r.width-tr.width-5))+'px';tip.style.top=Math.max(5,Math.min(top,r.height-tr.height-5))+'px'}// Mouse users keep hover/wheel/pan. Touch uses tap to inspect, drag to pan and two fingers to zoom.
  const touches=new Map();let touchPan=null,touchPinch=null,hadPinch=false;
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const chartStart=()=>chartMode==='skill'?timelineStart:0;
  function setWindow(startAt,span){
    const start=chartStart(),total=Math.max(.001,duration-start);
    const actual=Math.max(Math.min(2,total),Math.min(total,span));
    min=Math.max(start,Math.min(duration-actual,startAt));max=min+actual;
    render();
  }
  function plotFraction(clientX){
    const matrix=svg.getScreenCTM();
    if(!matrix||!matrix.a)return .5;
    const x=(clientX-matrix.e)/matrix.a;
    return clamp01((x-P)/(W-P-30));
  }
  function beginPinch(){
    const [a,b]=[...touches.values()];if(!a||!b)return;
    const middle=(a.x+b.x)/2;
    touchPinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),span:max-min,anchor:min+(max-min)*plotFraction(middle)};
    touchPan=null;hadPinch=true;hide();
  }
  // A touch point can miss the tiny SVG circle even when it is visually close.
  // Find the closest rendered marker within a finger-sized radius on the screen.
  function closestMarker(clientX,clientY){
    const m=svg.getScreenCTM();if(!m)return null;
    let closest=null,d2=26*26;
    for(const mark of svg.querySelectorAll('circle.dot,circle.use-dot,circle.selected-hit-marker,path.hit-marker')){
      let x,y;
      if(mark instanceof SVGCircleElement){x=Number(mark.getAttribute('cx'));y=Number(mark.getAttribute('cy'))}
      else {const r=mark.getBBox();x=r.x+r.width/2;y=r.y+r.height/2}
      const dx=m.a*x+m.c*y+m.e-clientX,dy=m.b*x+m.d*y+m.f-clientY;
      const distance=dx*dx+dy*dy;
      if(distance<d2-0.01||(distance<=d2&&mark.classList.contains('selected-hit-marker'))){d2=distance;closest=mark}
    }
    return closest;
  }
  svg.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&!drag)hover(e)});
  svg.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hide()});
  svg.addEventListener('wheel',e=>{
    e.preventDefault();hide();
    const frac=plotFraction(e.clientX),center=min+(max-min)*frac;
    const span=(max-min)*(e.deltaY>0?1.2:.8);
    const actual=Math.max(Math.min(2,duration-chartStart()),Math.min(duration-chartStart(),span));
    setWindow(center-frac*actual,actual);
  },{passive:false});
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType!=='touch')return;
    if(e.pointerType==='touch'){
      e.preventDefault();touches.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
      if(touches.size===2)beginPinch();
      else if(touches.size===1){touchPan={id:e.pointerId,x:e.clientX,fromMin:min,fromMax:max};hadPinch=false}
    }else{drag=[e.clientX,min,max];hide()}
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'){
      const finger=touches.get(e.pointerId);if(!finger)return;
      finger.x=e.clientX;finger.y=e.clientY;
      if(Math.hypot(e.clientX-finger.startX,e.clientY-finger.startY)>7)finger.moved=true;
      if(touchPinch&&touches.size>=2){
        const [a,b]=[...touches.values()],dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
        const frac=plotFraction((a.x+b.x)/2),span=touchPinch.span*touchPinch.distance/dist;
        const actual=Math.max(Math.min(2,duration-chartStart()),Math.min(duration-chartStart(),span));
        setWindow(touchPinch.anchor-frac*actual,actual);
      }else if(touchPan&&finger.moved){
        hide();const matrix=svg.getScreenCTM(),width=Math.max(1,Math.abs((matrix?.a||1)*(W-P-30)));
        const change=(touchPan.x-e.clientX)/width*(touchPan.fromMax-touchPan.fromMin);
        setWindow(touchPan.fromMin+change,touchPan.fromMax-touchPan.fromMin);
      }
      return;
    }
    if(!drag)return;
    const matrix=svg.getScreenCTM(),width=Math.max(1,Math.abs((matrix?.a||1)*(W-P-30)));
    const change=(drag[0]-e.clientX)/width*(drag[2]-drag[1]);
    setWindow(drag[1]+change,drag[2]-drag[1]);
  });
  function finishPointer(e,cancel=false){
    if(e.pointerType==='touch'){
      const finger=touches.get(e.pointerId);
      const inspect=!!finger&&!cancel&&!hadPinch&&!finger.moved&&touches.size===1;
      touches.delete(e.pointerId);touchPinch=null;touchPan=null;
      if(touches.size===0)hadPinch=false;
      if(inspect){
        const mark=closestMarker(e.clientX,e.clientY);
        if(mark)hover({target:mark,clientX:e.clientX,clientY:e.clientY});
        else hide();
      }
    }else drag=null;
    if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
  }
  svg.addEventListener('pointerup',e=>finishPointer(e));
  svg.addEventListener('pointercancel',e=>finishPointer(e,true));
  svg.addEventListener('dblclick',()=>{hide();setWindow(chartStart(),duration-chartStart())});
  resetPlot();
  })();</script></body></html>`;
  return html;
}

export function buildPortableReportHTML(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = ''): string {
  return renderPortableReportHTML(buildPortableReportPayload(summary, title, scope, names, targetId), !!summary.healingIncomplete);
}

export function exportPortableReport(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = '', fallbackStart = 0): void {
  const html = buildPortableReportHTML(summary, title, scope, names, targetId);
  const filename = reportDownloadName([getReportNaming(summary,targetId,fallbackStart)],'html');
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
