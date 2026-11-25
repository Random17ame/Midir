<template>
  <v-app>
    <v-app-bar flat class="modern-header" height="64">
      <v-btn
        icon="mdi-menu"
        variant="text"
        size="small"
        class="mr-2 action-btn"
        @click="isNavDrawerOpen = !isNavDrawerOpen"
      ></v-btn>
      <div class="brand-section">
        <img src="/images/Midir.png" class="mascot-img" alt="Midir Logo" />
        <div class="logo-text">Midir</div>
      </div>

      <v-spacer></v-spacer>

      <div class="action-section">
        <v-progress-circular
          v-if="isLoading"
          indeterminate
          color="primary"
          size="20"
          width="2"
          class="mr-4"
        ></v-progress-circular>

        <template v-if="activeTool === 'dps'">
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-content-save"
            class="action-btn"
            :loading="isSaving"
            @click="triggerSaveSession"
          >
            Save Session
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-refresh"
            class="action-btn"
            @click="triggerClearSession"
          >
            Clear
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-trophy-outline"
            class="action-btn"
            @click="activeTool = 'records'"
            title="Personal Bests and Arcana burst leaderboards"
          >
            Bests
          </v-btn>

          <v-btn
            icon="mdi-cog"
            variant="text"
            size="small"
            class="ml-2 action-btn"
            @click="activeTool = 'settings'"
          ></v-btn>
        </template>

        <template v-else-if="activeTool === 'settings' || activeTool === 'records'">
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-arrow-left"
            color="primary"
            class="font-weight-bold"
            @click="activeTool = 'dps'"
          >
            Back to Meter
          </v-btn>
        </template>
      </div>
    </v-app-bar>

    <v-main>
      <damage-meter-view v-if="activeTool === 'dps'" />
      <settings-view v-else-if="activeTool === 'settings'" />
      <personal-bests-view v-else-if="activeTool === 'records'" />
    </v-main>

    <v-snackbar
      v-model="systemErrorVisible"
      :color="systemErrorType"
      timeout="-1"
      location="bottom right"
      multi-line
    >
      <div class="d-flex flex-column">
        <strong>{{ systemErrorType === 'error' ? 'System Error Recovered' : 'Network Warning' }}</strong>
        <span>{{ systemErrorMessage }}</span>
      </div>
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="systemErrorVisible = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Custom Clear Confirmation Dialog -->
    <v-dialog v-model="clearDialogVisible" max-width="450px" persistent>
      <v-card class="dialog-card">
        <v-card-title class="text-h5 d-flex align-center pt-4 px-6">
          <v-icon color="warning" class="mr-2">mdi-alert-decagram</v-icon>
          Clear Live Session
        </v-card-title>
        <v-card-text class="pt-2 px-6 pb-4 text-grey-lighten-1">
          Are you sure you want to clear the current live session data? This will reset all current DPS meters and graph data. This action cannot be undone.
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            class="font-weight-bold"
            @click="clearDialogVisible = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            class="font-weight-bold ml-2"
            @click="confirmClearSession"
          >
            Clear
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Custom Save Session Dialog -->
    <v-dialog v-model="saveDialogVisible" max-width="500px" persistent>
      <v-card class="dialog-card">
        <v-card-title class="text-h5 d-flex align-center pt-4 px-6">
          <v-icon color="primary" class="mr-2">mdi-content-save-cog</v-icon>
          Save Live Session
        </v-card-title>
        <v-card-text class="pt-2 px-6 pb-4 text-grey-lighten-1">
          Please enter a descriptive name for this live session to save it to your history. Suggested names use observed combat participants and boss progress, not a confirmed party roster or wipe.
          <v-alert v-if="saveNameWarning" type="warning" variant="tonal" density="compact" class="mt-3">{{ saveNameWarning }}</v-alert>
          <v-text-field
            ref="saveSessionInput"
            v-model="saveSessionName"
            label="Session Name"
            variant="outlined"
            density="comfortable"
            class="mt-4"
            hide-details
            autofocus
            color="primary"
            @keyup.enter="confirmSaveSession"
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            class="font-weight-bold"
            @click="saveDialogVisible = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="font-weight-bold ml-2"
            :loading="isSaving"
            :disabled="!saveSessionName.trim()"
            @click="confirmSaveSession"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, onMounted, onUnmounted, inject, ref, watch, computed, provide, reactive, nextTick } from "vue";
import { socket } from "@/store"; // Static import
import { FightSummary } from "./protocols";
import { CONDITION_COMBINATIONS } from "@/conditionCombinations";
import { initPlayerCache } from "@/playerCache";
import { PET_DAMAGE_SKILL_ID, PET_DAMAGE_SKILL_LABEL } from "@/utils/petLabels";
import { suggestSessionSaveName } from "@/utils/sessionSaveNaming";
import { needsRunNumber, formatSessionName, nextRunNumber, normalizeSessionNamePreferences, recordingLocalDate } from "@/utils/sessionNameFormat";
import DamageMeterView from "@/components/DamageMeterView.vue";
import SettingsView from "@/components/SettingsView.vue";
import { normalizeLiveFlags } from "@/utils/minimalistMode";
import {
  getSessionSummary,
  getSessions,
  getLiveSummary,
  saveSession,
  clearBackendState,
  getSkills,
  getRaces,
  getConditions,
  getOverrides,
} from "@/apicall";
import {
  activeSessionId,
  isNavDrawerOpen,
  fightSummary,
  selectedTargetId,
  activeTool,
  loadingCount,
  isLoading,
  sessions,
  pendingSessionSave,
  sessionNamePreferences,
} from "@/store";

// Lazy-load the records page: the normal meter never evaluates it.
const PersonalBestsView = defineAsyncComponent(() => import("@/components/PersonalBestsView.vue"));

export default defineComponent({
  name: "App",
  components: {
    DamageMeterView,
    SettingsView,
    PersonalBestsView,
  },
  setup() {
    const raceNameMap = inject("raceNameMap");
    const skillNameMap = inject("skillNameMap");
    const condNameMap = inject("condNameMap");
    const playerBatchUpdateEvent = ref<any[]>([]); 
    
    provide("playerBatchUpdateEvent", playerBatchUpdateEvent);
    
    const socketConnected = ref(false);

    // Socket is now statically imported
    socket.onConnect = (isConnected) => (socketConnected.value = isConnected);

    const handleSummary = (summary: FightSummary) => {
      summary.players = summary.players || {};
      summary.targets = summary.targets || {};
      summary.damageTaken = summary.damageTaken || {};
      summary.graphData = summary.graphData || {};
      summary.currentEntities = summary.currentEntities || [];
      normalizeLiveFlags(summary);
      Object.assign(fightSummary, summary);
    };
    
    // Handle player updates
    socket.onPlayerBatchUpdate = (players) => {
        playerBatchUpdateEvent.value = players;
    };
    
    // Handle system errors
    const systemErrorVisible = ref(false);
    const systemErrorMessage = ref("");
    const systemErrorType = ref<"error" | "warning">("error");

    socket.onSystemError = (msg) => {
      console.warn("System Error Received:", msg);
      systemErrorMessage.value = msg;
      systemErrorType.value = "error";
      systemErrorVisible.value = true;
    };

    const clearSession = async () => {
      // Clear the backend first: an API failure must never erase the only
      // remaining live data from the UI.
      await clearBackendState();
      if (activeSessionId.value !== "live") return;
      selectedTargetId.value = "";
      Object.assign(fightSummary, {
        liveChartPaused: false,
        liveCompact: false,
        healingIncomplete: fightSummary.minimalistMode === true,
        encounterDuration: 0,
        totalDamage: 0,
        players: {},
        targets: {},
        damageTaken: {},
        graphData: {},
      });
      console.log("Backend state cleared.");
    };

    const isSaving = ref(false);

    const clearDialogVisible = ref(false);
    
    const triggerClearSession = () => {
      clearDialogVisible.value = true;
    };

    const confirmClearSession = async () => {
      clearDialogVisible.value = false;
      await clearSession();
    };

    const saveDialogVisible = ref(false);
    const saveSessionName = ref("");
    const saveNameWarning = ref("");
    const saveSessionInput = ref<any>(null);

    let preparingSaveName = false;
    const triggerSaveSession = async () => {
      if (preparingSaveName || isSaving.value || saveDialogVisible.value) return;
      preparingSaveName = true;
      saveNameWarning.value = "";
      const preferences = normalizeSessionNamePreferences(sessionNamePreferences.value);
      let date = recordingLocalDate();
      let encounter = "Session";
      let run: number | undefined;
      try {
        // The save API always saves the live recording, never the historical
        // session currently displayed in the meter.
        const live = activeSessionId.value === "live" && !fightSummary.liveCompact && !fightSummary.minimalistMode ? fightSummary : await getLiveSummary();
        date = recordingLocalDate(live.startTime, date);
        encounter = suggestSessionSaveName(live, "Session");
      } catch (e) {
        console.warn("Unable to suggest live session name:", e);
        saveNameWarning.value = "Live encounter details were unavailable; using the current local date and time.";
      }
      try {
        if (needsRunNumber(preferences, date)) {
          // Refresh existing saved-session metadata only on demand. Never read
          // detailed combat logs or use mutable titles to determine the count.
          run = nextRunNumber(date, await getSessions(), preferences);
        }
      } catch (e) {
        console.warn("Unable to determine run number:", e);
        saveNameWarning.value = [saveNameWarning.value, "Run number unavailable; please enter it manually if needed."].filter(Boolean).join(" ");
      } finally {
        preparingSaveName = false;
      }
      const suggested = formatSessionName(encounter, date, preferences, run);
      saveSessionName.value = suggested;
      saveDialogVisible.value = true;
      nextTick(() => {
        const input = saveSessionInput.value?.$el?.querySelector("input");
        if (input) {
          input.focus();
          input.select();
        }
      });
    };

    const confirmSaveSession = async () => {
      if (isSaving.value) return; // Prevent duplicate submissions.
      const name = saveSessionName.value.trim();
      if (!name) return;

      isSaving.value = true;
      saveDialogVisible.value = false;
      pendingSessionSave.value = { name, startedAt: Date.now() };
      // Give Vue and the browser an opportunity to paint the pending session
      // before starting potentially expensive backend serialization.
      await nextTick();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      try {
        // Save returns only after the temporary NDJSON has been completely
        // written and atomically published. No expensive history scans needed.
        const saved = await saveSession(name);
        if (!saved?.id || saved.name !== name || !saved.id.endsWith(".ndjson")) {
          throw new Error("Save response did not identify a completed session. Check the sessions folder before retrying.");
        }
        sessions.value = [saved, ...sessions.value.filter(s => s.id !== saved.id)]
          .sort((a, b) => b.startTime - a.startTime);
        pendingSessionSave.value = null;
        // Preserve the existing safety rule: never erase live display state
        // until the backend has confirmed the session was saved.
        await clearSession();
      } catch (e) {
        console.error("Failed to save or finalize session:", e);
        alert(`Unable to confirm session saved: ${e}`);
      } finally {
        pendingSessionSave.value = null;
        isSaving.value = false;
      }
    };

    let sessionLoadGeneration = 0;
    watch(
      activeSessionId,
      async (newId) => {
        const generation = ++sessionLoadGeneration;
        console.log(`Active session changed to: ${newId}`);

        selectedTargetId.value = "";
        if (newId === "live") {
          socket.onSummary = summary => { if (activeSessionId.value === "live") handleSummary(summary); };
          try {
            if (loadingCount) loadingCount.value++;
            const summary = await getLiveSummary();
            if (generation === sessionLoadGeneration && activeSessionId.value === newId) handleSummary(summary);
          } catch (e) {
            console.error("Failed to load live summary:", e);
            alert(`Error loading live summary: ${e}`);
          } finally {
            if (loadingCount) loadingCount.value--;
          }
        } else if (newId && newId !== "file-load") {
          socket.onSummary = undefined;
          try {
            if (loadingCount) loadingCount.value++;
            const summary = await getSessionSummary(newId);
            if (generation === sessionLoadGeneration && activeSessionId.value === newId) handleSummary(summary);
          } catch (e) {
            console.error("Failed to load session summary:", e);
            alert(`Error loading session: ${e}`);
          } finally {
            if (loadingCount) loadingCount.value--;
          }
        } else {
          socket.onSummary = undefined;
        }
      },
      { immediate: true }
    );

    onMounted(async () => {
      initPlayerCache();
      try {
        loadingCount.value++;
        const [skills, races, conditions, overrides, captureStatusResp] = await Promise.all([
          getSkills(),
          getRaces(),
          getConditions(),
          getOverrides(),
          fetch("/api/setup/status").catch(() => null)
        ]);

        if (captureStatusResp && captureStatusResp.ok) {
            const statusData = await captureStatusResp.json();
            if (!statusData.is_running) {
                activeTool.value = "settings";
            }
        }
        for (const idStr in skills) {
          const skill = skills[idStr];
          if (skill.iconUrl && !skill.iconUrl.startsWith('/') && !skill.iconUrl.startsWith('http')) {
            skill.iconUrl = `/images/skills/${skill.iconUrl}`;
          }
          skillNameMap.value[parseInt(idStr, 10)] = skill;
        }
        for (const idStr in races) {
          raceNameMap.value[parseInt(idStr, 10)] =
            `${races[idStr].name} ${idStr}`;
        }
        for (const idStr in conditions) {
          const cond = conditions[idStr];
          if (cond.iconUrl && !cond.iconUrl.startsWith('/') && !cond.iconUrl.startsWith('http')) {
            cond.iconUrl = `/images/conditions/${cond.iconUrl}`;
          }
          condNameMap.value[parseInt(idStr, 10)] = cond;
        }

        // Apply overrides
        if (overrides) {
          if (overrides.skills) {
            for (const idStr in overrides.skills) {
              const id = parseInt(idStr, 10);
              const override = overrides.skills[idStr];
              const existing = skillNameMap.value[id] || { name: `Skill ${id}` };
              if (override.name) existing.name = override.name;
              if (override.iconUrl) {
                existing.iconUrl = override.iconUrl.startsWith('/') ? override.iconUrl : `/images/${override.iconUrl}`;
              }
              skillNameMap.value[id] = existing;
            }
          }
          if (overrides.conditions) {
            for (const idStr in overrides.conditions) {
              const id = parseInt(idStr, 10);
              const override = overrides.conditions[idStr];
              const existing = condNameMap.value[id] || { name: `Condition ${id}` };
              if (override.name) existing.name = override.name;
              if (override.iconUrl) {
                existing.iconUrl = override.iconUrl.startsWith('/') ? override.iconUrl : `/images/${override.iconUrl}`;
              }
              condNameMap.value[id] = existing;
            }
          }
        }

        // Skill 9999 is Midir's synthetic category for pet-attributed damage,
        // not a numbered game skill. Respect user-provided skill-name overrides.
        if (!skillNameMap.value[PET_DAMAGE_SKILL_ID]?.name) {
          skillNameMap.value[PET_DAMAGE_SKILL_ID] = { name: PET_DAMAGE_SKILL_LABEL, iconUrl: "" };
        }

        // Register virtual combined conditions
        for (const combo of CONDITION_COMBINATIONS) {
          const baseCond = condNameMap.value[combo.iconId];
          condNameMap.value[combo.id] = {
            name: combo.name,
            iconUrl: baseCond?.iconUrl || ""
          };
        }

      } catch (e) {
        console.error("Failed to load static data:", e);
        alert("Could not load game data from server.");
      } finally {
        loadingCount.value--;
      }
      socket.connect(); // Ensure we connect here
    });

    return {
      isLoading,
      isSaving,
      socketConnected,
      clearSession,
      activeTool,
      isNavDrawerOpen,
      systemErrorVisible,
      systemErrorMessage,
      systemErrorType,
      clearDialogVisible,
      saveDialogVisible,
      saveSessionName,
      saveNameWarning,
      saveSessionInput,
      triggerClearSession,
      confirmClearSession,
      triggerSaveSession,
      confirmSaveSession,
    };
  },
});
</script>

<style scoped>
.modern-header {
  background: transparent !important;
  z-index: 1000;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mascot-img {
  height: 42px;
  width: 42px;
  object-fit: cover;
  border-radius: 10px;
  border: 0px solid rgba(129, 138, 248, 0.3);
  box-shadow: 0 0 20px rgba(129, 138, 248, 0.2);
  transition: transform 0.3s ease;
}

.mascot-img:hover {
  transform: scale(1.1) rotate(5deg);
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: #fff;
  text-shadow: 0 0 15px rgba(129, 138, 248, 0.4);
}

.action-section {
  display: flex;
  align-items: center;
}

.action-btn {
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
  color: #fff !important;
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: #818cf8 !important; /* Primary Indigo */
  background: rgba(129, 138, 248, 0.08);
}

:deep(.v-toolbar__content) {
  padding: 0 24px !important;
}
</style>

<style>
.v-application {
  background: linear-gradient(145deg, #161922 0%, #0e1015 100%) !important;
}

.dialog-card {
  background: #171b24 !important;
  border: 1px solid rgba(129, 138, 248, 0.15) !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5) !important;
  border-radius: 12px !important;
}
</style>

