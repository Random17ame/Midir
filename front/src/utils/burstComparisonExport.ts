import type { FightSummary, PlayerStats } from '@/protocols';
import { getSkillArcana, listArcanaIdentities } from './arcanaEncounter';
import { bestPlayerBurstWindow, normalizeBurstPlayerName, BURST_WINDOW_MS, type BurstRecord } from './burstLeaderboard';
import { PET_DAMAGE_SKILL_ID, PET_DAMAGE_SKILL_LABEL } from './petLabels';

/** Export is deliberately on demand: the leaderboard cache retains totals only. */
export class BurstRecordMismatchError extends Error {
  constructor(public readonly sessionId: string, playerName: string) {
    super(`${playerName}'s indexed burst no longer matches the saved recording.`);
    this.name = 'BurstRecordMismatchError';
  }
}

export interface ComparisonEvent {
  t: number; // milliseconds from the player's own winning window
  skillId: number;
  kind: 'hit' | 'use';
  damage?: number;
  critical?: boolean;
  petName?: string;
}
export interface ComparisonSkill {
  id: number;
  name: string;
  damage: number;
  hits: number;
  observedUses: number;
  largest: number;
}
export interface ComparisonPlayer {
  rank: number;
  name: string;
  arcanaName: string;
  arcanaColor: string;
  sessionName: string;
  sessionId: string;
  sessionStartMs: number | null; // Original recording date; distinct from the winning burst
  startMs: number;
  damage: number;
  hits: number;
  skills: ComparisonSkill[];
  events: ComparisonEvent[];
}

/** Match an indexed record to its exact player/segment before exporting hits. */
export function prepareBurstComparison(
  record: BurstRecord, summary: FightSummary, names: Record<number, string>, rank: number
): ComparisonPlayer {
  const start = Number(record.startMs), end = start + BURST_WINDOW_MS;
  if (!Number.isFinite(start) || !Number.isFinite(record.damage) || record.damage <= 0) {
    throw new Error('The saved leaderboard entry is invalid. Rebuild the index.');
  }
  for (const [entityId, p] of Object.entries(summary.players || {})) {
    // The saved player entity ID survives display-name corrections and is
    // scoped to this exact source recording. Older index entries use names.
    if (record.playerId
      ? String(p.id || entityId) !== record.playerId
      : normalizeBurstPlayerName(p.name || '') !== record.playerKey) continue;
    // Reuse the *same* rolling-window selection as the leaderboard index.
    // A second reconstruction followed by a fresh [start, start+30s) filter
    // can disagree with the actual winning slice for dense historical traces.
    const winning = bestPlayerBurstWindow(p, summary, record.arcanaName);
    if (!winning || winning.startMs !== start || winning.damage !== record.damage ||
      winning.hits !== record.hits) continue;
    const selected = winning.damageHits;
    if (!selected.length) continue;
    // Use markers are contextual observations, not inferred activations.
    // Keep them inside this recognized boss encounter, not other encounters
    // in the same recording (even when a new encounter changes Arcana).
    const activeEncounter = selected[0];
    const usesUntil = Math.min(end, activeEncounter.encounterEndMs + 1);
    const usesFrom = Math.max(start, activeEncounter.encounterStartMs);
    const events: ComparisonEvent[] = selected.map(h => ({
      kind: 'hit', t: h.atMs - start, skillId: h.skillId, damage: h.damage,
      critical: h.critical, ...(h.petName ? { petName: h.petName } : {})
    }));
    for (const use of p.skillActivations || []) {
      if (!Number.isFinite(use.atMs) || use.atMs < usesFrom || use.atMs >= usesUntil) continue;
      const arcana = getSkillArcana(Number(use.skillId))?.name;
      if (arcana && arcana !== record.arcanaName) continue;
      events.push({ kind: 'use', t: use.atMs - start, skillId: Number(use.skillId) });
    }
    events.sort((a, b) => a.t - b.t || (a.kind === 'use' ? -1 : 1));
    const skills = new Map<number, ComparisonSkill>();
    for (const event of events) {
      let sk = skills.get(event.skillId);
      if (!sk) {
        sk = { id: event.skillId,
          name: event.skillId === PET_DAMAGE_SKILL_ID ? PET_DAMAGE_SKILL_LABEL :
            names[event.skillId] || (event.skillId === 0 ? 'Other Damage' : `Skill ${event.skillId}`),
          damage: 0, hits: 0, observedUses: 0, largest: 0 };
        skills.set(sk.id, sk);
      }
      if (event.kind === 'hit') {
        sk.damage += event.damage || 0; sk.hits++; sk.largest = Math.max(sk.largest, event.damage || 0);
      } else sk.observedUses++;
    }
    const skillRows = [...skills.values()].sort((a, b) => b.damage - a.damage || a.id - b.id);
    const color = listArcanaIdentities().find(a => a.name === record.arcanaName)?.color || '#d88b48';
    return { rank, name: record.playerName, arcanaName: record.arcanaName, arcanaColor: color,
      sessionName: record.sessionName, sessionId: record.sessionId,
      sessionStartMs: Number.isFinite(Number(summary.startTime)) && Number(summary.startTime) > 0
        ? Number(summary.startTime) * 1000 : null,
      startMs: start, damage: record.damage, hits: record.hits,
      skills: skillRows, events };
  }
  throw new BurstRecordMismatchError(record.sessionId, record.playerName);
}

function embeddedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Self-contained, shareable side-by-side 30-second comparisons. */
export function buildBurstComparisonHTML(arcanaName: string, players: ComparisonPlayer[]): string {
  if (!players.length) throw new Error('Select at least one player for comparison.');
  const unique = new Set(players.map(p => normalizeBurstPlayerName(p.name)));
  if (unique.size !== players.length) throw new Error('A player can only appear once in an Arcana comparison.');
  if (players.some(p => p.arcanaName !== arcanaName)) throw new Error('Comparison players must share the selected Arcana.');
  const data = embeddedJson({ arcanaName, players, windowSeconds: BURST_WINDOW_MS / 1000 });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Midir · 30s Burst Comparison</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#e9f0f8;background:#101722}
*{box-sizing:border-box}body{margin:0;padding:20px;line-height:1.4}main{max-width:1540px;margin:auto}h1{font-size:1.42rem;margin:0}small,.muted{color:#a8b8cb}.subtitle{margin:4px 0 16px;color:#b6c9df}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.controls{display:flex;align-items:center;gap:9px}.controls button,.skill-filter{color:#e9f0f8;background:#27394e;border:1px solid #5a7190;border-radius:7px;padding:6px 9px;cursor:pointer}
.controls button:hover,.skill-filter:hover{background:#344c67}.controls button[aria-pressed="true"]{background:#466588;border-color:#91b7ec}
.overlay-view{margin-bottom:14px}.overlay-view[hidden]{display:none!important}.overlay-view .chartbox svg{min-height:270px}.overlay-legend{display:flex;gap:6px 12px;flex-wrap:wrap;margin:9px 0}.overlay-player{display:inline-flex;align-items:center;gap:6px;border:1px solid #506884;border-radius:6px;background:#22334a;color:#ebf2ff;padding:6px 9px;cursor:pointer;font-size:.78rem}.overlay-player[data-off="true"]{opacity:.4}.player-dot{width:11px;height:11px;border-radius:50%;display:inline-block;background:var(--player-color)}
.selection-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:.78rem;color:#cce1f6;margin:0 0 11px}.selection-bar[hidden]{display:none!important}.selection-label{border-left:3px solid #66c5fb;background:#223a52;padding:6px 9px;border-radius:4px}.selection-hit{border-left:3px solid #f0c85d;background:#3b3429;padding:6px 9px;border-radius:4px}.selection-bar button{background:#2a3c52;border:1px solid #647e9b;border-radius:5px;padding:5px 8px;color:#ebf2ff;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,365px),1fr));gap:13px;align-items:start}
.card{background:#1b2839;border:1px solid #40536b;border-radius:12px;min-width:0;overflow:hidden}.card-header{padding:13px 15px;background:#263950;border-top:4px solid var(--accent,#d88b48)}
.rank{font-size:.78rem;color:#aebdd0}.name{font-size:1.25rem;font-weight:750;overflow-wrap:anywhere}.value{font-variant-numeric:tabular-nums;font-weight:750}.mainstat{font-size:1.4rem}.meta{color:#bbc9d9;font-size:.78rem;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.statbox{background:#162435;border:1px solid #3c4c62;border-radius:7px;padding:8px}.statbox small{display:block;font-size:.7rem}
.body{padding:12px}.chartbox{position:relative;background:#152133;border:1px solid #35495f;border-radius:9px;padding:6px 5px}.chartbox svg{display:block;width:100%;height:auto;touch-action:none;user-select:none;cursor:crosshair}
.axis{stroke:#597087;stroke-width:1}.tick{fill:#91a8c0;font-size:12px}.mark{cursor:pointer}.mark:focus{outline:none;stroke:#fff;stroke-width:2}.mark.selected-skill{stroke:#e8f9ff;stroke-width:2.5}.mark.chosen-hit{stroke:#ffda63;stroke-width:4;filter:drop-shadow(0 0 5px #eebd42)}.chosen-guide{stroke:#f1d26b;stroke-width:1.5;stroke-dasharray:5 5;pointer-events:none}
.tip{position:absolute;z-index:9;background:#263a50;color:#edf5ff;border:1px solid #758eaa;box-shadow:0 8px 24px #000b;border-radius:9px;padding:10px;font-size:.79rem;max-width:min(270px,95%);min-width:140px;pointer-events:none}
.tip[hidden]{display:none}.tip strong{display:block;border-bottom:1px solid #4a6179;padding-bottom:5px;margin-bottom:6px;overflow-wrap:anywhere}.tip-row{display:flex;gap:12px;justify-content:space-between;padding:2px 0}.tip-row span{color:#b5c7d9}.tip-row b{font-variant-numeric:tabular-nums}
.legend{display:flex;gap:12px;font-size:.72rem;color:#b9c8da;margin:8px 0 0}.legend .dot{font-size:1.1rem;color:#f3bd66}.legend .diamond{color:#67c9dc}
.skills{margin-top:12px}.skills-title{font-weight:750;margin-bottom:6px;font-size:.9rem}.skill-row{display:grid;grid-template-columns:minmax(90px,1fr) 26px 86px 70px 76px;gap:8px;align-items:center;border-top:1px solid #33485f;padding:6px 0;font-size:.78rem}
.skill-filter{display:flex;align-items:center;text-align:left;border-color:transparent;background:transparent;padding:3px;min-width:0;gap:6px}.skill-filter[aria-pressed="true"]{background:#355e81;border-color:#97c9f9}.skill-visibility{border:1px solid #526981;background:#28394d;color:#cfe2f3;border-radius:5px;cursor:pointer;padding:3px;min-width:24px}.skill-visibility[data-off="true"]{opacity:.5}.skill-highest{border:0;border-bottom:1px dashed #7896b7;background:none;color:#ecf4ff;text-align:right;cursor:pointer;font:inherit;width:100%}.skill-highest:hover{color:#f8da82}.hit-options{display:flex;gap:5px;flex-wrap:wrap;padding:8px 3px;background:#17283b;border-top:1px solid #3c536d}.hit-options[hidden]{display:none!important}.hit-options button{background:#2b4058;border:1px solid #55708d;border-radius:5px;color:#e9f2ff;padding:5px 7px;cursor:pointer;font-size:.74rem}.hit-options button:hover{border-color:#f6d177}.grid.overlay-mode .card .chartbox,.grid.overlay-mode .card .legend{display:none}.swatch{height:10px;width:10px;border-radius:50%;flex:none}.skill-name{overflow:hidden;text-overflow:ellipsis}.skill-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.skill-num .muted{font-size:.68rem}
.track{height:4px;background:#2e4359;margin-top:3px;border-radius:3px;overflow:hidden}.track i{display:block;height:100%;background:var(--skill-color)}
.note{font-size:.75rem;color:#9fb3c9;margin:9px 0 0}button:focus-visible{outline:2px solid #b6dafe;outline-offset:2px}
@media(max-width:650px){body{padding:11px}.grid{grid-template-columns:1fr}.card-header{padding:11px}.body{padding:9px}}
@media print{body{background:white;color:black}.card{break-inside:avoid}.controls{display:none}}
</style></head><body><main><div class="head"><div><h1 id="heading"></h1><p class="subtitle">Personal Bests · best recorded 30-second windows aligned from 0–30s</p></div><div class="controls"><button id="side-mode" type="button" aria-pressed="true">Side by side</button><button id="overlay-mode" type="button" aria-pressed="false">Overlay</button><button id="reset" type="button">Reset zoom</button><small id="zoom-label">0–30s</small></div></div><div class="selection-bar" id="selection-bar" hidden><span class="selection-label" id="selected-skill-label" hidden></span><button id="clear-skill" type="button" hidden>Clear skill ×</button><span class="selection-hit" id="selected-hit-label" hidden></span><button id="clear-hit" type="button" hidden>Clear hit ×</button></div><section class="card overlay-view" id="overlay-view" hidden><div class="card-header"><div class="name">Overlaid 30-second windows</div><small>Each player aligned to the start of their own best burst</small></div><div class="body"><div class="chartbox" id="overlay-wrap"><svg id="overlay-chart" viewBox="0 0 660 270" role="img" aria-label="Overlaid damage hits and skill use observations"></svg><div class="tip" id="overlay-tip" hidden></div></div><div class="overlay-legend" id="overlay-legend"></div><small id="overlay-sample"></small></div></section><div class="grid" id="players"></div><p class="note">Dots: damage hits · Diamonds: observed uses. Hits are not cast counts. Each chart starts at that player’s best 30-second window.</p></main>
<script id="burst-data" type="application/json">${data}</script><script>
(()=>{'use strict';
const d=JSON.parse(document.getElementById('burst-data').textContent),$=id=>document.getElementById(id),n=x=>Math.round(Number(x)||0).toLocaleString(),sec=x=>(x/1000).toFixed(3),ns='http://www.w3.org/2000/svg';
const colors=['#edac5f','#67c9dc','#b487ef','#5bd5aa','#ed7d8a','#8aafff','#f0cf6a','#b3dc83','#e397c7','#a6b8d2'];
const allSkills=[...new Set(d.players.flatMap(p=>p.skills.map(s=>s.id)))];const colorsBySkill=new Map(allSkills.map((id,i)=>[id,colors[i%colors.length]]));
const sections=[];let range=[0,30000],overlayMode=false,selectedSkill=null,selectedHit=null,overlaySection=null;
const playerColors=['#edac5f','#67c9dc','#b487ef','#5bd5aa','#ed7d8a','#8aafff','#f0cf6a','#b3dc83'];
const overlayVisible=new Set(d.players.map((p,i)=>i));
const W=660,H=270,P=56,R=15,plotBottom=218,plotTop=16;
function recordedDate(ms){return Number.isFinite(ms)&&ms>0?new Date(ms).toLocaleString(): 'Not recorded';}
function elem(type,cls,text){const e=document.createElement(type);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
function svgEl(type,attrs){const e=document.createElementNS(ns,type);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
function tipRow(label,val){const row=elem('div','tip-row');row.append(elem('span','',label),elem('b','',val));return row;}
function showTip(section,event,clientX,clientY){const owner=section.overlay?sections[event._section].player:section.player;const skill=owner.skills.find(s=>s.id===event.skillId);const t=section.tip;t.replaceChildren();t.append(elem('strong','',skill?skill.name:'Skill '+event.skillId));if(section.overlay)t.append(tipRow('Player',owner.name));t.append(tipRow('Time',sec(event.t)+'s'));if(event.kind==='hit'){t.append(tipRow('Damage',n(event.damage)));if(event.critical)t.append(tipRow('Result','Critical'));if(event.petName)t.append(tipRow('Pet',event.petName));}else t.append(tipRow('Evidence','Observed skill use'));t.hidden=false;const b=section.wrap.getBoundingClientRect();let x=clientX-b.left+13,y=clientY-b.top+12;const tw=t.offsetWidth,th=t.offsetHeight;x=Math.max(4,Math.min(x,b.width-tw-4));y=Math.max(4,Math.min(y,b.height-th-4));t.style.left=x+'px';t.style.top=y+'px';}
function hideTips(){for(const s of sections)s.tip.hidden=true;if(overlaySection)overlaySection.tip.hidden=true;}
function clampWindow(start,width){width=Math.max(1400,Math.min(30000,width));start=Math.max(0,Math.min(30000-width,start));range=[start,start+width];$('zoom-label').textContent=(start/1000).toFixed(1)+'–'+((start+width)/1000).toFixed(1)+'s';hideTips();renderAll();}
function xPos(t){return P+(t-range[0])/(range[1]-range[0])*(W-P-R);}function timeAt(x){return range[0]+(x-P)/(W-P-R)*(range[1]-range[0]);}
function renderAll(){if(overlayMode&&overlaySection)draw(overlaySection);for(const s of sections)if(!overlayMode)draw(s);updateSelection();}
function updateSelection(){
  $('selection-bar').hidden=!selectedSkill&&!selectedHit;
  $('selected-skill-label').hidden=$('clear-skill').hidden=!selectedSkill;
  $('selected-hit-label').hidden=$('clear-hit').hidden=!selectedHit;
  if(selectedSkill){const p=sections[selectedSkill.section].player,sk=p.skills.find(a=>a.id===selectedSkill.skillId);
    $('selected-skill-label').textContent=p.name+' · '+(sk?sk.name:'Skill '+selectedSkill.skillId);}
  if(selectedHit){const p=sections[selectedHit.section].player,e=selectedHit.event;
    $('selected-hit-label').textContent=p.name+' · '+n(e.damage)+' at '+sec(e.t)+'s';}
  for(const [i,s] of sections.entries())for(const row of s.skillRows||[])row.button.setAttribute('aria-pressed',String(!!selectedSkill&&selectedSkill.section===i&&selectedSkill.skillId===row.skillId));
}
function selectSkill(section,skillId){
  if(selectedSkill&&selectedSkill.section===section&&selectedSkill.skillId===skillId)selectedSkill=null;
  else selectedSkill={section,skillId};
  if(overlayMode){overlayVisible.add(section);updateLegend();}
  hideTips();renderAll();(overlayMode?overlaySection.wrap:sections[section].wrap).scrollIntoView({behavior:'smooth',block:'nearest'});
}
function selectHit(section,event){
  selectedHit={section,event};if(overlayMode){overlayVisible.add(section);updateLegend();}
  if(!(event.t>=range[0]&&event.t<range[1]))clampWindow(event.t-4500,9000);else renderAll();
  (overlayMode?overlaySection.wrap:sections[section].wrap).scrollIntoView({behavior:'smooth',block:'nearest'});
}
function draw(s){
  const svg=s.svg;svg.replaceChildren();
  const enabledEvent=e=>s.overlay?(overlayVisible.has(e._section)&&sections[e._section].enabled.has(e.skillId)):s.enabled.has(e.skillId);
  const events=s.overlay?s.events:s.player.events;
  const hits=events.filter(e=>e.kind==='hit'&&enabledEvent(e)&&e.t>=range[0]&&e.t<range[1]);
  const uses=events.filter(e=>e.kind==='use'&&enabledEvent(e)&&e.t>=range[0]&&e.t<range[1]);
  // All players share one vertical scale in overlay mode, making hit heights comparable.
  const max=hits.reduce((m,h)=>Math.max(m,h.damage||0),1);
  // Keep overlaid hits visually legible even when the responsive SVG is
  // scaled down on a phone; marker coordinates remain on the same 0–30s axis.
  const viewportWidth=Math.max(1,svg.getBoundingClientRect().width||W);
  const baseRadius=s.overlay?Math.max(7.2,Math.min(14,7*W/viewportWidth)):5.8;
  for(let i=0;i<=4;i++){const y=plotTop+(plotBottom-plotTop)*i/4;svg.append(svgEl('line',{class:'axis',x1:P,x2:W-R,y1:y,y2:y,'stroke-opacity':'.22'}));}
  for(let i=0;i<=5;i++){const t=range[0]+(range[1]-range[0])*i/5,x=xPos(t);svg.append(svgEl('text',{class:'tick',x,y:H-12,'text-anchor':'middle'}));svg.lastChild.textContent=(t/1000).toFixed(1)+'s';}
  svg.append(svgEl('line',{class:'axis',x1:P,y1:plotTop,x2:P,y2:plotBottom}));svg.append(svgEl('line',{class:'axis',x1:P,y1:plotBottom,x2:W-R,y2:plotBottom}));
  for(let i=0;i<=3;i++){const value=max*i/3,y=plotBottom-(plotBottom-plotTop)*i/3;const el=svgEl('text',{class:'tick',x:P-6,y:y+4,'text-anchor':'end'});el.textContent=value>=1e6?(value/1e6).toFixed(1)+'m':value>=1e3?Math.round(value/1e3)+'k':Math.round(value);svg.append(el);}
  const matchSkill=e=>!!selectedSkill&&(s.overlay?e._section===selectedSkill.section:sections[selectedSkill.section]===s)&&e.skillId===selectedSkill.skillId;
  const matchHit=e=>!!selectedHit&&(s.overlay?e._section===selectedHit.section:sections[selectedHit.section]===s)&&(e._original||e)===selectedHit.event;
  const stride=Math.max(1,Math.ceil(hits.length/(s.overlay?2300:1700)));
  const addMarker=(e,isHit)=>{
    const x=xPos(e.t),y=isHit?plotBottom-((e.damage||0)/max)*(plotBottom-plotTop):242;
    const c=s.overlay?playerColors[e._section%playerColors.length]:(colorsBySkill.get(e.skillId)||'#a7b6c8');
    const skillOn=matchSkill(e),chosen=isHit&&matchHit(e);
    let mark;
    if(isHit)mark=svgEl('circle',{class:'mark'+(skillOn?' selected-skill':'')+(chosen?' chosen-hit':''),cx:x,cy:y,r:chosen?baseRadius+3:skillOn?baseRadius+1.8:baseRadius,fill:c,stroke:chosen?'#ffdb6e':skillOn?'#eefaff':'#152133','stroke-width':chosen?3.7:skillOn?2.2:.7,opacity:selectedSkill&&!skillOn&&!chosen?.22:1,tabindex:0});
    else mark=svgEl('polygon',{class:'mark'+(skillOn?' selected-skill':''),points:[x,y-7,x+7,y,x,y+7,x-7,y].join(' '),fill:c,stroke:'#fff','stroke-width':skillOn?2:.6,opacity:selectedSkill&&!skillOn?.3:1,tabindex:0});
    mark._burstEvent=e;mark.setAttribute('aria-label',(isHit?'Damage hit':'Observed skill use')+' at '+sec(e.t)+' seconds');
    mark.addEventListener('pointerenter',v=>{if(v.pointerType!=='touch'&&!s.pointerMoved)showTip(s,e,v.clientX,v.clientY);});
    mark.addEventListener('focus',()=>{const b=mark.getBoundingClientRect();showTip(s,e,b.left+b.width/2,b.top);});
    mark.addEventListener('click',v=>{v.stopPropagation();if(!s.pointerMoved){if(isHit)selectHit(s.overlay?e._section:sections.indexOf(s),e._original||e);showTip(s,e,v.clientX,v.clientY);}});
    svg.append(mark);
  };
  // Selected skills are never sampled, even in dense 30-second recordings.
  for(let i=0;i<hits.length;i++)if(i%stride===0||matchSkill(hits[i])||matchHit(hits[i]))addMarker(hits[i],true);
  for(const e of uses)addMarker(e,false);
  if(selectedHit){const e=selectedHit.event;
    if((s.overlay?overlayVisible.has(selectedHit.section):sections[selectedHit.section]===s)&&e.t>=range[0]&&e.t<range[1]){
      svg.insertBefore(svgEl('line',{class:'chosen-guide',x1:xPos(e.t),x2:xPos(e.t),y1:plotTop,y2:plotBottom}),svg.firstChild);
    }
  }
  s.sample.textContent=stride>1?'Dense chart: ordinary markers sampled for display. Selected skill hits remain complete.':'';
}
function attachGestures(s){
const svg=s.svg,pointers=new Map();let pinch=null,drag=null,hadPinch=false;
const svgX=e=>{const r=svg.getBoundingClientRect();return (e.clientX-r.left)/Math.max(1,r.width)*W;};
function nearest(clientX,clientY){let chosen=null,best=24;for(const mark of svg.querySelectorAll('.mark')){
  const r=mark.getBoundingClientRect(),dist=Math.hypot(clientX-r.left-r.width/2,clientY-r.top-r.height/2);
  if(dist<best){best=dist;chosen=mark;}
}return chosen;}
svg.addEventListener('wheel',e=>{e.preventDefault();const focal=timeAt(svgX(e));const width=(range[1]-range[0])*(e.deltaY>0?1.25:.8);clampWindow(focal-(focal-range[0])*width/(range[1]-range[0]),width);},{passive:false});
svg.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});s.pointerMoved=false;
  if(svg.setPointerCapture)svg.setPointerCapture(e.pointerId);
  if(pointers.size===2){const v=[...pointers.values()];pinch={distance:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),width:range[1]-range[0],middle:timeAt(svgX({clientX:(v[0].x+v[1].x)/2}))};drag=null;hadPinch=true;s.pointerMoved=true;}
  else drag={x:e.clientX,start:range[0],width:range[1]-range[0]};});
svg.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;
  const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{...prev,x:e.clientX,y:e.clientY});
  if(Math.hypot(prev.startX-e.clientX,prev.startY-e.clientY)>7)s.pointerMoved=true;
  if(pointers.size===2&&pinch){const v=[...pointers.values()],dist=Math.max(1,Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y));const width=pinch.width*pinch.distance/dist;clampWindow(pinch.middle-width/2,width);}
  else if(drag&&s.pointerMoved&&range[1]-range[0]<30000){const px=svg.getBoundingClientRect().width;const shift=-(e.clientX-drag.x)/Math.max(1,px)*drag.width;clampWindow(drag.start+shift,drag.width);}});
const finish=e=>{
  const inspect=!hadPinch&&!s.pointerMoved&&pointers.size===1;
  pointers.delete(e.pointerId);
  if(inspect){const mark=nearest(e.clientX,e.clientY);if(mark){if(mark._burstEvent.kind==='hit')selectHit(s.overlay?mark._burstEvent._section:sections.indexOf(s),mark._burstEvent._original||mark._burstEvent);showTip(s,mark._burstEvent,e.clientX,e.clientY);}else hideTips();}
  if(!pointers.size){drag=null;pinch=null;hadPinch=false;}
  if(svg.hasPointerCapture&&svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
};
svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',e=>{s.pointerMoved=true;finish(e);});
svg.addEventListener('pointerleave',()=>{if(!pointers.size)hideTips();});
}
function makeSection(p){const card=elem('section','card');card.style.setProperty('--accent',p.arcanaColor);const head=elem('header','card-header');head.append(elem('div','rank','#'+p.rank+' · '+p.arcanaName),elem('div','name',p.name));const stats=elem('div','stats');for(const [label,value] of [['30s Damage',n(p.damage)],['30s DPS',n(Math.round(p.damage/30))],['Recorded hits',n(p.hits)],['Session',p.sessionName],['Recorded',recordedDate(p.sessionStartMs)]]){const b=elem('div','statbox');b.append(elem('small','',label),elem('div',label==='Session'?'meta':'value',value));stats.append(b);}head.append(stats);card.append(head);
const body=elem('div','body');const wrap=elem('div','chartbox'),svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Individual damage hits and observed skill uses in a 30-second window'}),tip=elem('div','tip');tip.hidden=true;wrap.append(svg,tip);body.append(wrap);const legend=elem('div','legend');legend.append(elem('span','','● Damage hit'),elem('span','','◆ Observed use'));body.append(legend);const sample=elem('div','note');body.append(sample);
const rows=elem('div','skills');rows.append(elem('div','skills-title','Skill breakdown · select a skill to highlight its hits'));const enabled=new Set(p.skills.map(s=>s.id));let s={player:p,svg,wrap,tip,sample,enabled,skillRows:[],pointerMoved:false};for(const sk of p.skills){
  const row=elem('div','skill-row'),button=elem('button','skill-filter'),swatch=elem('span','swatch'),label=elem('span','skill-name',sk.name);
  swatch.style.background=colorsBySkill.get(sk.id);button.append(swatch,label);button.title='Highlight '+sk.name+' hits';button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>selectSkill(sections.indexOf(s),sk.id));
  const visibility=elem('button','skill-visibility','◉');visibility.title='Show or hide '+sk.name+' markers';visibility.setAttribute('aria-label',visibility.title);
  visibility.addEventListener('click',()=>{if(enabled.has(sk.id)){enabled.delete(sk.id);visibility.dataset.off='true';visibility.setAttribute('aria-pressed','false');}else{enabled.add(sk.id);visibility.dataset.off='false';visibility.setAttribute('aria-pressed','true');}renderAll();hideTips();});
  const total=elem('div','skill-num',n(sk.damage));
  const greatest=elem('button','skill-highest',n(sk.largest));greatest.title='Show largest and smallest individual hits';
  const options=elem('div','hit-options');options.hidden=true;options.style.gridColumn='1 / -1';
  const ordered=p.events.filter(e=>e.kind==='hit'&&e.skillId===sk.id).slice().sort((a,b)=>Number(b.damage)-Number(a.damage)||a.t-b.t);
  const chosen=ordered.slice(0,5);if(ordered.length&&ordered[ordered.length-1]&&!chosen.includes(ordered[ordered.length-1]))chosen.push(ordered[ordered.length-1]);
  for(let i=0;i<chosen.length;i++){const hit=chosen[i],pick=elem('button','',i===chosen.length-1&&i>=5?'Lowest: '+n(hit.damage):'#'+(i+1)+': '+n(hit.damage));pick.title='Locate hit at '+sec(hit.t)+'s';pick.addEventListener('click',()=>selectHit(sections.indexOf(s),hit));options.append(pick);}
  greatest.addEventListener('click',()=>{options.hidden=!options.hidden;});
  const detail=elem('div','skill-num',sk.hits+' hit'+(sk.hits===1?'':'s'));if(sk.observedUses)detail.append(elem('div','muted',sk.observedUses+' observed use'+(sk.observedUses===1?'':'s')));
  row.append(button,visibility,total,greatest,detail,options);rows.append(row);s.skillRows.push({button,skillId:sk.id});
}body.append(rows);card.append(body);$('players').append(card);sections.push(s);attachGestures(s);}
for(const p of d.players)makeSection(p);
const overlayWrap=$('overlay-wrap');overlaySection={overlay:true,wrap:overlayWrap,svg:$('overlay-chart'),tip:$('overlay-tip'),sample:$('overlay-sample'),events:sections.flatMap((s,i)=>s.player.events.map(e=>({...e,_section:i,_original:e}))),pointerMoved:false};
attachGestures(overlaySection);
function updateLegend(){const legend=$('overlay-legend');legend.replaceChildren();for(const [i,s] of sections.entries()){
  const b=elem('button','overlay-player'),dot=elem('i','player-dot'),name=elem('span','',s.player.name);
  b.style.setProperty('--player-color',playerColors[i%playerColors.length]);b.append(dot,name);b.dataset.off=String(!overlayVisible.has(i));b.setAttribute('aria-pressed',String(overlayVisible.has(i)));
  b.addEventListener('click',()=>{if(overlayVisible.has(i))overlayVisible.delete(i);else overlayVisible.add(i);updateLegend();renderAll();});legend.append(b);}}
updateLegend();
function setMode(mode){overlayMode=mode==='overlay';$('overlay-view').hidden=!overlayMode;$('players').classList.toggle('overlay-mode',overlayMode);
  $('overlay-mode').setAttribute('aria-pressed',String(overlayMode));$('side-mode').setAttribute('aria-pressed',String(!overlayMode));hideTips();renderAll();}
$('overlay-mode').addEventListener('click',()=>setMode('overlay'));$('side-mode').addEventListener('click',()=>setMode('side'));
$('clear-skill').addEventListener('click',()=>{selectedSkill=null;renderAll()});
$('clear-hit').addEventListener('click',()=>{selectedHit=null;renderAll()});
$('heading').textContent=d.arcanaName+' · 30s Burst Comparison';$('reset').addEventListener('click',()=>clampWindow(0,30000));document.addEventListener('pointerdown',e=>{if(!e.target.closest('.chartbox'))hideTips();});renderAll();
})();</script></body></html>`;
}

export function downloadBurstComparisonHTML(arcanaName: string, players: ComparisonPlayer[]): void {
  const html = buildBurstComparisonHTML(arcanaName, players);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `midir-burst-${arcanaName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-comparison.html`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
