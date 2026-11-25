import type { FightSummary, PlayerStats } from '@/protocols';
import { findReportEncounters } from './reportEncounters';
import { getGroupMemberTargetIds, isGroupTargetId } from './targetGrouping';

/**
 * Boss entity IDs eligible for the secondary DPS label in Damage Dealt.
 * Only show a comparison for a grouped selection containing both recognized
 * bosses and other targets. Individual bosses, boss-only groups, and the
 * complete-session view keep the existing single-DPS presentation.
 */
export function bossIdsForDpsComparison(
  summary: FightSummary,
  selectedTargetId: string | null | undefined,
): string[] {
  if (!selectedTargetId || !isGroupTargetId(selectedTargetId)) return [];

  const memberIds = [...new Set(getGroupMemberTargetIds(selectedTargetId, summary))];
  if (memberIds.length < 2) return [];

  // Use the same evidence-bound boss recognition as the portable exporter;
  // never decide boss ownership from names or Race IDs alone.
  const encounters = findReportEncounters(summary);
  // A boss encounter group is anchored to its first boss entity. If its
  // timing-based members overlap another attempt, do not borrow that boss.
  const anchored = encounters.find(encounter => selectedTargetId === `group_${encounter.id}`);
  const recognized = new Set((anchored ? [anchored] : encounters).flatMap(encounter => encounter.entityIds));
  const bossIds = memberIds.filter(id => recognized.has(id));
  if (!bossIds.length || !memberIds.some(id => !recognized.has(id))) return [];
  return bossIds;
}

/**
 * Presentation only: derive boss DPS using the *existing* displayed DPS's
 * duration. Do not overwrite the primary DPS or change sorting/bar widths.
 */
export function bossDpsForPlayerDisplay(
  player: PlayerStats | undefined,
  bossIds: readonly string[],
  displayedTotalDamage: number,
  displayedDps: number,
): number | null {
  if (!player || !bossIds.length || !(displayedTotalDamage > 0) || !(displayedDps > 0)) return null;
  if (!Number.isFinite(displayedTotalDamage) || !Number.isFinite(displayedDps)) return null;
  const bossDamage = bossIds.reduce((total, id) => total + Number(player.damageByTarget?.[id]?.totalDamage || 0), 0);
  // A discrepancy means the numerator is not safely a subset of this scope.
  if (!Number.isFinite(bossDamage) || bossDamage < 0 || bossDamage > displayedTotalDamage + 0.01) return null;
  return bossDamage * displayedDps / displayedTotalDamage;
}
