import { buildCompanionExport } from './companionExport';
import { getGroupMemberTargetIds } from './targetGrouping';
import { findGate1Attempts } from './gate1Encounter';
import type { FightSummary } from '@/protocols';

type SkillRow = { name: string; total: number; dps: number; biggest: number; hpm: number; crit: number };
type ScatterHit = { t: number; y: number; skills: {name:string;damage:number;hits:number;crits:number}[] };
type ReportPlayer = {name:string;color:string;damage:number;dps:number;deaths:number;skills:SkillRow[];hits:ScatterHit[]};

// Self-contained HTML deliberately excludes raw packets, IDs, application attribution,
// and the records of unselected players. Shared target HP is public combat context.
export function buildPortableReportHTML(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = ''): string {
  const targetMembers = targetId ? getGroupMemberTargetIds(targetId, summary) : [];
  if (targetId && !targetMembers.length) throw new Error('Selected target has no data in this session.');
  const scopedTargets = new Set(targetMembers);
  // The primary target is the combat entity with the highest observed maximum HP.
  // Resolve it before building contributor labels so unidentified target entities
  // can be given an encounter name without exposing raw numeric identifiers.
  const allTargets = Object.entries(summary.targets || {});
  const hpMax = (t: (typeof allTargets)[number][1]) => (t.hpHistory || [])
    .reduce((max, h) => Math.max(max, Number(h.maxHp) || 0), 0);
  const namedTargets = allTargets.filter(([, t]) => t.name && t.name !== 'Unknown');
  namedTargets.sort((a, b) => hpMax(b[1]) - hpMax(a[1]));
  const bossEntry = namedTargets[0];
  const boss = bossEntry?.[1];
  const bossId = bossEntry?.[0];
  const anonymousHealing = /^(?:Unknown Caster|Misc\. Anonymous Healing)$/i;
  const selected = Object.values(summary.players || {}).filter(p =>
    (scope === 'all' || p.id === scope) &&
    !(scope === 'all' && anonymousHealing.test(p.name.trim()))
  );
  if (!selected.length) throw new Error('No selected player data is available.');
  const duration = Math.max(1, Number(summary.encounterDuration) || 1);
  const players: ReportPlayer[] = selected.map(p => {
    const damage = targetId ? (() => {
      const rows=targetMembers.map(id=>p.damageByTarget?.[id]).filter((x): x is NonNullable<typeof x>=>Boolean(x));
      const skills:Record<number,any>={};let totalDamage=0;
      for (const row of rows) { totalDamage+=Number(row.totalDamage||0);
        for (const [skillId,stat] of Object.entries(row.skills||{})) {
          const id=Number(skillId); const current=skills[id];
          if (!current) skills[id]={...stat};
          else {current.totalDamage+=Number(stat.totalDamage||0);current.count+=Number(stat.count||0);
            current.critCount+=Number(stat.critCount||0);current.maxDamage=Math.max(current.maxDamage||0,stat.maxDamage||0);}
        }
      }return {totalDamage,skills};
    })() : p.overallStats;
    const skills: SkillRow[] = Object.entries(damage?.skills || {})
      .filter(([id, stat]) => Number(id) !== 9999 && Number(stat?.totalDamage || 0) > 0)
      .map(([id, stat]) => {
        const hits = Number(stat.count || 0);
        const total = Number(stat.totalDamage || 0);
        return { name: names[Number(id)] || (Number(id) === 0 ? 'Other Damage' : `Skill ${id}`),
          total: Math.round(total), dps: Math.round(total / duration),
          biggest: Math.round(Number(stat.maxDamage || 0)),
          hpm: Math.round(hits * 60 / duration * 10) / 10,
          crit: hits ? Math.round(Number(stat.critCount || 0) / hits * 1000) / 10 : 0 };
      }).sort((a,b) => b.total - a.total);
    // The saved per-player scatter lacks a verified target ID on each hit.
    // Omit it for target-scoped reports rather than misrepresent whole-session hits.
    const hits: ScatterHit[] = (targetId ? [] : (p.skillUses || [])).map((evt:any) => ({
      t: Number(evt.timestamp || 0), y: Number(evt.totalDmg || 0),
      skills: (evt.skills || []).filter((sk:any)=>Number(sk.skillId)!==9999).map((sk:any) => ({
        name:names[Number(sk.skillId)] || `Skill ${sk.skillId}`, damage:Number(sk.damage || 0),
        hits:Number(sk.hitCount || 0), crits:Number(sk.critCount || 0) }))
    })).filter(h => Number.isFinite(h.t) && h.t >= 0 && Number.isFinite(h.y) && h.y > 0 && h.skills.length > 0);
    // The unidentified numeric contributor is the combat target in existing
    // saves. Rename for display only, leaving source IDs and event data intact.
    const isTargetEntity = p.id === bossId || (p.name.trim() === p.id && /^\d+$/.test(p.name.trim()));
    const displayName = isTargetEntity && boss ? boss.name : p.name;
    return {name:displayName, color:/^#[0-9a-fA-F]{6}$/.test(p.talentColor || '') ? p.talentColor! : '#65b5e7',
      damage: Math.round(Number(damage?.totalDamage || 0)), dps:Math.round(Number(damage?.totalDamage || 0)/duration),
      deaths:(p.deaths || []).length, skills, hits};
  }).filter(p => p.skills.length > 0);
  // Only contributors with actual damage skills belong in the player panels.
  // Target HP is exported separately as encounter context.
  // Select the combat target with the greatest recorded max HP, not the largest damage taken.
  // Drop entity IDs and raw event details from the exported payload.
  const targets = namedTargets.map(([, target]) => target)
    .filter(t => (t.hpHistory?.length || 0) > 0);
  // Prefer the paired Gate 1 boss for any report containing a complete
  // 7600 -> 7601 attempt, including All Targets reports. Never splice
  // forms from separate attempts.
  const gate1Attempts = findGate1Attempts(summary.targets || {});
  const logicalGate1 = targetId.startsWith('group_')
    ? gate1Attempts.find(a => 'group_'+a.firstEntityId === targetId)
    : !targetId ? gate1Attempts.find(a => Boolean(a.replacementEntityId)) : null;
  const selectedBoss = targetId ? (summary.targets || {})[targetMembers.find(id=>Boolean(summary.targets?.[id]?.hpHistory?.length)) || ''] : null;
  const hpBoss = logicalGate1 ? summary.targets[logicalGate1.firstEntityId] : (selectedBoss || targets[0]);
  // Preserve each raw entity's actual observed HP, plus a separate in-game
  // mechanic-percent series. The 7601 phase starts at 50% even when a
  // transient spawn sample incorrectly reports a new 100% max HP.
  const makeHp = (target: typeof hpBoss) => {
    const offset=target && Number(target.startTime)>0 && Number(summary.startTime)>0
      ? Math.max(0,Number(target.startTime)-Number(summary.startTime)):0;
    return (target?.hpHistory || []).filter(h=>Number.isFinite(Number(h.time)) && Number(h.maxHp)>0)
      .map(h=>[Math.max(0,Number(h.time)+offset),Math.max(0,Math.min(100,100*Number(h.currentHp)/Number(h.maxHp)))] as [number,number])
      .sort((a,b)=>a[0]-b[0]);
  };
  const hp = makeHp(hpBoss);
  const gate1Phases: {raceId:number;name:string;hp:[number,number][]}[] = [];
  if(logicalGate1?.replacementEntityId){
    const first=summary.targets[logicalGate1.firstEntityId];
    const second=summary.targets[logicalGate1.replacementEntityId];
    const firstHp=makeHp(first);
    const secondHp=makeHp(second).map(([time,value])=>[time,Math.min(50,value)] as [number,number]);
    gate1Phases.push({raceId:7600,name:'Vertrag of the Deep Roots — first form (7600)',hp:firstHp});
    gate1Phases.push({raceId:7601,name:'Vertrag of the Deep Roots — second form (7601)',hp:secondHp});
    hp.splice(0,hp.length,...firstHp,...secondHp);
    hp.sort((a,b)=>a[0]-b[0]);
  }
  const uniqueTargets = [...new Set(namedTargets.map(([,t])=>t.name).filter(n=>n && n !== 'Unknown'))].slice(0, 8);
  const payload = JSON.stringify({selectedTargetId:targetId || null, selectedTargetIds:targetMembers, targetScope:targetId?'selected-target':'all-targets', title: scope === 'all' ? title : `${selected[0].name} — Combat Report`,
    duration: Math.round(duration), players, encounter: (selectedBoss?.name || boss?.name) || uniqueTargets[0] || 'Unknown encounter',
    targets:uniqueTargets, boss: hpBoss ? {name:hpBoss.name,hp,phases:gate1Phases} : null,
    companion:buildCompanionExport(summary, title, scope, names, targetId)
  }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Combat Report</title><style>
  :root{color-scheme:dark;font:15px system-ui,sans-serif;background:#111823;color:#edf2f8}body{max-width:1200px;margin:auto;padding:20px}h1{font-size:1.65rem;margin-bottom:5px}h2{font-size:1.12rem}.muted{color:#9caac0}.top{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.tile,.panel{background:#1b2635;border:1px solid #37475a;border-radius:11px;padding:15px}.tile b{display:block;font-size:1.65rem;margin-top:5px;font-variant-numeric:tabular-nums}.tile span{color:#a9b7ca}.panel{margin-top:15px}.encounter{margin:16px 0 20px;border-left:4px solid #d9a963}.encounter strong{font-size:1.25rem}.player-panel{margin-top:19px;padding:0;overflow:hidden}.player-panel summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 17px;background:var(--arcana-header);color:#fff;font-size:1.26rem;font-weight:750;border-left:5px solid var(--arcana);position:relative;min-height:34px}.player-panel summary .player-name{flex:1;min-width:0;overflow-wrap:anywhere}.player-panel summary .player-dps{position:absolute;left:50%;transform:translateX(-50%);text-align:center;font-size:1.15rem;font-weight:800;white-space:nowrap;pointer-events:none}.player-panel summary .player-dps small{display:block;font-size:.67rem;font-weight:600;opacity:.85}.player-panel summary .drag-handle{margin-left:auto;cursor:grab;touch-action:none;border-radius:6px;padding:4px 7px;user-select:none;font-size:1.2rem;color:#fff;opacity:.85}.player-panel summary .drag-handle:active{cursor:grabbing}.player-panel.dragging{opacity:.55}.player-panel.drop-before{box-shadow:0 -4px 0 #f2c773}.player-panel.drop-after{box-shadow:0 4px 0 #f2c773}.player-panel summary::-webkit-details-marker{display:none}.player-panel summary::before{content:'▸';font-size:.84rem;opacity:.85;transition:transform .15s}.player-panel[open] summary::before{transform:rotate(90deg)}.player-panel summary:hover{filter:brightness(1.13)}.player-skills{padding:8px 15px 15px}.skills{width:100%;border-collapse:collapse;font-size:.91rem}.skills th,.skills td{text-align:right;padding:12px 9px;border-bottom:1px solid #334154}.skills th:first-child,.skills td:first-child{text-align:left}.skills tr:hover{background:#263549}.bar-cell{position:relative;min-width:150px}.bar-cell .fill{position:absolute;top:5px;bottom:5px;left:0;opacity:.45;border-radius:4px;pointer-events:none}.bar-cell .value{position:relative;font-weight:700}.controls{display:flex;gap:9px;flex-wrap:wrap}.controls label{background:#26364a;border-radius:7px;padding:7px 10px;cursor:pointer}#chart-wrap{position:relative}svg{display:block;width:100%;height:390px;background:#152132;border-radius:8px;touch-action:none;cursor:crosshair}.dot:hover{stroke:white;stroke-width:2;opacity:1}.axis{stroke:#60728a;stroke-width:1}#tip{position:absolute;z-index:5;pointer-events:none;background:#202d3e;color:#f1f5fb;border:1px solid #71859d;box-shadow:0 8px 26px #000b;border-radius:9px;padding:11px 13px;max-width:290px;font-size:.86rem;line-height:1.55}#tip[hidden]{display:none}.hp-line{fill:none;stroke:#e59a67;stroke-width:2.3;stroke-linejoin:round;opacity:.95}.mark-line{stroke:#e4bb70;stroke-width:1.7;stroke-dasharray:5 4}.mark-band{fill:#e4bb70;fill-opacity:.11}.hp-search{margin:12px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hp-search input{width:74px;background:#152132;color:#fff;border:1px solid #63758d;border-radius:6px;padding:7px}.hp-search button{background:#34465f;color:#fff;border:1px solid #63758d;border-radius:6px;padding:7px 10px;cursor:pointer}.hp-search button:disabled{opacity:.4}.hp-search #match-label{color:#9caac0;font-size:.84rem}small{font-size:.78rem}@media(max-width:620px){.top{grid-template-columns:repeat(2,minmax(0,1fr))}.tile b{font-size:1.25rem}.skills{font-size:.75rem}.skills th,.skills td{padding:8px 4px}.player-panel summary .player-dps{position:static;transform:none;font-size:.95rem}.player-panel summary .player-name{flex:1}}
  </style></head><body><h1 id="title"></h1><div class="panel encounter"><span class="muted">Combat Target</span><div><strong id="encounter"></strong></div><small class="muted" id="other-targets"></small></div><div class="top" id="totals"></div><div class="panel"><h2>Damage Scatter &amp; Boss HP</h2><p class="muted">Hover for hit details · Wheel to zoom · Drag to pan · Double-click to reset · Orange line: target HP % (right axis)</p><div class="controls" id="toggles"></div><div class="hp-search"><label for="hp-percent">Find boss HP %</label><input id="hp-percent" type="number" min="0" max="100" step="1" value="50"><button id="hp-find">Find</button><button id="hp-prev" disabled title="Previous match">◀</button><button id="hp-next" disabled title="Next match">▶</button><button id="hp-clear">Clear</button><span id="match-label" aria-live="polite"></span></div><div id="phase-list"></div><div id="chart-wrap"><svg id="chart" viewBox="0 0 1000 390" aria-label="Damage events and boss health through the encounter"></svg><div id="tip" hidden role="tooltip"></div></div></div><div id="players"></div>
  <script type="application/json" id="data">${payload}</script><script>
  (()=>{const d=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id),n=v=>Math.round(v||0).toLocaleString(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));$('title').textContent=d.title;$('encounter').textContent=d.encounter;$('phase-list').innerHTML=(d.boss?.phases||[]).map(p=>'<div class="muted" style="padding:3px 0">'+esc(p.name)+' · '+p.hp.length+' HP samples</div>').join('');$('other-targets').textContent=d.targets.length>1?'Other targets: '+d.targets.filter(x=>x!==d.encounter).join(', '):'';const headerColor=hex=>{let c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);let scale=1;while(lum(c.map(v=>v*scale))>.18)scale*=.9;return '#'+c.map(v=>Math.round(v*scale).toString(16).padStart(2,'0')).join('')};const ps=d.players,dur=Math.max(1,d.duration),allDamage=ps.reduce((s,p)=>s+p.damage,0),allDeaths=ps.reduce((s,p)=>s+p.deaths,0),minutes=v=>Math.floor(v/60)+'m '+(v%60)+'s';$('totals').innerHTML=[['DPS',n(allDamage/dur),''],['Deaths',n(allDeaths),''],['Total Damage',n(allDamage),''],['Duration',n(dur)+'s','title="'+esc(minutes(dur))+'"']].map(x=>'<div class="tile" '+x[2]+'><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');$('players').innerHTML=ps.map(p=>{const max=Math.max(1,...p.skills.map(s=>s.total));return '<details class="panel player-panel" style="--arcana:'+p.color+';--arcana-header:'+headerColor(p.color)+'"><summary><span class="player-name">'+esc(p.name)+'</span><span class="player-dps">'+n(p.skills.reduce((sum,skill)=>sum+skill.total,0)/dur)+'<small>DPS</small></span><span class="drag-handle" role="button" tabindex="0" aria-label="Drag to reorder '+esc(p.name)+'" title="Drag to reorder">⠿</span></summary><div class="player-skills"><table class="skills"><thead><tr><th>Skill</th><th>DPS (hover: total)</th><th>Highest Hit</th><th>Hits/min</th><th>Crit %</th></tr></thead><tbody>'+p.skills.map(s=>'<tr><td>'+esc(s.name)+'</td><td class="bar-cell" title="Total damage: '+n(s.total)+'"><span class="fill" style="width:'+(100*s.total/max)+'%;background:'+p.color+'"></span><span class="value">'+n(s.dps)+'</span></td><td>'+n(s.biggest)+'</td><td>'+s.hpm.toFixed(1)+'</td><td>'+s.crit.toFixed(1)+'%</td></tr>').join('')+'</tbody></table></div></details>'}).join('');
  // Pointer-based reordering works for mouse, pen and touch, including inside
  // <details><summary>. No HTML5 native drag/drop, which is unreliable here.
  // The DOM moves only; scatter/player indices and underlying data stay fixed.
  const panels=$('players');let reorder=null,suppressHandleClick=false;
  function clearReorder(){panels.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(el=>el.classList.remove('dragging','drop-before','drop-after'));}
  function intendedDrop(y){const siblings=[...panels.querySelectorAll('.player-panel')].filter(el=>el!==reorder?.panel);for(const el of siblings){const r=el.getBoundingClientRect();if(y<r.top+r.height/2)return {el,after:false};}return siblings.length?{el:siblings[siblings.length-1],after:true}:null;}
  function showDestination(dest){panels.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));if(dest)dest.el.classList.add(dest.after?'drop-after':'drop-before');}
  panels.addEventListener('pointerdown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||e.button!==0)return;e.preventDefault();e.stopPropagation();const panel=handle.closest('.player-panel');reorder={id:e.pointerId,handle,panel,startY:e.clientY,moved:false,dest:null};handle.setPointerCapture(e.pointerId)});
  panels.addEventListener('pointermove',e=>{if(!reorder||e.pointerId!==reorder.id)return;e.preventDefault();if(!reorder.moved&&Math.abs(e.clientY-reorder.startY)<5)return;reorder.moved=true;reorder.panel.classList.add('dragging');reorder.dest=intendedDrop(e.clientY);showDestination(reorder.dest)});
  function endReorder(e,cancel){if(!reorder||e.pointerId!==reorder.id)return;e.preventDefault();e.stopPropagation();const state=reorder;reorder=null;if(!cancel&&state.moved&&state.dest){panels.insertBefore(state.panel,state.dest.after?state.dest.el.nextSibling:state.dest.el)}clearReorder();if(state.handle.hasPointerCapture(e.pointerId))state.handle.releasePointerCapture(e.pointerId);suppressHandleClick=true;setTimeout(()=>{suppressHandleClick=false},0);}
  panels.addEventListener('pointerup',e=>endReorder(e,false));
  panels.addEventListener('pointercancel',e=>endReorder(e,true));
  // Prevent a reorder gesture from toggling the surrounding <details>.
  panels.addEventListener('click',e=>{if(e.target.closest('.drag-handle')||suppressHandleClick){e.preventDefault();e.stopPropagation();suppressHandleClick=false;}},true);
  // Keyboard alternative: focus the grip and press Up or Down.
  panels.addEventListener('keydown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||!['ArrowUp','ArrowDown','Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();const panel=handle.closest('.player-panel'),other=e.key==='ArrowUp'?panel.previousElementSibling:panel.nextElementSibling;if(e.key==='ArrowUp'&&other)panels.insertBefore(panel,other);if(e.key==='ArrowDown'&&other)panels.insertBefore(other,panel);});
  const colors=ps.map(p=>p.color),on=new Set(ps.map((_,i)=>i));$('toggles').innerHTML=ps.map((p,i)=>'<label><input type="checkbox" checked data-i="'+i+'"> '+esc(p.name)+'</label>').join('');$('toggles').addEventListener('change',e=>{let i=Number(e.target.dataset.i);e.target.checked?on.add(i):on.delete(i);render()});const svg=$('chart'),tip=$('tip'),wrap=$('chart-wrap'),W=1000,H=390,P=55,chartEnd=H-47,points=ps.flatMap((p,i)=>p.hits.map(h=>Object.assign({i},h))).map((h,index)=>({...h,index})),hp=d.boss?.hp||[],duration=Math.max(1,dur,points.reduce((m,h)=>Math.max(m,h.t),0),hp.reduce((m,h)=>Math.max(m,h[0]),0));let min=0,max=duration,drag=null,markers=[],matchIndex=0;
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
  function render(){const visible=points.filter(h=>on.has(h.i)&&h.t>=min&&h.t<=max),highest=visible.reduce((m,h)=>Math.max(m,h.y),1),x=t=>P+(t-min)/(max-min)*(W-P-30),y=v=>chartEnd-v/highest*(chartEnd-20),hy=p=>chartEnd-p/100*(chartEnd-20);let out='<line class="axis" x1="'+P+'" x2="'+(W-25)+'" y1="'+chartEnd+'" y2="'+chartEnd+'"/><line class="axis" x1="'+P+'" x2="'+P+'" y1="15" y2="'+chartEnd+'"/>';for(let i=0;i<=5;i++){const t=min+(max-min)*i/5;out+='<text x="'+x(t)+'" y="'+(H-14)+'" fill="#adbcd0" font-size="12" text-anchor="middle">'+Math.round(t)+'s</text>'}if(hp.length){const prior=hp.filter(p=>p[0]<=min).at(-1),inView=hp.filter(p=>p[0]>=min&&p[0]<=max),after=hp.find(p=>p[0]>=max);const line=[...(prior?[[min,prior[1]]]:[]),...inView,...(after?[[max,(inView.at(-1)||prior||after)[1]]]:[])];if(line.length>1){out+='<polyline class="hp-line" points="'+line.map(p=>x(p[0])+','+hy(p[1])).join(' ')+'"/>'}for(let i=0;i<=4;i++){let val=i*25;out+='<text x="'+(W-20)+'" y="'+(hy(val)+4)+'" fill="#e59a67" font-size="12" text-anchor="end">'+val+'%</text>'}}if(markers.length){const chosen=markers[matchIndex];if(chosen.b!==null){const lo=Math.max(min,chosen.a),hi=Math.min(max,chosen.b);if(hi>lo)out+='<rect class="mark-band" x="'+x(lo)+'" y="15" width="'+(x(hi)-x(lo))+'" height="'+(chartEnd-15)+'"/>'}for(const at of [chosen.a,...(chosen.b!==null?[chosen.b]:[])])if(at>=min&&at<=max)out+='<line class="mark-line" x1="'+x(at)+'" x2="'+x(at)+'" y1="15" y2="'+chartEnd+'"/>';}visible.forEach(h=>{out+='<circle class="dot" data-i="'+h.index+'" cx="'+x(h.t)+'" cy="'+y(h.y)+'" r="4.5" fill="'+colors[h.i]+'"/>'});svg.innerHTML=out}function hide(){tip.hidden=true}function hover(e){if(drag){hide();return}const target=e.target;if(!(target instanceof SVGCircleElement)||!target.classList.contains('dot')){hide();return}const hit=points[Number(target.dataset.i)];if(!hit)return;const hpAt=hp.reduce((last,s)=>s[0]<=hit.t?s[1]:last,null);tip.innerHTML='<b style="color:'+colors[hit.i]+'">'+esc(ps[hit.i].name)+'</b><div>'+hit.t.toFixed(1)+'s · <b>'+n(hit.y)+' damage</b>'+(hpAt!==null?' · Boss '+hpAt.toFixed(2)+'%':'')+'</div>'+hit.skills.map(s=>'<div>'+esc(s.name)+': '+n(s.damage)+' · '+n(s.hits)+' hits · '+n(s.crits)+' crits</div>').join('');tip.hidden=false;const r=wrap.getBoundingClientRect(),tr=tip.getBoundingClientRect();let left=e.clientX-r.left+14,top=e.clientY-r.top+14;if(left+tr.width>r.width)left-=tr.width+28;if(top+tr.height>r.height)top-=tr.height+28;tip.style.left=Math.max(5,Math.min(left,r.width-tr.width-5))+'px';tip.style.top=Math.max(5,Math.min(top,r.height-tr.height-5))+'px'}svg.addEventListener('pointermove',hover);svg.addEventListener('pointerleave',hide);svg.addEventListener('wheel',e=>{e.preventDefault();hide();const rect=svg.getBoundingClientRect(),ratio=Math.min(.98,Math.max(.02,(e.clientX-rect.left)/rect.width)),center=min+(max-min)*ratio,span=Math.min(duration,Math.max(2,(max-min)*(e.deltaY>0?1.2:.8)));min=Math.max(0,Math.min(duration-span,center-ratio*span));max=min+span;render()},{passive:false});svg.addEventListener('pointerdown',e=>{drag=[e.clientX,min,max];hide();svg.setPointerCapture(e.pointerId)});svg.addEventListener('pointermove',e=>{if(!drag)return;const shift=(drag[0]-e.clientX)/svg.clientWidth*(drag[2]-drag[1]);min=Math.max(0,Math.min(duration-(drag[2]-drag[1]),drag[1]+shift));max=min+drag[2]-drag[1];render()});svg.addEventListener('pointerup',e=>{drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId)});svg.addEventListener('dblclick',()=>{hide();min=0;max=duration;render()});render();
  })();</script></body></html>`;
  return html;
}

export function exportPortableReport(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = ''): void {
  const html = buildPortableReportHTML(summary, title, scope, names, targetId);
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='combat-report.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
