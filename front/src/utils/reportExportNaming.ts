import type { FightSummary } from '@/protocols';
import { findReportEncounters } from './reportEncounters';
import { getGroupMemberTargetIds } from './targetGrouping';
import { findAlbyRuns } from './albyShineseeker';
import { findFahmesStages } from './fahmesRuin';
import { findPhantasmRuns } from './phantasmEncounter';
import { findDungeonRunFolders } from './dungeonRunFolders';
import { findHighTierRuns } from './highTierMinorGrouping';

export type ReportNaming = { startTime: number; encounters: string[] };

/** Filename metadata only. Reuse the existing observed encounter and run
 * classifiers; never infer a dungeon from a user-edited session title. */
export function getReportNaming(summary: FightSummary, targetId = '', fallbackStart = 0): ReportNaming {
  const targets = summary.targets || {};
  const selected = targetId ? new Set(getGroupMemberTargetIds(targetId, summary)) : null;
  const encounters = new Set<string>();
  const add = (family: string, ids: string[]) => {
    if (ids.some(id => !selected || selected.has(id))) encounters.add(family);
  };
  // Use the unfiltered recognizer: a selected arbitrary target is not a
  // recognized encounter merely because the report can display it.
  for (const e of findReportEncounters(summary)) {
    if (/^Gate [1-4] — /.test(e.label)) add('Bri Leith', e.entityIds);
    else if (e.label.startsWith('Crom Bas Abyss — ')) add('Crom Bas Abyss', e.entityIds);
    else if (e.label.startsWith('Crom Bas — ')) add('Crom Bas', e.entityIds);
    else if (e.label.startsWith('Glenn Bearna — ')) add('Glenn Bearna', e.entityIds);
    else if (e.label.startsWith('Rabbie Phantasm — ') || e.label.startsWith('Succubus Queen · ')) add('Rabbie Phantasm', e.entityIds);
  }
  for (const run of findAlbyRuns(targets)) add('Alby Shineseeker', run.entityIds);
  for (const stage of findFahmesStages(targets)) add('Fahmes Ruin', stage.entityIds);
  for (const run of findPhantasmRuns(targets)) add('Rabbie Phantasm', run.entityIds);
  for (const folder of findDungeonRunFolders(targets)) {
    const family = folder.dungeon === 'crom' ? 'Crom Bas' : 'Glenn Bearna';
    if (!selected) encounters.add(family);
    else add(family, getGroupMemberTargetIds(folder.id, summary));
  }
  for (const run of findHighTierRuns(targets)) add(run.encounter === 'abyss' ? 'Crom Bas Abyss' : 'Bri Leith', run.entityIds);
  const validStart = (value: number | undefined) => Number.isFinite(value) && Number(value) > 0 && Number.isFinite(new Date(Number(value)*1000).getTime());
  return {startTime: validStart(summary.startTime) ? Number(summary.startTime) : validStart(fallbackStart) ? fallbackStart : 0,
    encounters: [...encounters]};
}

/** Local recording date, matching the saved-session list. Use only reports
 * that were actually produced; selection order and export time are irrelevant. */
export function reportDownloadName(reports: ReportNaming[], extension: 'html' | 'zip'): string {
  const dates = reports.map(r => r.startTime).filter(t => Number.isFinite(t) && t > 0 && Number.isFinite(new Date(t*1000).getTime()));
  const earliest = dates.length ? new Date(Math.min(...dates)*1000) : null;
  const date = earliest ? `${String(earliest.getMonth()+1).padStart(2,'0')} ${String(earliest.getDate()).padStart(2,'0')} ${String(earliest.getFullYear()).slice(-2)}` : '';
  const encounters = [...new Set(reports.flatMap(r => r.encounters))].sort();
  const unknown = reports.some(r => !r.encounters.length);
  const description = encounters.length ? (encounters.length === 1 && !unknown ? encounters[0] : 'Mixed Encounters') : (extension === 'zip' ? 'Combat Reports' : 'Combat Report');
  return [date, description].filter(Boolean).join(' ') + '.' + extension;
}
