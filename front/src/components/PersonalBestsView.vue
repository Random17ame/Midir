<template>
  <div class="records-view pa-4 pa-md-6">
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <div>
        <div class="text-h5 font-weight-bold">Personal Bests</div>
        <div class="text-caption text-medium-emphasis">Best 30-second boss burst · Saved sessions</div>
      </div>
      <v-spacer />
      <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-file-export-outline"
        :disabled="scanning || exporting || !comparedRecords.length" :loading="exporting"
        @click="exportComparison">Export Comparison ({{ comparedRecords.length }})</v-btn>
      <v-btn size="small" variant="tonal" prepend-icon="mdi-refresh" :loading="scanning"
        @click="scanNewSessions">Update Leaderboards</v-btn>
      <v-btn size="small" variant="text" :disabled="scanning" @click="rebuildIndex"
        title="Re-read all saved sessions and rebuild the local leaderboard">Rebuild</v-btn>
    </div>

    <v-slide-group v-model="selectedIndex" mandatory show-arrows class="mb-4 records-arcana-list">
      <v-slide-group-item v-for="(arcana, i) in arcanas" :key="arcana.name" :value="i"
        v-slot="{ isSelected, toggle }">
        <v-chip class="mr-2 mb-2" size="large" :variant="isSelected ? 'flat' : 'tonal'"
          :style="isSelected ? { backgroundColor: arcana.color, color: '#fff' } : {}"
          @click="toggle">
          <img v-if="arcana.icon" :src="arcana.icon" width="20" height="20" class="mr-2" alt="" />
          {{ arcana.name }}
        </v-chip>
      </v-slide-group-item>
    </v-slide-group>

    <v-card class="records-card" elevation="0" variant="outlined" rounded="lg">
      <div class="d-flex align-center ga-3 px-4 pt-4 pb-3">
        <img v-if="selectedArcana?.icon" :src="selectedArcana.icon" width="35" height="35" alt="" />
        <div class="min-w-0 flex-grow-1">
          <div class="font-weight-bold text-h6">{{ selectedArcana?.name || 'Arcana' }}</div>
          <div class="text-caption text-medium-emphasis">One personal record per character</div>
        </div>
        <span class="text-caption text-medium-emphasis">{{ ranked.length }} {{ ranked.length === 1 ? 'player' : 'players' }}</span>
      </div>

      <v-progress-linear v-if="exporting" :indeterminate="exportTotal === 0" :model-value="exportProgressPercent"
        height="5" color="secondary" :aria-label="`Prepared ${exportCompleted} of ${exportTotal} saved recordings`" />
      <div v-if="exporting" class="text-caption text-medium-emphasis px-4 py-2" role="status" aria-live="polite">
        Preparing comparison · {{ exportCompleted }} / {{ exportTotal }} recordings
      </div>
      <v-progress-linear v-if="scanning" :indeterminate="discovering" :model-value="progressPercent"
        height="5" color="primary" :aria-label="discovering ? 'Finding new sessions' : `Processed ${completed} of ${toProcess} sessions`" />
      <div v-if="scanning" class="text-caption text-medium-emphasis px-4 py-2" role="status" aria-live="polite">
        {{ discovering ? 'Finding new recordings…' : `Processing ${completed} / ${toProcess} new sessions` }}
        <span v-if="currentSession && !discovering"> · {{ currentSession }}</span>
      </div>
      <div v-if="statusMessage && !scanning" class="text-caption text-medium-emphasis px-4 py-2" role="status">
        {{ statusMessage }}
      </div>
      <div v-if="errorMessage" class="text-caption text-warning px-4 pb-2" role="alert">{{ errorMessage }}</div>

      <v-table v-if="ranked.length" density="comfortable" class="records-table">
        <thead><tr>
          <th class="select-col"><span class="sr-only">Compare</span></th>
          <th class="rank-col">#</th>
          <th>Character</th>
          <th class="text-right">30s Damage</th>
          <th class="text-right d-none d-sm-table-cell">30s DPS</th>
          <th class="d-none d-md-table-cell">Session</th>
          <th class="d-none d-sm-table-cell">Recorded</th>
        </tr></thead>
        <tbody>
          <tr v-for="(record, i) in ranked" :key="record.playerKey">
            <td class="select-col"><v-checkbox-btn density="compact" color="primary"
              :model-value="isCompared(record.playerKey)" :disabled="scanning || exporting || (!isCompared(record.playerKey) && comparedRecords.length >= MAX_COMPARISON_PLAYERS)"
              :aria-label="`Compare ${record.playerName}`" @update:model-value="toggleCompared(record.playerKey, !!$event)" /></td>
            <td class="text-medium-emphasis">{{ i + 1 }}</td>
            <td class="font-weight-medium">{{ record.playerName }}
              <div class="text-caption text-medium-emphasis d-sm-none">{{ formatSessionDate(record) }}</div>
            </td>
            <td class="text-right font-weight-bold" :style="{ color: selectedArcana?.color }"
              :title="`${formatNumber(record.damage)} damage · ${record.hits} observed hits · ${formatTimestamp(record.startMs)}`">
              {{ formatNumber(record.damage) }}
            </td>
            <td class="text-right d-none d-sm-table-cell">{{ formatNumber(Math.round(record.damage / 30)) }}</td>
            <td class="text-medium-emphasis text-truncate session-col d-none d-md-table-cell"
              :title="`${latestSessionName(record)} · Burst ${formatTimestamp(record.startMs)}`">{{ latestSessionName(record) }}</td>
            <td class="text-medium-emphasis d-none d-sm-table-cell" :title="sessionDateDescription(record)">{{ formatSessionDate(record) }}</td>
          </tr>
        </tbody>
      </v-table>
      <div v-else class="text-medium-emphasis text-body-2 px-4 py-8 text-center">
        {{ scanning ? 'Processing recorded bursts…' : 'No records indexed yet. Select Update Leaderboards to scan saved sessions.' }}
      </div>
    </v-card>
    <div class="text-caption text-medium-emphasis mt-3">
      Compare up to {{ MAX_COMPARISON_PLAYERS }} players · First five selected by default · Export loads winning recordings only when requested.
    </div>
    <div class="text-caption text-medium-emphasis mt-1">
      {{ indexedCount }} saved {{ indexedCount === 1 ? 'session' : 'sessions' }} indexed · Only hits on recognized boss entities count; hit counts are not casts.
      Only Update Leaderboards or Rebuild reads saved session files; opening this page never scans recordings.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { getSessions, getSessionSummary } from '@/apicall';
import { listArcanaIdentities } from '@/utils/arcanaEncounter';
import { skillNameMap } from '@/store';
import { prepareBurstComparison, downloadBurstComparisonHTML, BurstRecordMismatchError, type ComparisonPlayer } from '@/utils/burstComparisonExport';
import {
  BURST_INDEX_KEY, burstSessionSignature, computeSessionBursts,
  loadBurstIndex, newBurstIndex, rankBurstRecords, retainAvailableBurstSessions,
  type BurstIndex, type BurstRecord
} from '@/utils/burstLeaderboard';

const arcanas = listArcanaIdentities();
const selectedIndex = ref(0);
const selectedArcana = computed(() => arcanas[selectedIndex.value] || arcanas[0]);
const ledger = ref<BurstIndex>(readIndex());
const knownSessionNames = ref<Record<string, string>>({});
const ranked = computed(() => selectedArcana.value ? rankBurstRecords(ledger.value, selectedArcana.value.name) : []);
const indexedCount = computed(() => Object.keys(ledger.value.sessions).length);
const MAX_COMPARISON_PLAYERS = 8;
const comparedKeys = ref<string[]>([]);
const selectionTouched = ref(false);
const comparedRecords = computed(() => {
  const choice = selectionTouched.value ? comparedKeys.value : ranked.value.slice(0, 5).map(p => p.playerKey);
  const selected = new Set(choice);
  return ranked.value.filter(p => selected.has(p.playerKey)).slice(0, MAX_COMPARISON_PLAYERS);
});
watch(selectedIndex, () => { comparedKeys.value = []; selectionTouched.value = false; });
function isCompared(key: string): boolean { return comparedRecords.value.some(r => r.playerKey === key); }
function toggleCompared(key: string, checked: boolean): void {
  if (scanning.value || exporting.value) return;
  const existing = comparedRecords.value.map(r => r.playerKey);
  selectionTouched.value = true;
  comparedKeys.value = checked
    ? [...existing, key].slice(0, MAX_COMPARISON_PLAYERS)
    : existing.filter(id => id !== key);
}
const exporting = ref(false);
const exportCompleted = ref(0);
const exportTotal = ref(0);
const exportProgressPercent = computed(() => exportTotal.value ? exportCompleted.value * 100 / exportTotal.value : 0);
const scanning = ref(false);
const discovering = ref(false);
const progressPercent = computed(() => toProcess.value ? (100 * completed.value / toProcess.value) : 0);
const statusMessage = ref('');
const completed = ref(0);
const toProcess = ref(0);
const currentSession = ref('');
const errorMessage = ref('');
let isUnmounted = false;
let runId = 0;

function readIndex(): BurstIndex {
  try { return loadBurstIndex(localStorage.getItem(BURST_INDEX_KEY)); }
  catch { return newBurstIndex(); }
}
function persistIndex(): void {
  try { localStorage.setItem(BURST_INDEX_KEY, JSON.stringify(ledger.value)); }
  catch { errorMessage.value = 'Local cache could not be saved. Records will be rescanned next time.'; }
}
function formatNumber(n: number): string { return n.toLocaleString(); }
function formatTimestamp(n: number): string { return new Date(n).toLocaleString(); }
// The cache predates sessionStartMs: recover the saved recording's original
// start time from its existing signature without rereading any session.
function recordedSessionMs(record: BurstRecord): number | null {
  if (Number.isFinite(record.sessionStartMs) && (record.sessionStartMs || 0) > 0) return record.sessionStartMs!;
  try {
    const signature = ledger.value.sessions[record.sessionId]?.signature;
    const seconds = signature ? Number(JSON.parse(signature)?.[1]) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  } catch { /* Historical non-JSON session signature. */ }
  return null;
}
function formatSessionDate(record: BurstRecord): string {
  const ms = recordedSessionMs(record);
  return ms === null ? '—' : new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function sessionDateDescription(record: BurstRecord): string {
  const ms = recordedSessionMs(record);
  return ms === null ? 'Original recording date unavailable' : 'Recording started: ' + formatTimestamp(ms);
}
function latestSessionName(record: BurstRecord): string {
  return knownSessionNames.value[record.sessionId] || record.sessionName;
}
function refreshLedger(): void {
  ledger.value = { version: ledger.value.version, sessions: { ...ledger.value.sessions } };
}

async function exportComparison(): Promise<void> {
  if (scanning.value || exporting.value || !selectedArcana.value || !comparedRecords.value.length) return;
  const records = comparedRecords.value.slice();
  const arcanaName = selectedArcana.value.name;
  exporting.value = true;
  exportCompleted.value = 0;
  const uniqueIds = [...new Set(records.map(r => r.sessionId))];
  exportTotal.value = uniqueIds.length;
  errorMessage.value = '';
  try {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const summaries = new Map<string, Awaited<ReturnType<typeof getSessionSummary>>>();
    for (const id of uniqueIds) {
      if (isUnmounted) return;
      summaries.set(id, await getSessionSummary(id));
      exportCompleted.value++;
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    if (isUnmounted) return;
    const names: Record<number, string> = {};
    for (const [id, value] of Object.entries(skillNameMap.value)) names[Number(id)] = value.name;
    const currentRanks = new Map(ranked.value.map((r, i) => [r.playerKey, i + 1]));
    const prepared: ComparisonPlayer[] = [];
    let staleSessionId = '';
    let staleRecord: BurstRecord | null = null;
    for (const record of records) {
      try {
        prepared.push(prepareBurstComparison(
          record, summaries.get(record.sessionId)!, names, currentRanks.get(record.playerKey) || 0
        ));
      } catch (error) {
        if (!(error instanceof BurstRecordMismatchError)) throw error;
        staleSessionId = error.sessionId;
        staleRecord = record;
        break;
      }
    }
    if (staleSessionId) {
      // Export is user-initiated. Refresh only the changed source recording;
      // never substitute a new winning window silently in a shared report.
      const available = await getSessions();
      const item = available.find(s => s.id === staleSessionId);
      const sessionName = item?.name || records.find(r => r.sessionId === staleSessionId)?.sessionName || staleSessionId;
      if (item) {
        const summary = summaries.get(staleSessionId)!;
        const updatedRecords = computeSessionBursts(summary, staleSessionId, sessionName);
        // If a freshly calculated record cannot be exported from the *same*
        // summary, refreshing the cache again cannot help. Report the problem
        // rather than sending the user through an endless refresh loop.
        const failedRecord = staleRecord;
        const refreshedMatch = failedRecord && updatedRecords.find(r =>
          r.playerKey === failedRecord.playerKey && r.arcanaName === failedRecord.arcanaName);
        if (refreshedMatch) {
          try {
            prepareBurstComparison(refreshedMatch, summary, names, 0);
          } catch (error) {
            if (!(error instanceof BurstRecordMismatchError)) throw error;
            errorMessage.value = `${sessionName} still fails comparison verification after recalculation. Repeating Export will not fix it. Please provide the source .ndjson recording for diagnosis.`;
            return;
          }
        }
        ledger.value.sessions[staleSessionId] = {
          signature: burstSessionSignature(item), records: updatedRecords,
        };
      } else {
        delete ledger.value.sessions[staleSessionId];
      }
      refreshLedger();
      persistIndex();
      errorMessage.value = item
        ? `${sessionName} was refreshed from its saved recording. Review the updated rankings and select Export Comparison again.`
        : 'A source recording is no longer available. The leaderboard entry was removed.';
      return;
    }
    downloadBurstComparisonHTML(arcanaName, prepared);
    statusMessage.value = `Exported ${prepared.length} player${prepared.length === 1 ? '' : 's'} for ${arcanaName}.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to export this comparison.';
    console.warn('Burst comparison export failed:', error);
  } finally { if (!isUnmounted) exporting.value = false; }
}

async function scanNewSessions(): Promise<void> {
  if (scanning.value) return;
  if (exporting.value) return;
  scanning.value = true;
  discovering.value = true;
  statusMessage.value = '';
  errorMessage.value = '';
  completed.value = 0;
  currentSession.value = '';
  const token = ++runId;
  try {
    // The user opted in to this scan. Let the pending state paint first.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (isUnmounted || token !== runId) return;
    const available = (await getSessions()).filter(s => s.id !== 'live' && s.id !== 'live-session.ndjson' && s.id.endsWith('.ndjson'));
    if (isUnmounted || token !== runId) return;
    const names: Record<string, string> = {};
    for (const item of available) names[item.id] = item.name;
    knownSessionNames.value = names;
    if (retainAvailableBurstSessions(ledger.value, new Set(available.map(s => s.id)))) {
      refreshLedger();
      persistIndex();
    }
    const newSessions = available.filter(session => ledger.value.sessions[session.id]?.signature !== burstSessionSignature(session));
    toProcess.value = newSessions.length;
    discovering.value = false;
    let failures = 0;
    // Deliberately serial and exclusively user-initiated: nothing runs during
    // live capture, on a timer, or from the session-saving path.
    for (const session of newSessions) {
      if (isUnmounted || token !== runId) return;
      currentSession.value = session.name;
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (isUnmounted || token !== runId) return;
      try {
        const summary = await getSessionSummary(session.id);
        if (isUnmounted || token !== runId) return;
        ledger.value.sessions[session.id] = {
          signature: burstSessionSignature(session),
          records: computeSessionBursts(summary, session.id, session.name),
        };
        refreshLedger();
        persistIndex();
      } catch (error) {
        failures++;
        console.warn('Could not index saved session for burst leaderboard:', session.id, error);
      }
      completed.value++;
    }
    if (failures) errorMessage.value = `${failures} session(s) could not be read. Select Update Leaderboards to retry.`;
    statusMessage.value = newSessions.length ? `${newSessions.length - failures} recording(s) indexed${failures ? `; ${failures} failed` : ''}.` : 'Already up to date. No new recordings.';
  } catch (error) {
    if (!isUnmounted) {
      errorMessage.value = 'Unable to list saved sessions. Try checking again.';
      console.warn('Burst leaderboard session discovery failed:', error);
    }
  } finally {
    if (!isUnmounted && token === runId) {
      scanning.value = false;
      discovering.value = false;
      currentSession.value = '';
    }
  }
}
function rebuildIndex(): void {
  if (scanning.value) return;
  if (exporting.value) return;
  ledger.value = newBurstIndex();
  persistIndex();
  void scanNewSessions();
}
onUnmounted(() => { isUnmounted = true; runId++; });
</script>

<style scoped>
.records-view { max-width: 1240px; margin: 0 auto; }
.records-card { background: rgba(30, 39, 53, .55); }
.records-arcana-list :deep(.v-slide-group__content) { padding-bottom: 2px; }
.records-table { background: transparent; }
.records-table :deep(th) { color: rgba(210, 219, 230, .75); }
.records-table :deep(td), .records-table :deep(th) { padding: 10px 12px; }
.rank-col { width: 42px; }
.select-col { width: 44px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.session-col { max-width: 260px; }
</style>
