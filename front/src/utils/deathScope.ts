import type { FightSummary } from '@/protocols';

/**
 * Death flags on Damage Done follow the selected target/encounter's recorded
 * time span. A missing span is not evidence that a session-wide death belongs
 * to the selection, so selected views return no flags when it is unavailable.
 * Times are absolute Unix seconds (as are PlayerStats.deaths).
 */
export function getDeathScopeWindow(
  summary: FightSummary,
  selectedTargetId: string | null | undefined,
  memberTargetIds: string[] = [],
): { start: number; end: number } | null {
  if (!selectedTargetId) return null;

  const ids = memberTargetIds.length ? memberTargetIds : [selectedTargetId];
  let start = Infinity;
  let end = -Infinity;
  for (const id of new Set(ids)) {
    const target = summary.targets?.[id];
    let first = Number(target?.startTime);
    let last = Number(target?.endTime);
    if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(last) || last < first) {
      first = Infinity;
      last = -Infinity;
      for (const player of Object.values(summary.players || {})) {
        const breakdown = player.damageByTarget?.[id];
        const a = Number(breakdown?.startTime);
        const b = Number(breakdown?.endTime);
        if (Number.isFinite(a) && a > 0 && Number.isFinite(b) && b >= a) {
          first = Math.min(first, a);
          last = Math.max(last, b);
        }
      }
    }
    if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
      start = Math.min(start, first);
      end = Math.max(end, last);
    }
  }
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

export function scopedDeathTimes(
  deaths: number[] | undefined,
  selectedTargetId: string | null | undefined,
  window: { start: number; end: number } | null,
): number[] {
  const times = (deaths || []).filter(time => Number.isFinite(time));
  if (!selectedTargetId) return [...times].sort((a, b) => a - b);
  if (!window) return [];
  return times.filter(time => time >= window.start && time <= window.end).sort((a, b) => a - b);
}
