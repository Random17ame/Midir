import type { FightSummary, ConditionStats } from '@/protocols';
import { findGate1Attempts, gate1EffectiveHp } from './gate1Encounter';
import { findGlennAttempts } from './glennEncounter';
import { getGroupMemberTargetIds } from './targetGrouping';

// Versioned, intentionally conservative exchange format. All times are seconds
// relative to the encounter start; null means the source cannot establish it.
function finite(value: unknown): number | null {
  const number = Number(value);
  return value === undefined || value === null || !Number.isFinite(number) ? null : number;
}
function relative(value: unknown, origin: number | null): number | null {
  const at = finite(value);
  return at === null || origin === null || at <= 0 ? null : at - origin;
}
function conditions(source: Record<number, ConditionStats> | undefined, origin: number | null) {
  return Object.entries(source || {}).flatMap(([id, entry]) => (entry.intervals || []).map(interval => ({
    conditionId: Number(id), start: relative(interval.start, origin), end: relative(interval.end, origin),
    attackerId: String(interval.attackerId || '') || null, metadata: interval.metaData || null,
    evidence: 'saved-condition-interval'
  })).filter(item => item.start !== null && item.end !== null && item.end >= item.start));
}

export function buildCompanionExport(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = '') {
  const start = finite(summary.startTime);
  const duration = finite(summary.encounterDuration);
  const selected = Object.values(summary.players || {}).filter(p => (scope === 'all' || p.id === scope) &&
    !/^(?:Unknown Caster|Misc\. Anonymous Healing)$/i.test(p.name.trim()));
  const targetMembers=targetId?getGroupMemberTargetIds(targetId,summary):[];
  const players = selected.map(p => ({
    entityId: String(p.id), name: p.name, arcana: p.talentName || null,
    deathTimes: (p.deaths || []).map(at => relative(at, start)).filter((at): at is number => at !== null && at >= 0 && (duration === null || at <= duration)),
    conditions: conditions(p.overallStats?.conditions, start),
    skills: Object.entries(targetId ? targetMembers.reduce((acc,id)=>{
      const by=p.damageByTarget?.[id];for(const [k,v] of Object.entries(by?.skills||{})) {
        const key=Number(k); const old=acc[key];
        acc[key]=old?{...old,totalDamage:Number(old.totalDamage||0)+Number(v.totalDamage||0),count:Number(old.count||0)+Number(v.count||0),critCount:Number(old.critCount||0)+Number(v.critCount||0),totalDamageNonCrit:Number(old.totalDamageNonCrit||0)+Number(v.totalDamageNonCrit||0),totalDamageCrit:Number(old.totalDamageCrit||0)+Number(v.totalDamageCrit||0)}:{...v};
      }return acc;
    },{} as Record<number,any>) : (p.overallStats?.skills||{})).map(([id, stat]) => ({
      skillId: Number(id), name: names[Number(id)] || null,
      hitCount: Number(stat.count || 0), criticalHits: Number(stat.critCount || 0),
      totalDamage: Number(stat.totalDamage || 0), nonCriticalDamage: Number(stat.totalDamageNonCrit || 0),
      criticalDamage: Number(stat.totalDamageCrit || 0),
      // Existing `uses` is not verified as a discrete cast counter. Never label it APM.
      sourceUses: stat.uses ?? null
    })),
    damageEvents: (targetId ? [] : (p.skillUses || [])).filter(e => Number.isFinite(Number(e.timestamp)) && Number(e.timestamp) >= 0).map(e => ({
      time: Number(e.timestamp), totalDamage: Number(e.totalDmg || 0),
      skills: (e.skills || []).map((s: {skillId:number;damage:number;hitCount:number;critCount:number}) => ({
        skillId: Number(s.skillId), damage: Number(s.damage || 0), hits: Number(s.hitCount || 0), crits: Number(s.critCount || 0)
      }))
    }))
  }));
  const targets = Object.entries(summary.targets || {}).map(([id,t]) => {
    const offset = relative(t.startTime, start);
    const hp = (t.hpHistory || []).filter(h => Number(h.maxHp)>0 && Number.isFinite(Number(h.time)))
      .map(h => ({time: offset === null ? null : offset + Number(h.time), currentHp: Number(h.currentHp), maxHp: Number(h.maxHp)}));
    const zeroSample = hp.some(h => h.currentHp <= 0);
    return {entityId: id, name: t.name, raceId: t.raceId || null,
      firstSeen: relative(t.startTime, start), lastSeen: relative(t.endTime, start),
      seenAppear: Boolean(t.seenAppear), seenDead: Boolean(t.seenDead), disappeared: Boolean(t.disappeared),
      hp, conditions: conditions(t.conditions, start),
      // A despawn alone is never proof of a clear (notably Gate 1 Vertrag).
      zeroHpObserved: zeroSample,
      defeatEvidence: zeroSample && t.seenDead ? 'zero-hp-and-death-flag' : 'unverified'
    };
  });
  return {
    format: 'midir-companion', version: 1, timeUnit: 'seconds', timeOrigin: 'encounter-start',
    session: {title, scope, targetScope:targetId?'selected-target':'all-targets', targetId:targetId||null, targetEntityIds:targetMembers, startUnixSeconds: start, durationSeconds: duration},
    provenance: {skillEvents: 'damage-hit-groups-not-verified-casts', conditions: 'saved-intervals',
      encounterCompletion: 'per-entity-evidence-and-matched-gate1-replacement-zero-hp'},
    // Per-attempt logical identity; raw entities and their conditions remain independent.
    logicalEncounters: [
    ...findGate1Attempts(summary.targets || {}).map((attempt, index) => ({
      type: 'bri-gate-1-vertrag', attemptIndex: index + 1,
      entityIds: attempt.entityIds, firstEntityId: attempt.firstEntityId,
      replacementEntityId: attempt.replacementEntityId,
      start: relative(attempt.startUnixSeconds, start), end: relative(attempt.endUnixSeconds, start),
      completion: attempt.completion, evidence: attempt.evidence,
      effectiveHp: (() => {
        const first = summary.targets[attempt.firstEntityId];
        const second = attempt.replacementEntityId ? summary.targets[attempt.replacementEntityId] : null;
        const firstSample = first?.hpHistory?.filter(h => Number(h.maxHp)>0).at(-1);
        const secondSample = second?.hpHistory?.filter(h => Number(h.maxHp)>0).at(-1);
        if (!firstSample || !secondSample) return null;
        const hp = gate1EffectiveHp(Number(firstSample.maxHp), Number(firstSample.currentHp),
          Number(secondSample.maxHp), Number(secondSample.currentHp), true);
        return hp ? {...hp, evidence:'two-damageable-half-hp-entities'} : null;
      })(),
      // Keep distinct HP histories for both actual entities. Companion can
      // determine HP-lock windows without mistaking 7601 for the 70% form.
      phaseHp: [
        {raceId:7600, entityId:attempt.firstEntityId},
        ...(attempt.replacementEntityId?[{raceId:7601,entityId:attempt.replacementEntityId}]:[])
      ],
      // HP plateau boundaries alone do not prove the exact giant spawn time.
      phaseIntervals: null
    })),
    ...findGlennAttempts(summary.targets || {}).map((attempt, index) => ({
      type: 'glenn-bearna-primeval-winter', encounterName: 'Glenn Bearna: Primeval Winter', attemptIndex: index + 1,
      entityIds: attempt.entityIds, firstEntityId: attempt.firstEntityId,
      start: relative(attempt.startUnixSeconds, start), end: relative(attempt.endUnixSeconds, start),
      completion: attempt.completion, evidence: attempt.completion === 'verified-clear' ? 'winter-tyrant-observed-zero-hp' : 'phase-transition-or-clear-unverified',
      effectiveHp: null, phaseIntervals: null
    })),
    ...Object.entries(summary.targets || {})
      .filter(([,t]) => [195012,193359,193364].includes(Number(t.raceId)))
      .sort((a,b)=>Number(a[1].startTime)-Number(b[1].startTime))
      .map(([entityId,t]) => ({
        type: Number(t.raceId)===195012 ? 'rabbie-phantasm-temptations-path' : 'crom-bas-normal',
        encounterName: Number(t.raceId)===195012 ? "Rabbie Phantasm: Temptation's Path" : 'Crom Bas Normal',
        bossName: Number(t.raceId)===195012 ? 'Succubus Queen' : Number(t.raceId)===193364 ? 'Irusan' : 'Giga Glas Ghaibhleann',
        entityIds:[entityId], firstEntityId:entityId,
        start:relative(t.startTime,start), end:relative(t.endTime,start),
        completion: (t.hpHistory || []).some(h=>Number(h.maxHp)>0 && Number(h.currentHp)<=0) ? 'observed-zero-hp' : 'unverified',
        effectiveHp:null, phaseIntervals:null
      }))
    ],
    players, targets
  };
}

export function downloadCompanionJSON(summary: FightSummary, title: string, scope: string, names: Record<number,string>, targetId = '') {
  const payload = buildCompanionExport(summary, title, scope, names, targetId);
  if (!payload.players.length) throw new Error('No selected player data is available.');
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'midir-companion-v1.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
