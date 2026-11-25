/** Target-aware damage groups: the totals represent hits in a ONE-SECOND bucket,
 * not one cast. Absence of `targets` indicates an older un-attributed summary. */
export interface ScatterTargetHit {
  targetId: string; skillId: number; hitCount: number; petRaceId?: number; petName?: string;
  damage: number; maxDamage: number; critCount: number;
}
export interface ScatterSkillHit {
  skillId: number; hitCount: number; damage: number; petRaceId?: number; petName?: string;
  maxDamage: number; critCount: number;
}
export interface ScatterGroup {
  timestamp: number; totalDmg: number;
  skills: ScatterSkillHit[];
  targets?: ScatterTargetHit[];
}

export function hasTargetAttribution(group: ScatterGroup): boolean {
  return Array.isArray(group.targets) && group.targets.length > 0;
}

/** null means that this grouping contains no proven target attribution. */
export function filterScatterGroup(group: ScatterGroup, memberIds: ReadonlySet<string>): ScatterGroup | null {
  if (!hasTargetAttribution(group)) return null;
  const hits = (group.targets || []).filter(h => memberIds.has(String(h.targetId)));
  if (!hits.length) return null;
  const skills = new Map<string, ScatterSkillHit>();
  for (const h of hits) {
    const key = `${h.skillId}:${h.petRaceId || 0}`;
    const old = skills.get(key);
    if (!old) skills.set(key, {skillId: h.skillId, petRaceId: h.petRaceId, petName: h.petName, hitCount: h.hitCount, damage: h.damage,
      critCount: h.critCount, maxDamage: h.maxDamage});
    else {
      old.hitCount += h.hitCount; old.damage += h.damage;
      old.critCount += h.critCount; old.maxDamage = Math.max(old.maxDamage, h.maxDamage);
    }
  }
  return { timestamp: group.timestamp, totalDmg: hits.reduce((n,h)=>n+h.damage,0),
    skills: [...skills.values()], targets: hits };
}

export function scopeScatterGroups(groups: ScatterGroup[] | undefined, memberIds: ReadonlySet<string> | null): ScatterGroup[] {
  if (!memberIds) return groups || [];
  return (groups || []).map(g => filterScatterGroup(g, memberIds)).filter((g):g is ScatterGroup=>g !== null);
}
