import type { FightSummary, PlayerStats } from '@/protocols';
import { getSkillArcana } from './arcanaEncounter';
import { findReportEncounters } from './reportEncounters';

/** The independent personal-record index is computed only from saved, precise hits. */
export const BURST_WINDOW_MS = 30_000;
export const BURST_INDEX_KEY = 'midir_burst_leaderboard_v1';
export const BURST_INDEX_VERSION = 3;

export interface BurstRecord {
  playerName: string;
  playerId?: string; // saved session player entity ID; stable within this recording
  playerKey: string;
  arcanaName: string;
  damage: number;
  hits: number;
  startMs: number;
  endMs: number;
  sessionId: string;
  sessionName: string;
  sessionStartMs?: number; // Original recording start, not the winning burst; optional for legacy cache
}
export interface IndexedBurstSession {
  signature: string;
  records: BurstRecord[];
}
export interface BurstIndex {
  version: number;
  sessions: Record<string, IndexedBurstSession>;
}

export function normalizeBurstPlayerName(name: string): string {
  return name.trim().normalize('NFKC').toLocaleLowerCase();
}

// Saved-session identity is the actual .ndjson filename, not its display
// name. Include filesystem size/mtime to detect replaced recordings even when
// their header timestamps are unchanged. A rename alone remains harmless.
export function burstSessionSignature(session: {
  id: string; startTime: number; endTime?: number; fileSize?: number; modifiedMs?: number
}): string {
  return JSON.stringify([
    session.id, session.startTime, session.endTime ?? null,
    Number.isFinite(session.fileSize) ? session.fileSize : null,
    Number.isFinite(session.modifiedMs) ? session.modifiedMs : null
  ]);
}

export function newBurstIndex(): BurstIndex {
  return { version: BURST_INDEX_VERSION, sessions: {} };
}

export function loadBurstIndex(raw: string | null): BurstIndex {
  if (!raw) return newBurstIndex();
  try {
    const value = JSON.parse(raw) as BurstIndex;
    if (value?.version !== BURST_INDEX_VERSION || !value.sessions || typeof value.sessions !== 'object' || Array.isArray(value.sessions)) {
      return newBurstIndex();
    }
    const validSessions: BurstIndex['sessions'] = {};
    for (const [key, item] of Object.entries(value.sessions)) {
      if (item && typeof item.signature === 'string' && Array.isArray(item.records)) {
        validSessions[key] = { signature: item.signature, records: item.records.filter(isValidBurstRecord) };
      }
    }
    return { version: BURST_INDEX_VERSION, sessions: validSessions };
  } catch {
    return newBurstIndex();
  }
}

function isValidBurstRecord(value: unknown): value is BurstRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as BurstRecord;
  return typeof item.playerName === 'string' && typeof item.playerKey === 'string' &&
    typeof item.arcanaName === 'string' && typeof item.sessionId === 'string' &&
    typeof item.sessionName === 'string' && (item.playerId === undefined || typeof item.playerId === 'string') &&
    (item.sessionStartMs === undefined || (Number.isFinite(item.sessionStartMs) && item.sessionStartMs > 0)) &&
    Number.isFinite(item.damage) && item.damage > 0 &&
    Number.isFinite(item.hits) && Number.isFinite(item.startMs) && Number.isFinite(item.endMs);
}

// Shared by manually initiated index updates only; prevents repeated color/UI
// resolution for every hit in large saved recordings.
const cachedArcanaNames = new Map<number, string>();
function arcanaNameForSkill(id: number): string {
  if (!cachedArcanaNames.has(id)) cachedArcanaNames.set(id, getSkillArcana(id)?.name || '');
  return cachedArcanaNames.get(id)!;
}
export type AssignedHit = {
  atMs: number;
  damage: number;
  segment: number;
  arcana: string;
  skillId: number;
  targetId: string;
  encounterStartMs: number;
  encounterEndMs: number;
  critical?: boolean;
  petName?: string;
};

/**
 * A player cannot change Arcana during a recognized encounter. Collect all
 * recorded Arcana skill evidence in that encounter (including attacks against
 * adds and explicit uses) before assigning its boss-targeted damage. This lets
 * older shared-skill hits before the first Arcana cue qualify, without borrowing
 * an identity from a different encounter in the same saved session.
 *
 * The leaderboard only scores hits against positively recognized boss entity
 * IDs. Multi-form encounters may contribute from any of their verified boss
 * entities; there is no all-target or generic Race-ID fallback.
 */
export function assignedHits(player: PlayerStats, summary: FightSummary): AssignedHit[] {
  if (summary.liveCompact) throw new Error('Load the saved session before indexing exact-hit evidence.');
  const observedHits = (player.damageEvents || [])
    .filter(h => Number.isFinite(h.atMs) && h.atMs >= 1e11 &&
      Number.isFinite(h.damage) && h.damage > 0)
    .slice().sort((a, b) => a.atMs - b.atMs);
  const hits = observedHits.filter(h => h.targetId);
  if (!hits.length) return [];
  const uses = player.skillActivations || [];
  const originMs = (Number(summary.startTime) || 0) * 1000;
  const result: AssignedHit[] = [];
  let segment = 0;

  const inRange = (atMs: number, startMs: number, endMs: number) =>
    Number.isFinite(atMs) && atMs >= startMs && atMs <= endMs;
  function arcanaEvidence(startMs: number, endMs: number, targetId?: string): Set<string> {
    const found = new Set<string>();
    for (const hit of observedHits) {
      if (!inRange(hit.atMs, startMs, endMs) || (targetId && hit.targetId !== targetId)) continue;
      const arcana = arcanaNameForSkill(Number(hit.skillId));
      if (arcana) found.add(arcana);
    }
    for (const use of uses) {
      if (!inRange(use.atMs, startMs, endMs) || (targetId && use.targetId && use.targetId !== targetId)) continue;
      const arcana = arcanaNameForSkill(Number(use.skillId));
      if (arcana) found.add(arcana);
    }
    return found;
  }
  function recordHits(entityIds: Set<string>, startMs: number, endMs: number, arcana: string): void {
    segment++;
    for (const hit of hits) {
      if (!entityIds.has(String(hit.targetId)) || !inRange(hit.atMs, startMs, endMs)) continue;
      result.push({ atMs: hit.atMs, damage: hit.damage, arcana, segment,
        targetId: String(hit.targetId), encounterStartMs: startMs, encounterEndMs: endMs,
        skillId: Number(hit.skillId), critical: !!hit.critical, petName: hit.petName });
    }
  }
  const encounters = findReportEncounters(summary).sort((a, b) => a.start - b.start);
  for (const [index, encounter] of encounters.entries()) {
    const startMs = originMs + encounter.start * 1000;
    const nextStartMs = index + 1 < encounters.length ? originMs + encounters[index + 1].start * 1000 : Infinity;
    // Report windows have a one-second minimum for HP visualization. That
    // padding cannot grant a later encounter's Arcana evidence to this one.
    const endMs = Math.min(originMs + encounter.end * 1000, nextStartMs - 1);
    const ids = [...new Set(encounter.entityIds)].filter(id => Boolean(summary.targets?.[id]));
    if (!ids.length || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;
    if (!hits.some(h => ids.includes(String(h.targetId)) && inRange(h.atMs, startMs, endMs))) continue;
    const found = arcanaEvidence(startMs, endMs);
    if (found.size === 1) {
      // The same 30-second window may contain damage to multiple forms or
      // recognized bosses. It is still boss damage, never damage to adds.
      recordHits(new Set(ids), startMs, endMs, [...found][0]);
    } else if (found.size > 1 && ids.length > 1) {
      // Rare combined report encounters can contain distinct fights separated
      // by downtime. Do not ascribe two Arcana identities to one encounter:
      // retain only individually evidenced boss intervals in that case.
      for (const id of ids) {
        const target = summary.targets[id];
        const targetStart = Math.max(startMs, Number(target?.startTime || 0) * 1000);
        const targetEnd = Math.min(endMs, Number(target?.endTime || 0) > 0 ? Number(target.endTime) * 1000 : endMs);
        if (targetEnd < targetStart) continue;
        const ownEvidence = arcanaEvidence(targetStart, targetEnd);
        if (ownEvidence.size === 1) recordHits(new Set([id]), targetStart, targetEnd, [...ownEvidence][0]);
      }
    }
    // Conflicting Arcana cues for one boss or missing evidence cannot create
    // a competitive record by guessing. They remain absent from the index.
  }
  return result.sort((a, b) => a.atMs - b.atMs || a.segment - b.segment);
}

type BestBurstSpan = {
  damage: number; hits: number; startMs: number;
  firstIndex: number; lastIndex: number;
};

function findBestBurst(hits: AssignedHit[]): BestBurstSpan | null {
  if (!hits.length) return null;
  // Keep the exact winning slice as well as its totals. Both indexing and
  // comparison export must use this single rolling-window decision.
  let left = 0, total = 0;
  let best: BestBurstSpan | null = null;
  for (let right = 0; right < hits.length; right++) {
    total += hits[right].damage;
    while (hits[right].atMs - hits[left].atMs >= BURST_WINDOW_MS) total -= hits[left++].damage;
    const startMs = hits[left].atMs;
    if (!best || total > best.damage || (total === best.damage && startMs < best.startMs)) {
      best = { damage: total, hits: right - left + 1, startMs,
        firstIndex: left, lastIndex: right };
    }
  }
  return best && best.damage > 0 ? best : null;
}

export type BurstWindowEvidence = {
  arcanaName: string; damage: number; hits: number; startMs: number;
  /** These are the original eligible boss hits, never chart buckets or uses. */
  damageHits: AssignedHit[];
};

/** A single source of truth for the indexed result and the exported events. */
export function playerBurstWindows(player: PlayerStats, summary: FightSummary): BurstWindowEvidence[] {
  const grouped = new Map<string, AssignedHit[]>();
  for (const hit of assignedHits(player, summary)) {
    const key = `${hit.arcana}\0${hit.segment}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(hit);
  }
  const windows: BurstWindowEvidence[] = [];
  for (const segmentHits of grouped.values()) {
    const best = findBestBurst(segmentHits);
    if (!best) continue;
    windows.push({ arcanaName: segmentHits[0].arcana, damage: best.damage,
      hits: best.hits, startMs: best.startMs,
      damageHits: segmentHits.slice(best.firstIndex, best.lastIndex + 1) });
  }
  return windows;
}

/** Select the same per-Arcana winner as the session index, including ties. */
export function bestPlayerBurstWindow(player: PlayerStats, summary: FightSummary, arcanaName: string): BurstWindowEvidence | null {
  let winner: BurstWindowEvidence | null = null;
  for (const window of playerBurstWindows(player, summary)) {
    if (window.arcanaName !== arcanaName) continue;
    if (!winner || window.damage > winner.damage ||
      (window.damage === winner.damage && window.startMs < winner.startMs)) winner = window;
  }
  return winner;
}

function preferBurst(candidate: BurstRecord, previous: BurstRecord | undefined): boolean {
  return !previous || candidate.damage > previous.damage ||
    (candidate.damage === previous.damage && candidate.startMs < previous.startMs);
}

/** One best 30s result per username and Arcana within a single recording. */
export function computeSessionBursts(summary: FightSummary, sessionId: string, sessionName: string): BurstRecord[] {
  const best = new Map<string, BurstRecord>();
  for (const [entityId, player] of Object.entries(summary.players || {})) {
    const name = String(player.name || '').trim();
    const playerKey = normalizeBurstPlayerName(name);
    if (!playerKey || /^(?:Unknown Caster|Misc\. Anonymous Healing)$/i.test(name)) continue;
    for (const burst of playerBurstWindows(player, summary)) {
      const candidate: BurstRecord = {
        playerName: name, playerId: String(player.id || entityId), playerKey, arcanaName: burst.arcanaName,
        damage: burst.damage, hits: burst.hits,
        startMs: burst.startMs, endMs: burst.startMs + BURST_WINDOW_MS,
        sessionId, sessionName,
        ...(Number.isFinite(Number(summary.startTime)) && Number(summary.startTime) > 0
          ? { sessionStartMs: Number(summary.startTime) * 1000 } : {}),
      };
      const key = `${candidate.arcanaName}\0${playerKey}`;
      if (preferBurst(candidate, best.get(key))) best.set(key, candidate);
    }
  }
  return [...best.values()];
}

/** One row per normalized username PER Arcana across all indexed sessions. */
export function rankBurstRecords(index: BurstIndex, arcanaName: string): BurstRecord[] {
  const bestByPlayer = new Map<string, BurstRecord>();
  for (const entry of Object.values(index.sessions)) {
    for (const record of entry.records) {
      if (record.arcanaName !== arcanaName || !isValidBurstRecord(record)) continue;
      const key = normalizeBurstPlayerName(record.playerName);
      if (!key) continue;
      if (preferBurst(record, bestByPlayer.get(key))) bestByPlayer.set(key, record);
    }
  }
  return [...bestByPlayer.values()].sort((a, b) => b.damage - a.damage || a.startMs - b.startMs || a.playerKey.localeCompare(b.playerKey));
}

export function retainAvailableBurstSessions(index: BurstIndex, validIds: Set<string>): number {
  let removed = 0;
  for (const id of Object.keys(index.sessions)) {
    if (!validIds.has(id)) { delete index.sessions[id]; removed++; }
  }
  return removed;
}
