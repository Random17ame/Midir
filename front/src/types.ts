export interface PlayerCacheInfo {
  id: string;
  name: string;
  raceId: number;
  guildName: string;
  totalLevel: number;
  combatPower: number;
}

export interface SessionSummaryPlayer {
  name: string;
  dps: number;
  arcanaName: string;
  arcanaIcon: string;
  totalDamage: number;
  overallHealing?: any; // Injected to prevent historical save drops
  healingByTarget?: any; // Injected to preserve historical targets
}

export interface SessionSummaryEnemy {
  name: string;
  raceId: number;
  totalDamage: number;
}

export interface SessionSummaryData {
  recordingId?: string;
  healingIncomplete?: boolean;
  duration: number;
  totalDamage: number;
  players: SessionSummaryPlayer[];
  enemies: SessionSummaryEnemy[];
}

export interface Session {
  id: string;
  name: string;
  startTime: number; // Unix timestamp
  endTime?: number; // Unix timestamp, optional for active sessions
  fileSize?: number; // Size of the saved NDJSON file, when listed from disk
  modifiedMs?: number; // Filesystem modification time in Unix milliseconds
  summary?: SessionSummaryData;
}
