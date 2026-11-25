import type { TargetStats } from '@/protocols';
import { findMechanicGroups } from './mechanicGroups';

/** Display-only evidence for Gate 3. A halo is shown only after a valid zero-HP
 * observation. Spawn batches describe approximate rounds, not clear packets. */
export type Gate3Halo = {
  id: string;
  phase: 80 | 60 | 40;
  round: number;
  spawnUnix: number;
  zeroUnix: number;
};
export type Gate3HaloEvidence = {
  halos: Gate3Halo[];
  /** Only Gate 3 Shards positively known to be outside named mechanic groups. */
  excludedShardIds: string[];
};

function zeroTime(target: TargetStats): number | null {
  const start = Number(target.startTime);
  if (!Number.isFinite(start) || start <= 0) return null;
  const samples = (target.hpHistory || [])
    .filter(h => Number(h.maxHp) > 0 && Number(h.currentHp) <= 0 && Number.isFinite(Number(h.time)))
    .map(h => start + Number(h.time));
  return samples.length ? Math.min(...samples) : null;
}

export function getGate3HaloEvidence(targets: Record<string,TargetStats>, bossId: string): Gate3HaloEvidence {
  const boss = targets[bossId];
  if (!boss || Number(boss.raceId) !== 7603) return { halos: [], excludedShardIds: [] };
  const start = Number(boss.startTime);
  if (!Number.isFinite(start) || start <= 0) return { halos: [], excludedShardIds: [] };
  const nextStart = Object.entries(targets)
    .filter(([id,t]) => id !== bossId && Number(t.raceId) === 7603 && Number(t.startTime) > start)
    .reduce((min,[,t]) => Math.min(min,Number(t.startTime)),Infinity);
  const end = Math.min(Number(boss.endTime) > start ? Number(boss.endTime) : Infinity, nextStart);
  const groups = findMechanicGroups(targets).filter(g =>
    g.type === 'bri-gate-3-halos' && g.bossEntityIds.includes(bossId));
  const known = new Set(groups.flatMap(g => g.memberEntityIds));
  const excludedShardIds = Object.entries(targets).filter(([,t]) =>
    Number(t.raceId) >= 7604 && Number(t.raceId) <= 7608 &&
    Number(t.startTime) >= start && Number(t.startTime) < end)
    .map(([id])=>id).filter(id => !known.has(id));
  const halos: Gate3Halo[] = [];
  for (const group of groups) {
    const phase = group.phaseHpPercent as 80|60|40;
    // A new batch of observed spawns following a genuine time gap indicates a
    // later rotation. No arena coordinates or unrecorded kills are fabricated.
    const sorted = group.memberEntityIds.filter(id => targets[id])
      .sort((a,b)=>Number(targets[a].startTime)-Number(targets[b].startTime) || a.localeCompare(b));
    let round = 1, lastSpawn = -Infinity;
    for (const id of sorted) {
      const t = targets[id], spawn = Number(t.startTime);
      if (spawn - lastSpawn >= 7 && lastSpawn !== -Infinity) round++;
      lastSpawn = spawn;
      const zero = zeroTime(t);
      if (zero === null) continue;
      halos.push({id,phase,round,spawnUnix:spawn,zeroUnix:zero});
    }
  }
  halos.sort((a,b)=>a.phase-b.phase || a.zeroUnix-b.zeroUnix || a.id.localeCompare(b.id));
  return {halos,excludedShardIds};
}
