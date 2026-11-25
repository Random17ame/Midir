import type { FightSummary } from '@/protocols';

/** Optional live flags must never stick when switching to a saved session. */
export function normalizeLiveFlags(summary: FightSummary): void {
  summary.minimalistMode = summary.minimalistMode === true;
  summary.liveChartPaused = summary.liveChartPaused === true;
  summary.liveCompact = summary.liveCompact === true;
  summary.healingIncomplete = summary.healingIncomplete === true;
}

export function isLiveChartPaused(summary: FightSummary, sessionId: string): boolean {
  return sessionId === 'live' && summary.minimalistMode === true && summary.liveChartPaused === true;
}

export function isHealingAvailable(summary: FightSummary, sessionId: string): boolean {
  return !summary.healingIncomplete && !(sessionId === 'live' && summary.minimalistMode);
}
