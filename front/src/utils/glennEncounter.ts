import type { TargetStats } from '@/protocols';

// Each 7585 spawn begins a distinct Glenn Bearna boss attempt. Phase entities
// must join directly at the preceding phase's disappearance, not merely be the
// next entity with a matching race ID somewhere later in the session.
export function findGlennAttempts(targets: Record<string, TargetStats>) {
  const candidates = Object.entries(targets)
    .filter(([, t]) => [7585, 7586, 7587].includes(Number(t.raceId)) && Number(t.startTime) > 0)
    .sort((a, b) => Number(a[1].startTime) - Number(b[1].startTime));
  const starters = candidates.filter(([, t]) => Number(t.raceId) === 7585);
  const used = new Set<string>();
  return starters.map(([id, first], index) => {
    const nextStart = index + 1 < starters.length ? Number(starters[index + 1][1].startTime) : Infinity;
    const ids = [id];
    let previous = first;
    for (const raceId of [7586, 7587]) {
      const end = Number(previous.endTime);
      if (!(end > 0)) break;
      const match = candidates.find(([candidateId, target]) => !used.has(candidateId) &&
        Number(target.raceId) === raceId && Number(target.startTime) < nextStart &&
        Number(target.startTime) >= Number(first.startTime) &&
        Math.abs(Number(target.startTime) - end) <= 2);
      if (!match) break;
      ids.push(match[0]);
      used.add(match[0]);
      previous = match[1];
    }
    const zero = ids.length === 3 && Boolean(previous.hpHistory?.some(h => Number(h.maxHp) > 0 && Number(h.currentHp) <= 0));
    return { firstEntityId: id, entityIds: ids, startUnixSeconds: Number(first.startTime),
      endUnixSeconds: Number(previous.endTime) || null,
      completion: zero ? 'verified-clear' as const : 'unverified' as const };
  });
}
