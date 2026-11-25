import type { FightSummary, TargetStats } from '@/protocols';
import { findCromAttempts } from './cromEncounter';
import { getReportNaming } from './reportExportNaming';
import { findReportEncounters } from './reportEncounters';

/** Count distinct observed combat participants, not nearby entities or a
 * guaranteed party roster. Backend real player IDs are decimal strings. */
export function observedParticipantCount(summary: FightSummary): number {
  const ids = new Set<string>();
  const add = (id: string) => { if (/^[1-9]\d*$/.test(id)) ids.add(id); };
  for (const [id, player] of Object.entries(summary.players || {})) {
    if (Number(player.overallStats?.totalDamage) > 0 ||
        Number(player.overallHealing?.totalDamage) > 0 ||
        Number(player.overallHealing?.overshieldProvided) > 0 ||
        (player.skillActivations || []).length > 0 ||
        (player.damageEvents || []).some(hit => Number(hit.damage) > 0)) add(player.id || id);
  }
  for (const [id, player] of Object.entries(summary.damageTaken || {})) {
    if (Number(player.totalDamage) > 0 || Number(player.totalManaDamage) > 0) add(player.playerId || id);
  }
  return ids.size;
}

/** Positive remaining HP on the final observed boss supports an unfinished
 * attempt suggestion only. It does not establish a wipe or instance exit. */
function observedUnfinishedBoss(target: TargetStats | undefined): boolean {
  if (!target || target.seenDead) return false;
  const history = (target.hpHistory || []).filter(h => Number.isFinite(h.time) &&
    Number.isFinite(h.currentHp) && Number.isFinite(h.maxHp) && h.maxHp > 0);
  return history.length > 0 && history.every(h => h.currentHp > 0);
}

/** Pure, presentation-only suggestion for the full live recording. Never
 * rename an existing session, change encounter results, or infer a party roster. */
export function suggestSessionSaveName(summary: FightSummary, fallback: string): string {
  const {encounters} = getReportNaming(summary);
  if (!encounters.length) return fallback;
  if (encounters.length > 1) {
    // A recording-wide count can include roster changes. Avoid a party-size
    // suggestion beyond the largest standard group (eight) in this naming scheme.
    const count = observedParticipantCount(summary);
    return count > 0 && count <= 8 ? `Variety ${count}p` : 'Variety';
  }
  const family = encounters[0];
  const shortNames: Record<string, string> = {
    'Crom Bas': 'Crom', 'Crom Bas Abyss': 'Crom Abyss',
    'Glenn Bearna': 'Glenn', 'Bri Leith': 'Bri', 'Rabbie Phantasm': 'Phantasm',
  };
  let name = shortNames[family] || family;
  if (family === 'Bri Leith') {
    // Gates belong to one family, but only recorded terminal clears count
    // toward the save label. Gate 1 uses the linked replacement-form result.
    const cleared = new Set<number>();
    for (const encounter of findReportEncounters(summary)) {
      const gate = /^Gate ([1-4]) — /.exec(encounter.label);
      if (gate && encounter.clear === 'observed-zero-hp') cleared.add(Number(gate[1]));
    }
    const gates = [...cleared].sort((a,b) => a-b);
    if (!gates.length) name = 'Bri Attempt';
    else if (gates.join(',') === '1,2,3') name = 'Bri';
    else if (gates.length === 1) name = `Gate ${gates[0]}`;
    else name = `Gate ${gates.slice(0,-1).join(', ')} & ${gates.at(-1)}`;
  }
  if (family === 'Crom Bas') {
    const attempts = findCromAttempts(summary.targets || {});
    const outcomes = attempts.map(a => a.completion === 'verified-clear' ? 'Clear' :
      observedUnfinishedBoss(summary.targets[a.glasId || a.irusanId || '']) ? 'Fail' : '');
    if (outcomes.length && outcomes[0] && outcomes.every(o => o === outcomes[0])) name += ' ' + outcomes[0];
  }
  const capacity = family === 'Glenn Bearna' || family === 'Bri Leith' ? 8 :
    family === 'Crom Bas' || family === 'Rabbie Phantasm' ? 4 : 0;
  if (capacity) {
    const count = observedParticipantCount(summary);
    if (count > 0 && count < capacity) name += ` ${count}p`;
  }
  return name;
}
