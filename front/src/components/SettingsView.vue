<template>
  <v-container fluid>
    <v-card class="mx-auto" max-width="800">
      <v-toolbar color="surface" flat>
        <v-toolbar-title class="text-h5">Settings</v-toolbar-title>
      </v-toolbar>

      <v-tabs v-model="activeTab" bg-color="surface">
        <v-tab value="capture"><v-icon start>mdi-lan</v-icon> Capture</v-tab>
        <v-tab value="history"><v-icon start>mdi-trending-up</v-icon> Personal Best</v-tab>
        <v-tab value="appearance"><v-icon start>mdi-palette</v-icon> Appearance</v-tab>
        <v-tab value="experimental"><v-icon start>mdi-flask-outline</v-icon> Experimental</v-tab>
      </v-tabs>

      <v-card-text>
        <v-window v-model="activeTab">
          <!-- Healing UI visibility only: capture and recorded healing remain intact. -->
          <v-window-item value="experimental">
            <v-card variant="outlined" class="pa-4">
              <div class="text-h6 mb-2">Experimental features</div>
              <v-switch v-model="showHealingTab" color="primary" label="Show Healing Done tab" hint="Healing attribution and overshield statistics are still under investigation. Hidden by default; saved healing data is never deleted. Minimalist Mode disables new healing recording." persistent-hint />

            </v-card>
          </v-window-item>
          <v-window-item value="history">
            <v-card variant="outlined" class="pa-4">
              <div class="text-h6 mb-2">Personal Best Progress</div>
              <div class="text-body-2 text-medium-emphasis mb-4">Compare individual skill DPS with older saved sessions. Only positive improvements are highlighted. Harmonic Saint history is excluded.</div>
              <v-text-field v-model.number="personalBestSessionLimit" type="number" label="Maximum previous sessions to check" :min="5" :max="200" :step="5" variant="outlined" hint="Look back this many saved sessions (5–200), including sessions where the player is absent. Harmonic Saint-only history may extend the search." persistent-hint class="mb-4" />
              <v-text-field v-model="personalBestHistoryFolder" label="Comparison history folder" placeholder="Default Midir saved sessions folder" variant="outlined" hint="Leave empty to use Midir's normal saved sessions. Or enter the full path of a folder containing saved .ndjson sessions." persistent-hint class="mb-2" />
              <div class="d-flex ga-2 align-center flex-wrap">
                <v-btn color="primary" variant="tonal" prepend-icon="mdi-folder-open" :loading="historyFolderPicking" @click="browseHistoryFolder">Browse folder</v-btn>
                <v-btn variant="text" @click="personalBestHistoryFolder = ''">Use default folder</v-btn>
              </div>
              <v-alert v-if="historyFolderError" class="mt-3" type="warning" variant="tonal" density="compact">{{ historyFolderError }}</v-alert>
              <div class="text-caption text-medium-emphasis mt-3">These settings affect saved-session comparisons only, not live parsing or where new sessions are saved.</div>
            </v-card>
          </v-window-item>
          <!-- CAPTURE TAB -->
          <v-window-item value="capture">
            <!-- CARD 1: CAPTURE CONFIGURATION -->
            <v-card variant="outlined" class="mb-4" style="border-color: rgba(140, 158, 255, 0.25) !important;">
              <v-card-item class="pb-1 pt-2">
                <div class="d-flex align-center justify-space-between w-100 flex-wrap">
                  <v-card-title class="text-subtitle-2 d-flex align-center font-weight-bold text-white" style="font-size: 0.875rem !important;">
                    <v-icon start size="small" color="primary" class="mr-2">mdi-cog</v-icon>
                    Capture Configuration
                  </v-card-title>

                  <v-chip
                    v-if="captureStatus.is_running"
                    color="success"
                    size="small"
                    variant="tonal"
                    class="font-weight-bold px-2"
                    style="height: 22px; font-size: 10px;"
                  >
                    <v-icon start size="12" class="mr-1">mdi-radiobox-marked</v-icon>
                    Running: {{ captureStatus.nic || 'File/Unknown' }}
                    <span v-if="captureStatus.exitlag" class="ml-1 text-grey-lighten-2">(ExitLag)</span>
                    <span v-if="captureStatus.mudfish" class="ml-1 text-grey-lighten-2">(Mudfish)</span>
                  </v-chip>
                  <v-chip
                    v-else
                    color="warning"
                    size="small"
                    variant="tonal"
                    class="font-weight-bold px-2"
                    style="height: 22px; font-size: 10px;"
                  >
                    <v-icon start size="12" class="mr-1">mdi-pause-circle-outline</v-icon>
                    Stopped
                  </v-chip>
                </div>
              </v-card-item>

              <v-card-text class="pt-3">
                <v-form @submit.prevent="applyCaptureSettings">
                  <v-select
                    v-model="captureConfig.nicName"
                    :items="nics"
                    item-title="description"
                    item-value="name"
                    label="Network Interface (NIC)"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-4"
                  >
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props" :subtitle="item.raw.ip ? 'IP: ' + item.raw.ip : 'No IP'"></v-list-item>
                    </template>
                    <template v-slot:selection="{ item }">
                      <span>{{ item.raw.description || item.raw.name }} ({{ item.raw.ip || 'No IP' }})</span>
                    </template>
                  </v-select>

                  <v-slider
                    v-model="captureConfig.preCombatBufferSeconds"
                    :min="0" :max="30" :step="5" thumb-label
                    label="Pre-combat Skill Use buffer (seconds)"
                    color="primary" class="mt-4 mb-3" hide-details
                  ></v-slider>
                  <div class="text-caption text-medium-emphasis mb-3">0 disables buffering. Only observed player Skill Use events are held temporarily; normal encounter start/stop rules do not change. Apply capture settings to take effect.</div>
                  <v-switch
                    v-model="captureConfig.promiscuous"
                    label="Enable Npcap Promiscuous Mode"
                    color="primary"
                    hide-details
                    inset
                    class="mb-1"
                  ></v-switch>
                  <div class="text-caption text-grey-lighten-2 mb-4 ml-14">
                    Turn this ON if you are capturing packets from a mirrored switch port.
                    <div class="text-error mt-1">
                      <strong>Warning:</strong> Enabling this on the same PC you run the game will NGS you.
                    </div>
                  </div>

                  <v-switch
                    v-model="captureConfig.exitlag"
                    label="Enable ExitLag Routing"
                    color="primary"
                    hide-details
                    inset
                    class="mb-2"
                    @update:model-value="onExitLagToggle"
                  ></v-switch>
                  <v-expand-transition>
                    <div
                      v-show="captureConfig.exitlag"
                      class="text-caption text-grey-lighten-2 mb-4 ml-14"
                    >
                      ExitLag mode captures TCP on the selected interface and follows decoded game packets automatically.
                    </div>
                  </v-expand-transition>

                  <v-switch
                    v-model="captureConfig.mudfish"
                    color="primary"
                    hide-details
                    inset
                    class="mb-2"
                    @update:model-value="onMudfishToggle"
                  >
                    <template v-slot:label>
                      <span class="d-inline-flex align-center ga-2">
                        <span>Enable Mudfish Routing</span>
                        <v-chip
                          color="warning"
                          size="x-small"
                          variant="tonal"
                          class="font-weight-bold px-1.5"
                          style="height: 18px; font-size: 9px;"
                        >
                          BETA
                        </v-chip>
                      </span>
                    </template>
                  </v-switch>
                  <v-expand-transition>
                    <div
                      v-show="captureConfig.mudfish"
                      class="text-caption text-grey-lighten-2 mb-4 ml-14"
                    >
                      Select your normal Ethernet NIC (mirrored switch port, or the game PC's physical NIC for same-PC capture).
                      Do not select Mudfish's virtual adapter. Enable Mudfish mode so Midir unwraps game TCP from Mudfish's outer UDP/TCP tunnel.
                      Outer Connection Protocol can stay UDP.
                    </div>
                  </v-expand-transition>

                  <div class="d-flex ga-2 mt-4">
                    <v-btn
                      v-if="!captureStatus.is_running"
                      color="primary"
                      type="submit"
                      prepend-icon="mdi-play"
                      :loading="isApplying"
                    >
                      Start Capture
                    </v-btn>

                    <v-btn
                      v-if="captureStatus.is_running"
                      color="primary"
                      prepend-icon="mdi-refresh"
                      @click="restartCaptureKeepSession"
                      :loading="isRestartingKeepSession"
                    >
                      Reconnect Capture
                    </v-btn>

                    <v-btn
                      v-if="captureStatus.is_running"
                      color="error"
                      variant="outlined"
                      prepend-icon="mdi-stop"
                      @click="stopCapture"
                      :loading="isStopping"
                    >
                      Stop Capture
                    </v-btn>
                  </div>
                </v-form>
              </v-card-text>
            </v-card>

            <!-- CARD 2: MINIMALIST MODE (applies immediately, independent of the capture form) -->
            <v-card variant="outlined" class="pa-4 mb-4">
              <div class="text-h6 mb-2">Minimalist Mode</div>
              <v-switch :model-value="minimalistEnabled" @update:model-value="updateMinimalistMode"
                :disabled="!minimalistLoaded || minimalistBusy" :loading="minimalistBusy" color="primary"
                label="Enable Minimalist Mode" hide-details />
              <p class="text-body-2 text-medium-emphasis mt-2">Pause live charts during combat and reduce live hit-history updates. Damage and skill evidence remain available for saved-session analysis and exports.</p>
              <p class="text-caption text-medium-emphasis mt-2">Healing Done and shield attribution are not recorded while enabled. Changing this mid-session marks healing data incomplete. No capture restart is required.</p>
              <v-alert v-if="minimalistError" type="warning" variant="tonal" density="compact" class="mt-3">{{ minimalistError }}</v-alert>
            </v-card>

            <!-- CARD 3: SYSTEM DIAGNOSTICS & TELEMETRY -->
            <v-card variant="outlined" class="mb-4" style="border-color: rgba(140, 158, 255, 0.25) !important;">
              <v-card-item class="pb-1 pt-2">
                <div class="d-flex align-center justify-space-between w-100 flex-wrap">
                  <v-card-title class="text-subtitle-2 d-flex align-center font-weight-bold text-white" style="font-size: 0.875rem !important;">
                    <v-icon start size="small" color="primary" class="mr-2">mdi-chart-line</v-icon>
                    System Diagnostics & Telemetry
                  </v-card-title>
                </div>
              </v-card-item>

              <v-card-text class="pb-3">
                <v-row dense>
                  <!-- Col 1: Decoded Packets -->
                  <v-col cols="12" sm="6" class="py-1">
                    <div class="d-flex align-center">
                      <v-icon color="success" size="small" class="mr-2">mdi-swap-horizontal-bold</v-icon>
                      <div>
                        <div class="text-caption font-weight-bold text-white">Decoded Packets</div>
                        <div class="text-caption text-grey-lighten-3">
                          {{ formatNumber(packetStatus.total) }} total ({{ formatNumber(packetStatus.perSecond) }}/sec)
                        </div>
                      </div>
                    </div>
                  </v-col>

                  <!-- Col 2: Dropped Packets -->
                  <v-col cols="12" sm="6" class="py-1">
                    <div class="d-flex align-center">
                      <v-icon
                        :color="((packetStatus.pcapDrops || 0) + (packetStatus.parserErrors || 0) + (packetStatus.networkLoss || 0) + (packetStatus.queueDrops || 0) > 0) ? 'red-lighten-1' : 'grey-lighten-1'"
                        size="small"
                        class="mr-2"
                      >
                        mdi-alert-circle
                      </v-icon>
                      <div>
                        <div class="text-caption font-weight-bold text-white">Dropped Packets</div>
                        <div class="text-caption text-grey-lighten-3">
                          Npcap: {{ packetStatus.pcapDrops || 0 }} · Parser: {{ packetStatus.parserErrors || 0 }} (Loss: {{ packetStatus.networkLoss || 0 }})
                        </div>
                      </div>
                    </div>
                  </v-col>

                  <!-- Col 3: Go Runtime Memory -->
                  <v-col cols="12" sm="6" class="py-1">
                    <div class="d-flex align-center">
                      <v-icon color="teal-lighten-2" size="small" class="mr-2">mdi-server</v-icon>
                      <div>
                        <div class="text-caption font-weight-bold text-white">Go Runtime Memory</div>
                        <div class="text-caption text-grey-lighten-3">
                          Heap: {{ formatBytes(packetStatus.heapAlloc || 0) }} ({{ packetStatus.goroutines || 0 }} threads)
                        </div>
                      </div>
                    </div>
                  </v-col>

                  <!-- Col 4: Active Tracked Entities -->
                  <v-col cols="12" sm="6" class="py-1">
                    <div class="d-flex align-center justify-space-between">
                      <div class="d-flex align-center">
                        <v-icon color="blue-lighten-2" size="small" class="mr-2">mdi-account-group</v-icon>
                        <div>
                          <div class="text-caption font-weight-bold text-white">Active Tracked Entities</div>
                          <div class="text-caption text-grey-lighten-3">
                            {{ packetStatus.trackedEntities || 0 }} cached entities
                          </div>
                        </div>
                      </div>
                      <v-btn
                        variant="tonal"
                        size="x-small"
                        color="blue-lighten-2"
                        class="ml-2 font-weight-bold"
                        style="font-size: 0.65rem !important;"
                        @click="showEntitiesDialog = true"
                      >
                        View List
                      </v-btn>
                    </div>
                  </v-col>
                </v-row>

                <v-divider class="my-3 border-opacity-25"></v-divider>

                <!-- Live Session Event Buffer Section -->
                <div class="d-flex align-center mb-2">
                  <v-icon color="amber-darken-1" size="small" class="mr-2">mdi-database</v-icon>
                  <div>
                    <div class="text-caption font-weight-bold text-white">Live Session Event Buffer</div>
                    <div class="text-caption text-grey-lighten-3">
                      {{ formatNumber(packetStatus.bufferEvents || 0) }} events ({{ formatBytes(packetStatus.bufferBytes || 0) }} total buffered)
                    </div>
                  </div>
                </div>

                <v-row dense class="mt-1">
                  <!-- Col 1: Core Combat & Entity Presence -->
                  <v-col cols="12" sm="4" class="py-1 px-2">
                    <div
                      v-for="eventName in ['Damage', 'Entity Appear', 'Entity Disappear']"
                      :key="eventName"
                      class="d-flex justify-space-between align-center py-1 border-b"
                      style="border-color: rgba(255, 255, 255, 0.08) !important; font-size: 0.75rem;"
                    >
                      <span class="text-grey-lighten-2 text-truncate mr-1">{{ eventName }}</span>
                      <span class="font-weight-bold text-white">{{ formatNumber(packetStatus.eventBreakdown?.[eventName] || 0) }}</span>
                    </div>
                  </v-col>

                  <!-- Col 2: Vitality & Status States -->
                  <v-col cols="12" sm="4" class="py-1 px-2">
                    <div
                      v-for="eventName in ['HP Update', 'Entity Death', 'Entity Revive']"
                      :key="eventName"
                      class="d-flex justify-space-between align-center py-1 border-b"
                      style="border-color: rgba(255, 255, 255, 0.08) !important; font-size: 0.75rem;"
                    >
                      <span class="text-grey-lighten-2 text-truncate mr-1">{{ eventName }}</span>
                      <span class="font-weight-bold text-white">{{ formatNumber(packetStatus.eventBreakdown?.[eventName] || 0) }}</span>
                    </div>
                  </v-col>

                  <!-- Col 3: Buffs & Session Metadata -->
                  <v-col cols="12" sm="4" class="py-1 px-2">
                    <!-- Blank first row for vertical alignment -->
                    <div class="py-1" style="font-size: 0.75rem; border-bottom: 1px solid transparent;">&nbsp;</div>
                    <div
                      v-for="eventName in ['Condition Enable', 'Condition Disable']"
                      :key="eventName"
                      class="d-flex justify-space-between align-center py-1 border-b"
                      style="border-color: rgba(255, 255, 255, 0.08) !important; font-size: 0.75rem;"
                    >
                      <span class="text-grey-lighten-2 text-truncate mr-1">{{ eventName }}</span>
                      <span class="font-weight-bold text-white">{{ formatNumber(packetStatus.eventBreakdown?.[eventName] || 0) }}</span>
                    </div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- APPEARANCE TAB -->
          <v-window-item value="appearance">
            <v-list>
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon icon="mdi-palette"></v-icon>
                </template>
                <v-list-item-title>Use Arcana Colors for Visible Players</v-list-item-title>
                <v-list-item-subtitle class="mt-1">
                  If enabled, visible players will be colored based on their active Talent/Arcana instead of a random color.
                  Hidden players always use Arcana Colors.
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-switch
                    v-model="showClassColorsForVisiblePlayers"
                    color="primary"
                    hide-details
                    inset
                  ></v-switch>
                </template>
              </v-list-item>

              <v-list-item class="mt-2">
                <template v-slot:prepend>
                  <v-icon icon="mdi-chart-bar"></v-icon>
                </template>
                <v-list-item-title>DPS Meter Bar Style</v-list-item-title>
                <v-list-item-subtitle class="mt-1">
                  Choose how the damage contribution percentage is displayed. Either as a dedicated column or filling the entire row.
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-btn-toggle
                    v-model="dpsMeterFillMode"
                    mandatory
                    density="compact"
                    color="primary"
                    variant="outlined"
                  >
                    <v-btn value="column" size="small">Column</v-btn>
                    <v-btn value="full" size="small">Full Row</v-btn>
                  </v-btn-toggle>
                </template>
              </v-list-item>
            </v-list>

            <v-divider class="my-4"></v-divider>

            <ColorSettings />
            <v-divider class="my-4"></v-divider>
            <ClassColorSettings />
            <v-divider class="my-4" />
            <v-card variant="outlined" class="pa-4 mb-4">
              <div class="text-h6 mb-2">Session Naming</div>
              <div class="text-body-2 text-medium-emphasis">Customize editable names suggested when saving live sessions. Uses the local recording start date and time.</div>
              <v-switch v-model="sessionNamePreferences.includeDate" color="primary" label="Include date in default name" hide-details />
              <v-switch v-model="sessionNamePreferences.includeTime" color="primary" label="Include time in default name" hide-details />
              <v-switch v-model="sessionNamePreferences.includeRun" color="primary" label="Include run count in default name" hide-details />
              <div class="mt-3"><RunCountSettings :rule="sessionNamePreferences.count" /></div>
              <div class="text-caption text-medium-emphasis mb-3">Default example: {{ defaultNamingPreview }}</div>
              <v-divider class="mb-3" />
              <div class="text-h6 mb-2">Group Run Scheduler</div>
              <p class="text-body-2 text-medium-emphasis mb-3">Assign a label and naming template to recurring local run times. First matching enabled schedule wins; drag-free priority controls move rules up or down. Scheduled templates override general naming switches.</p>
              <div v-for="(group, index) in sessionNamePreferences.schedules" :key="index" class="mb-3">
                <v-card variant="outlined" class="pa-3">
                  <div class="d-flex align-center flex-wrap ga-2 mb-2">
                    <span class="text-subtitle-2">{{ index + 1 }}. {{ group.label || 'New group' }}</span>
                    <v-spacer />
                    <v-btn icon="mdi-chevron-up" size="small" variant="text" aria-label="Move schedule up" :disabled="index === 0" @click="moveGroup(index, -1)" />
                    <v-btn icon="mdi-chevron-down" size="small" variant="text" aria-label="Move schedule down" :disabled="index === sessionNamePreferences.schedules.length - 1" @click="moveGroup(index, 1)" />
                    <v-btn icon="mdi-delete-outline" size="small" variant="text" aria-label="Remove schedule" @click="sessionNamePreferences.schedules.splice(index, 1)" />
                  </div>
                  <v-switch v-model="group.enabled" label="Enabled" color="primary" hide-details density="compact" />
                  <v-text-field v-model="group.label" label="Group label" placeholder="Friends Group, Company Team, Sports Club…" variant="outlined" density="compact" hide-details class="mt-2" />
                  <div class="text-caption mt-3 mb-1">Start days</div>
                  <v-btn-toggle v-model="group.days" multiple color="primary" variant="outlined" density="compact" class="flex-wrap" style="height: auto; max-width: 100%;">
                    <v-btn v-for="(day, dayIndex) in namingWeekdays" :key="day" :value="dayIndex" size="small">{{ day.slice(0, 3) }}</v-btn>
                  </v-btn-toggle>
                  <v-row dense class="mt-3">
                    <v-col cols="12" sm="6"><v-text-field v-model="group.start" type="time" label="Start (local)" variant="outlined" density="compact" hide-details /></v-col>
                    <v-col cols="12" sm="6"><v-text-field v-model="group.end" type="time" label="End (local)" variant="outlined" density="compact" hide-details /></v-col>
                  </v-row>
                  <p class="text-caption text-medium-emphasis mb-3">{{ group.start === group.end ? 'Equal times mean a full 24-hour window.' : group.end < group.start ? 'Continues into the following day.' : 'Ends on the same day.' }}</p>
                  <v-text-field v-model="group.template" label="Naming template" variant="outlined" density="compact" hide-details />
                  <div class="text-caption text-medium-emphasis my-2">Tokens: <code>{encounter}</code> <code>{label}</code> <code>{weekday}</code> <code>{run}</code> <code>{date}</code> <code>{time}</code></div>
                  <RunCountSettings :rule="group.count" allow-scheduled />
                  <v-alert v-if="!validGroupSchedule(group)" type="warning" variant="tonal" density="compact" class="mt-2">Enter a label, at least one start day, valid times and a valid template before this rule can match.</v-alert>
                  <div v-else class="text-caption text-medium-emphasis mt-2" style="overflow-wrap: anywhere;">Example (run 1): {{ groupPreview(group) }}</div>
                </v-card>
              </div>
              <v-btn variant="outlined" size="small" prepend-icon="mdi-plus" @click="sessionNamePreferences.schedules.push(newGroupSchedule())">Add group schedule</v-btn>
              <p class="text-caption text-medium-emphasis mt-3 mb-3">Group counts include only saved recordings assigned to that group by the current schedule rules. Weekly counts can span multiple scheduled evenings. A scheduled-window count resets for each start-day window. Rolling counts can decrease as older recordings expire. Deleting sessions can reuse numbers.</p>
              <v-divider class="mb-3" />
              <v-switch v-model="sessionNamePreferences.customEnabled" color="primary" label="Enable fallback custom naming template" hide-details />
              <div v-if="sessionNamePreferences.customEnabled" class="mt-3">
                <v-text-field v-model="sessionNamePreferences.template" label="Naming template" variant="outlined" density="comfortable"
                  :error="!namingTemplateValid" :error-messages="namingTemplateValid ? [] : ['Use a nonempty template with recognized tokens only. Default naming will be used until corrected.']" />
                <div class="text-caption text-medium-emphasis mb-3">Tokens: <code>{encounter}</code> <code>{label}</code> <code>{weekday}</code> <code>{run}</code> <code>{date}</code> <code>{time}</code>. Type any literal text as well. Custom templates use their explicit date/time tokens instead of the default switches.</div>
                <v-switch v-model="sessionNamePreferences.applyEveryDay" color="primary" label="Apply template on days without a label" hide-details class="mb-3" />
                <div class="text-subtitle-2 mb-2">Custom weekday labels</div>
                <div class="text-caption text-medium-emphasis mb-3">Each day can have any label, such as Friends Group, Company Team or Sports Club. Blank days use the default format unless the option above is enabled.</div>
                <v-row v-for="(day, index) in namingWeekdays" :key="day" dense align="center" class="mb-1">
                  <v-col cols="12" sm="5">
                    <v-text-field v-model="sessionNamePreferences.labels[index]" :label="day" placeholder="No label" variant="outlined" density="compact" hide-details />
                  </v-col>
                  <v-col cols="12" sm="7" class="text-caption text-medium-emphasis" style="overflow-wrap: anywhere;">{{ namingPreviews[index] }}</v-col>
                </v-row>
                <p class="text-caption text-medium-emphasis mt-3">Preview uses sample Bri 4p recordings and run 1. Fallback templates use the general counting period. Deleting a recording can reuse a number; cancelling the dialog does not reserve a number.</p>
                <v-btn variant="text" size="small" class="mt-2" @click="resetNamingTemplate">Reset template</v-btn>
              </div>
            </v-card>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>

  <!-- Dialog for Categorized Active Tracked Entities -->
  <v-dialog v-model="showEntitiesDialog" max-width="1600" width="95%">
    <v-card class="modern-card border border-opacity-10" style="background: linear-gradient(145deg, #181d28 0%, #10121a 100%) !important; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <v-card-title class="text-h6 font-weight-bold text-white d-flex align-center justify-space-between py-3 px-4" style="border-bottom: 1px solid rgba(255,255,255,0.08) !important;">
        <div class="d-flex align-center">
          <v-icon color="blue-lighten-2" class="mr-2">mdi-account-group</v-icon>
          <span>Active Tracked Entities</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" color="grey" @click="showEntitiesDialog = false"></v-btn>
      </v-card-title>

      <v-card-text class="pa-4" style="max-height: 800px; overflow-y: auto;">
        <div v-if="!fightSummary.currentEntities || fightSummary.currentEntities.length === 0" class="text-center text-grey py-8">
          <v-icon size="large" class="mb-2">mdi-alert-circle-outline</v-icon>
          <div>No active entities tracked in the current area.</div>
        </div>

        <div v-else>
          <!-- Search and Tab bar -->
          <div class="d-flex flex-column flex-sm-row justify-space-between align-stretch align-sm-center mb-4 gap-3">
            <v-tabs v-model="activeEntityTab" bg-color="transparent" color="blue-lighten-2" density="compact">
              <v-tab value="Players" class="text-none">Players</v-tab>
              <v-tab value="Summons" class="text-none">Summons</v-tab>
              <v-tab value="Enemies" class="text-none">Enemies</v-tab>
              <v-tab value="NPCs" class="text-none">NPCs</v-tab>
              <v-tab value="All" class="text-none">All</v-tab>
            </v-tabs>
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              placeholder="Search by name, ID, or owner..."
              density="compact"
              hide-details
              variant="solo-filled"
              style="max-width: 320px;"
              clearable
            ></v-text-field>
          </div>

          <!-- Entities List -->
          <div v-if="filteredEntities.length === 0" class="text-center text-grey py-8">
            <v-icon size="large" class="mb-2">mdi-magnify-close</v-icon>
            <div>No matching entities found.</div>
          </div>
          <v-row v-else dense class="align-stretch">
            <v-col 
              v-for="entity in filteredEntities" 
              :key="entity.id"
              cols="12"
              sm="6"
              md="4"
              class="py-2 px-2"
            >
              <div class="px-3 py-3 rounded d-flex flex-column h-100 entity-card">
                <!-- Name & Category Badge -->
                <div class="d-flex justify-space-between align-start mb-1">
                  <div class="text-subtitle-2 text-white font-weight-bold" style="word-break: break-word; overflow-wrap: anywhere; line-height: 1.2;">
                    {{ entity.name }}
                  </div>
                  <v-chip :color="getCategoryBadge(entity).color" size="x-small" label class="text-uppercase font-weight-black ml-2 flex-shrink-0">
                    {{ getCategoryBadge(entity).text }}
                  </v-chip>
                </div>

                <!-- Thin HP Bar (if maxHp > 0) -->
                <div v-if="entity.maxHp > 0" class="mt-1 mb-2">
                  <div class="d-flex justify-space-between text-caption text-grey mb-1" style="font-size: 0.65rem;">
                    <span>HP</span>
                    <span class="text-green-lighten-2 font-weight-bold">
                      {{ formatNumber(Math.round(entity.currentHp)) }} / {{ formatNumber(Math.round(entity.maxHp)) }}
                    </span>
                  </div>
                  <div class="w-100" style="height: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 2px; overflow: hidden;">
                    <div 
                      :style="{ width: (entity.currentHp / entity.maxHp) * 100 + '%' }" 
                      style="height: 100%; background: #4caf50; transition: width 0.3s ease;"
                    ></div>
                  </div>
                </div>
                <div v-else class="mb-2"></div>

                <!-- Structured Key-Value Fields -->
                <div class="d-flex flex-column flex-grow-1 justify-end" style="gap: 4px;">
                  <!-- Row: Entity ID -->
                  <div class="d-flex justify-space-between text-caption text-grey" style="font-size: 0.68rem; line-height: 1.2;">
                    <span class="font-weight-medium">Entity ID</span>
                    <span style="font-family: monospace;" class="text-white">{{ entity.id }}</span>
                  </div>

                  <!-- Row: Owner Info (if Pet, Golem, Marionette, Dollbag) -->
                  <div v-if="entity.ownerId || entity.secondaryOwnerId" class="d-flex justify-space-between text-caption text-grey" style="font-size: 0.68rem; line-height: 1.2;">
                    <span class="font-weight-medium">Owner</span>
                    <span class="text-white text-right font-weight-bold" style="word-break: break-word; overflow-wrap: anywhere; max-width: 70%;">
                      {{ entity.ownerName || entity.secondaryOwnerName || 'Unknown Player' }} 
                      <span style="font-family: monospace; font-size: 0.6rem;" class="text-grey ml-1">({{ entity.ownerId || entity.secondaryOwnerId }})</span>
                    </span>
                  </div>

                  <!-- Row: Race -->
                  <div class="d-flex justify-space-between text-caption text-grey" style="font-size: 0.68rem; line-height: 1.2;">
                    <span class="font-weight-medium">Race</span>
                    <span class="text-white text-right" style="word-break: break-word; overflow-wrap: anywhere; max-width: 70%;">
                      {{ entity.raceName }} <span class="text-grey ml-1 font-weight-normal">({{ entity.raceId }})</span>
                    </span>
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </div>
      </v-card-text>

      <v-card-actions class="justify-end py-2 px-4" style="border-top: 1px solid rgba(255,255,255,0.08) !important;">
        <v-btn color="primary" variant="text" @click="showEntitiesDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<!-- Settings include Personal Best search limits/folder and experimental Healing visibility. -->
<script lang="ts">
import { defineComponent, computed, ref, onMounted, onUnmounted } from "vue";
import { showClassColorsForVisiblePlayers, dpsMeterFillMode, socket, fightSummary, personalBestSessionLimit, personalBestHistoryFolder, showHealingTab, sessionNamePreferences } from "@/store";
import { defaultNameTemplate, formatSessionName, namingWeekdays, normalizeSessionNamePreferences, validSessionNameTemplate, newGroupSchedule, validGroupSchedule, type GroupSchedule } from "@/utils/sessionNameFormat";
import { pickPersonalBestHistoryFolder, getMinimalistMode, setMinimalistMode } from "@/apicall";
import ColorSettings from "./ColorSettings.vue";
import ClassColorSettings from "./ClassColorSettings.vue";
import RunCountSettings from "./RunCountSettings.vue";

export default defineComponent({
  name: "SettingsView",
  components: {
    ColorSettings,
    ClassColorSettings,
    RunCountSettings,
  },
  setup() {
    const activeTab = ref("capture");
    const namingPreferences = computed(() => normalizeSessionNamePreferences(sessionNamePreferences.value));
    const namingTemplateValid = computed(() => validSessionNameTemplate(namingPreferences.value.template));
    const defaultNamingPreview = computed(() => formatSessionName("Bri 4p", new Date(2027, 0, 11, 19, 30), { ...namingPreferences.value, customEnabled: false, schedules: [] }, 1));
    const namingPreviews = computed(() => namingWeekdays.map((_, i) => formatSessionName("Bri 4p", new Date(2027, 0, 10+i, 19, 30), { ...namingPreferences.value, schedules: [] }, 1)));
    const moveGroup = (index: number, offset: number) => {
      const groups = sessionNamePreferences.value.schedules;
      const target = index + offset;
      if (target < 0 || target >= groups.length) return;
      const [group] = groups.splice(index, 1);
      groups.splice(target, 0, group);
    };
    const groupPreview = (group: GroupSchedule) => {
      const [h, m] = group.start.split(':').map(Number);
      const sample = new Date(2027, 0, 10 + group.days[0], h, m);
      return formatSessionName('Bri 4p', sample, { ...namingPreferences.value, customEnabled: false, schedules: [{ ...group, enabled: true }] }, 1);
    };
    const resetNamingTemplate = () => { sessionNamePreferences.value.template = defaultNameTemplate; };

    const minimalistEnabled = ref(false);
    const minimalistLoaded = ref(false);
    const minimalistBusy = ref(false);
    const minimalistError = ref("");
    const loadMinimalistMode = async () => {
      try {
        minimalistEnabled.value = (await getMinimalistMode()).enabled;
        minimalistLoaded.value = true;
      } catch (error) { minimalistError.value = "Unable to read Minimalist Mode setting."; }
    };
    const updateMinimalistMode = async (value: boolean | null) => {
      if (!minimalistLoaded.value || minimalistBusy.value) return;
      minimalistBusy.value = true;
      minimalistError.value = "";
      try { minimalistEnabled.value = (await setMinimalistMode(value === true)).enabled; }
      catch (error) { minimalistError.value = "Unable to change Minimalist Mode. The previous setting remains active."; }
      finally { minimalistBusy.value = false; }
    };
    const historyFolderPicking = ref(false);
    const historyFolderError = ref("");
    const browseHistoryFolder = async () => {
      historyFolderPicking.value = true;
      historyFolderError.value = "";
      try { personalBestHistoryFolder.value = await pickPersonalBestHistoryFolder(); }
      catch (error) { historyFolderError.value = "Folder chooser is unavailable on this system. Enter the folder path above instead."; }
      finally { historyFolderPicking.value = false; }
    };
    const showEntitiesDialog = ref(false);

    const searchQuery = ref("");
    const activeEntityTab = ref("Players");

    const filteredEntities = computed(() => {
      if (!fightSummary || !fightSummary.currentEntities) {
        return [];
      }

      let list = fightSummary.currentEntities;
      if (activeEntityTab.value === "Players") {
        list = list.filter(e => e.category === "Players");
      } else if (activeEntityTab.value === "Summons") {
        list = list.filter(e => ["Marionettes", "Pets", "Dollbags", "Golems", "Mini-Gems", "Unknown Summons"].includes(e.category));
      } else if (activeEntityTab.value === "Enemies") {
        list = list.filter(e => e.category === "Enemies");
      } else if (activeEntityTab.value === "NPCs") {
        list = list.filter(e => e.category === "NPCs");
      }

      const query = searchQuery.value ? searchQuery.value.trim().toLowerCase() : "";
      if (query) {
        list = list.filter(e => 
          e.name.toLowerCase().includes(query) ||
          e.id.includes(query) ||
          (e.raceName && e.raceName.toLowerCase().includes(query)) ||
          (e.ownerName && e.ownerName.toLowerCase().includes(query)) ||
          (e.ownerId && e.ownerId.includes(query)) ||
          (e.secondaryOwnerName && e.secondaryOwnerName.toLowerCase().includes(query)) ||
          (e.secondaryOwnerId && e.secondaryOwnerId.includes(query))
        );
      }

      return list;
    });

    const getCategoryBadge = (entity: any) => {
      if (!entity) return { text: "Unknown", color: "grey" };
      const category = entity.category;
      switch (category) {
        case "Players":
          return { text: "Player", color: "green" };
        case "Marionettes":
          return { text: "Puppet", color: "purple" };
        case "Pets":
          return { text: "Pet", color: "blue" };
        case "Dollbags":
          return { text: "Dollbag", color: "pink" };
        case "Mini-Gems":
          return { text: "Mini-Gem", color: "indigo" };
        case "Golems":
          return { text: "Golem", color: "orange" };
        case "NPCs":
          return { text: "NPC", color: "teal" };
        case "Enemies":
          return { text: "Enemy", color: "red" };
        case "Unknown Summons":
          return { text: entity.entityTypeStr || "Unknown Summon", color: "deep-orange-darken-2" };
        default:
          return { text: category, color: "grey" };
      }
    };
    // --- CAPTURE SETTINGS ---
    const nics = ref<any[]>([]);
    const captureStatus = ref({ is_running: false, nic: '', exitlag: false, mudfish: false, promiscuous: false, preCombatBufferSeconds: 0 });
    const packetStatus = ref<{
      total: number;
      perSecond: number;
      lastPacketAt: string;
      lastOp: number;
      topOps: { op: number; count: number; total: number }[];
      activeConditions?: number;
      trackedEntities?: number;
      bufferEvents?: number;
      bufferBytes?: number;
      goroutines?: number;
      heapAlloc?: number;
      eventBreakdown?: Record<string, number>;
      pcapDrops?: number;
      parserErrors?: number;
      networkLoss?: number;
      queueDrops?: number;
    }>({
      total: 0,
      perSecond: 0,
      lastPacketAt: '',
      lastOp: 0,
      topOps: [],
      activeConditions: 0,
      trackedEntities: 0,
      bufferEvents: 0,
      bufferBytes: 0,
      goroutines: 0,
      heapAlloc: 0,
      eventBreakdown: {},
      pcapDrops: 0,
      parserErrors: 0,
      networkLoss: 0,
      queueDrops: 0,
    });
    const isApplying = ref(false);
    const isStopping = ref(false);
    const isRestartingKeepSession = ref(false);
    const captureConfig = ref({
      nicName: "",
      exitlag: false,
      mudfish: false,
      promiscuous: false,
      preCombatBufferSeconds: 0
    });

    const onExitLagToggle = (enabled: boolean | null) => {
      if (enabled) {
        captureConfig.value.mudfish = false;
      }
    };

    const onMudfishToggle = (enabled: boolean | null) => {
      if (enabled) {
        captureConfig.value.exitlag = false;
      }
    };

    const fetchNics = async () => {
      try {
        const res = await fetch("/api/setup/nics");
        if (res.ok) {
          nics.value = (await res.json()) || [];
        }
      } catch (err) {
        console.error("Failed to fetch nics:", err);
      }
    };

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (res.ok) {
          const data = await res.json();
          captureStatus.value = data;

          if (data.nic) captureConfig.value.nicName = data.nic;
          captureConfig.value.exitlag = data.exitlag || false;
          captureConfig.value.mudfish = data.mudfish || false;
          captureConfig.value.promiscuous = data.promiscuous || false;
          captureConfig.value.preCombatBufferSeconds = Number(data.preCombatBufferSeconds || 0);
        }
      } catch (err) {
        console.error("Failed to fetch capture status:", err);
      }
    };

    const applyCaptureSettings = async () => {
      if (!captureConfig.value.nicName) {
        alert("Please select a network interface.");
        return;
      }

      isApplying.value = true;
      try {
        const res = await fetch("/api/setup/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(captureConfig.value)
        });
        if (res.ok) {
          await fetchStatus();
        } else {
          const errMsg = await res.text();
          alert("Failed to start capture: " + errMsg);
        }
      } catch (err) {
        console.error("Error starting capture:", err);
        alert("Network error while trying to start capture.");
      } finally {
        isApplying.value = false;
      }
    };

    const restartCaptureKeepSession = async () => {
      if (!captureConfig.value.nicName) {
        alert("Please select a network interface.");
        return;
      }

      isRestartingKeepSession.value = true;
      try {
        const res = await fetch("/api/setup/restart-keep-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(captureConfig.value)
        });
        if (res.ok) {
          await fetchStatus();
        } else {
          const errMsg = await res.text();
          alert("Failed to reconnect capture: " + errMsg);
        }
      } catch (err) {
        console.error("Error reconnecting capture:", err);
        alert("Network error while trying to reconnect capture.");
      } finally {
        isRestartingKeepSession.value = false;
      }
    };

    const stopCapture = async () => {
      isStopping.value = true;
      try {
        const res = await fetch("/api/setup/stop", { method: "POST" });
        if (res.ok) {
           await fetchStatus();
        }
      } catch (err) {
        console.error("Error stopping capture:", err);
      } finally {
        isStopping.value = false;
      }
    };

    // --- AUTODETECT ---
    const isAutodetecting = ref(false);
    const autodetectProgress = ref(0);

    const startAutodetect = async () => {
      if (!captureConfig.value.nicName) return;
      isAutodetecting.value = true;
      autodetectProgress.value = 0;

      try {
        const res = await fetch("/api/setup/autodetect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nicName: captureConfig.value.nicName,
            promiscuous: captureConfig.value.promiscuous
          })
        });

        if (!res.ok) {
          isAutodetecting.value = false;
          alert("Failed to start auto-detect: " + await res.text());
        }
      } catch (err) {
        isAutodetecting.value = false;
        console.error("Error starting autodetect:", err);
      }
    };

    const stopAutodetect = async () => {
      isAutodetecting.value = false;
      try {
        await fetch("/api/setup/autodetect/stop", { method: "POST" });
      } catch (err) {
        console.error("Error stopping autodetect:", err);
      }
    };

     onMounted(async () => {
       void loadMinimalistMode();
       await fetchNics();
       await fetchStatus();

        if (captureConfig.value.nicName && nics.value.length > 0) {
          const exists = nics.value.some(nic => nic.name === captureConfig.value.nicName);
          if (!exists) {
            captureConfig.value.nicName = "";
          }
        }

       socket.onPacketStatus = (status) => {
         packetStatus.value = { ...status, topOps: status.topOps || [] };
       };

       socket.onAutodetectProgress = (progress) => {
         if (isAutodetecting.value) {
           autodetectProgress.value = progress.current;
         }
       };

       socket.onAutodetectDone = (result) => {
         if (isAutodetecting.value) {
           isAutodetecting.value = false;
           autodetectProgress.value = 5;
         }
       };
    });

    onUnmounted(() => {
       socket.onPacketStatus = undefined;
       socket.onAutodetectProgress = undefined;
       socket.onAutodetectDone = undefined;
       if (isAutodetecting.value) {
           fetch("/api/setup/autodetect/stop", { method: "POST" }).catch(console.error);
       }
    });

    const formatBytes = (bytes: number) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatNumber = (num: number) => {
      return num.toLocaleString();
    };

    return {
      activeTab,
      sessionNamePreferences, namingWeekdays, namingTemplateValid, defaultNamingPreview, namingPreviews, resetNamingTemplate, moveGroup, groupPreview, newGroupSchedule, validGroupSchedule,
      minimalistEnabled, minimalistLoaded, minimalistBusy, minimalistError, updateMinimalistMode,
      personalBestSessionLimit, personalBestHistoryFolder, historyFolderPicking, historyFolderError, browseHistoryFolder,
      showHealingTab,
      showClassColorsForVisiblePlayers,
      dpsMeterFillMode,

      // Capture
      nics,
      captureStatus,
      packetStatus,
      captureConfig,
      isApplying,
      isStopping,
      isRestartingKeepSession,
      applyCaptureSettings,
      restartCaptureKeepSession,
      stopCapture,
      onExitLagToggle,
      onMudfishToggle,

      // Autodetect
      isAutodetecting,
      autodetectProgress,
      startAutodetect,
      stopAutodetect,

      // Helpers
      formatBytes,
      formatNumber,

      // Entities Dialog
      fightSummary,
      showEntitiesDialog,
      searchQuery,
      activeEntityTab,
      filteredEntities,
      getCategoryBadge
    };
  },
});
</script>

<style scoped>
.entity-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.entity-card:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

:deep(.v-list-item-title) {
    white-space: normal !important;
}
:deep(.v-list-item-subtitle) {
    white-space: normal !important;
    overflow: visible !important;
    display: block !important;
    line-clamp: unset !important;
    -webkit-line-clamp: unset !important;
}
</style>
