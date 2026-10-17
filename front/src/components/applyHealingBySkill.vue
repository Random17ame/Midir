<template>
  <v-data-table
    :headers="mainTableHeaders"
    :items="playerDisplayData"
    item-value="id"
    expand-on-click
    :expanded="expanded"
    @update:expanded="expanded = $event"
    class="elevation-1 pb-16 dps-table"
    :row-props="getRowProps"
    show-expand
    density="compact"
    :items-per-page="-1"
    hide-default-footer
  >
    <!-- Character Rows -->
    <template v-slot:[`item.name`]="{ item }">
    <div 
      @dblclick="isolateSinglePlayer(item.id)" 
      class="cursor-pointer d-flex align-center select-none w-100 h-100"
      title="Double-click to isolate this player & open scatter plot"
      style="min-height: 28px;"
    >
      <v-btn 
        icon 
        variant="text" 
        density="compact" 
        size="small" 
        class="mr-1" 
        @click.stop="toggleHiddenPlayer(item.id)"
      >
        <v-icon>{{ hiddenPlayers.has(item.id) ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
      </v-btn>
      <span class="font-weight-medium text-body-1 transition-all" 
        :style="{ color: getPlayerColor(item) }">
        {{ hiddenPlayers.has(item.id) ? 'Hidden' : item.name }}
      </span>
    </div>
  </template>

    <!-- Effective Heals -->
    <template v-slot:[`item.overallHealing.totalDamage`]="{ item }">
      <div class="text-right font-weight-bold">
        {{ formatAbbreviated(item.overallHealing?.totalDamage) }}
        <span class="text-grey font-weight-medium text-caption ml-1">
          ({{ totalHealingForView > 0 ? (((item.overallHealing?.totalDamage || 0) / totalHealingForView) * 100).toFixed(1) : '0.0' }}%)
        </span>
      </div>
    </template>

    <template v-slot:[`item.overallHealing.dps`]="{ item }">
      <div class="text-right font-weight-bold">
        {{ formatNumber(item.overallHealing?.dps) }} HPS
      </div>
    </template>

    <!-- Overshield Volume Column Row Display -->
    <template v-slot:[`item.overallHealing.overshieldProvided`]="{ item }">
      <div class="text-right font-weight-bold text-light-green-accent-3">
        {{ formatAbbreviated(item.overallHealing?.overshieldProvided || 0) }}
      </div>
    </template>

    <template v-slot:[`item.overallHealing.critRate`]="{ item }">
      <div class="text-center font-weight-bold text-amber">
        {{ (item.overallHealing?.critRate || 0).toFixed(1) }}%
      </div>
    </template>

    <!-- Expanded Skills Dropdown Section -->
    <template v-slot:expanded-row="{ columns, item }">
      <tr>
        <td :colspan="columns.length">
          <v-data-table
            :headers="computedSkillTableHeaders"
            :items="getSkillBreakdown(item.overallHealing)"
            density="compact"
            :items-per-page="-1"
            hide-default-footer
            class="ma-2 bg-surface-variant rounded-sm elevation-0"
          >
            <template v-slot:[`item.skillName`]="{ item: skillItem }">
              <div class="d-flex align-center px-2 py-1">
                <img
                  v-if="getSkillImageSrc(skillItem.id)"
                  width="24"
                  height="24"
                  :src="getSkillImageSrc(skillItem.id)"
                  class="mr-2 rounded-sm"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span class="font-weight-bold text-body-2">{{ getSkillName(skillItem.id) }}</span>
              </div>
            </template>

            <template v-slot:[`item.uses`]="{ item: skillItem }">
              <div class="text-right font-weight-medium">{{ formatNumber(skillItem.uses) }}</div>
            </template>

            <template v-slot:[`item.totalDamage`]="{ item: skillItem }">
              <div class="text-right font-weight-bold">{{ formatNumber(skillItem.totalDamage) }}</div>
            </template>

            <template v-slot:[`item.dps`]="{ item: skillItem }">
              <div class="text-right font-weight-bold">
                {{ currentEncounterDuration > 0 ? formatNumber(skillItem.totalDamage / currentEncounterDuration) : '0' }}
              </div>
            </template>

            <template v-slot:[`item.overshieldProvided`]="{ item: skillItem }">
              <div class="text-right font-weight-bold text-light-green-accent-3">
                {{ formatNumber(skillItem.overshieldProvided || 0) }}
              </div>
            </template>

            <template v-slot:[`item.critRate`]="{ item: skillItem }">
              <div class="text-center font-weight-bold">
                {{ skillItem.count > 0 ? ((skillItem.critCount / skillItem.count) * 100).toFixed(1) : '0.0' }}%
              </div>
            </template>
          </v-data-table>
        </td>
      </tr>
    </template>
  </v-data-table>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, watch } from "vue";
import { fightSummary, activeSessionId, selectedTargetId, hiddenPlayers, globalHideMode, setAllHiddenPlayers, showClassColorsForVisiblePlayers } from "@/store";
import { DamageBreakdown, SkillStats } from "@/protocols";
import { isGroupTargetId, getGroupMemberTargetIds, getEncounterDurationForTargets } from "@/utils/targetGrouping";
import { toggleHiddenPlayer } from "@/store";
import { getMabiNameColor, getClassColor } from "@/util";

export default defineComponent({
  name: "ApplyHealingBySkill",
  setup() {
    const skillNameMap = inject("skillNameMap") as any;
    const expanded = ref<string[]>([]);

    watch(activeSessionId, () => { expanded.value = []; });

    const mainTableHeaders = computed(() => [
      { title: "Hide", key: "isHidden", sortable: false, width: "1%" },
      { title: "Character", key: "name", sortable: true, width: "20%" },
      { title: "Healing Contribution", key: "overallHealing.totalDamage", sortable: true, align: "end" as const, width: "35%" },
      { title: "HPS", key: "overallHealing.dps", sortable: true, align: "end" as const, width: "20%" },
      { title: "Overshields Provided", key: "overallHealing.overshieldProvided", sortable: true, align: "end" as const, width: "20%" },
      { title: "Crit %", key: "overallHealing.critRate", sortable: true, align: "center" as const, width: "15%" },
      { title: "", key: "data-table-expand", width: "4%" },
    ]);

    const computedSkillTableHeaders = computed(() => [
      { title: "Skill", key: "skillName", sortable: true, width: "200px" },
      { title: "Uses", key: "uses", sortable: true, align: "end" as const },
      { title: "Total Healed", key: "totalDamage", sortable: true, align: "end" as const },
      { title: "HPS", key: "dps", sortable: true, align: "end" as const },
      { title: "Overshield", key: "overshieldProvided", sortable: true, align: "end" as const },
      { title: "Crit %", key: "critRate", sortable: true, align: "center" as const }
    ]);

    const formatNumber = (num: number | undefined | null): string => {
      if (num === undefined || num === null) return "0";
      return Math.round(num).toLocaleString("en-US");
    };

    const formatAbbreviated = (num: number | undefined | null): string => {
      if (num === undefined || num === null) return "0";
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
      if (num >= 1_000) return (num / 1_000).toFixed(0) + "k";
      return Math.round(num).toLocaleString("en-US");
    };
    
    const currentEncounterDuration = computed(() => {
      return fightSummary?.encounterDuration || 0;
    });

    const playerDisplayData = computed(() => {
      if (!fightSummary?.players) return [];
      return Object.values(fightSummary.players)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          // Optimization Gate: If it's a historical save missing healing metadata, fallback safely to 0 matrices
          overallHealing: p.overallHealing || { totalDamage: 0, dps: 0, overshieldProvided: 0, critRate: 0, skills: {} },
          healingByTarget: p.healingByTarget || {}
        }))
        .filter((p: any) => p.overallHealing.totalDamage > 0 || p.overallHealing.overshieldProvided > 0)
        .sort((a: any, b: any) => b.overallHealing.totalDamage - a.overallHealing.totalDamage);
    });
       
    // Resolves row tracking colors based on custom user choices or active arcana
    const getPlayerColor = (item: any) => {
      const isHidden = globalHideMode.value || hiddenPlayers.has(item.id);
      const shouldUseClassColor = isHidden || showClassColorsForVisiblePlayers.value;
      return shouldUseClassColor 
        ? getClassColor(item.talentName, item.talentColor) 
        : getMabiNameColor(item.name);
    };

    const totalHealingForView = computed(() => {
      return playerDisplayData.value.reduce((sum: number, p: any) => sum + (p.overallHealing?.totalDamage || 0), 0);
    });

    const getSkillName = (skillId: number): string => {
      if (skillId === 9999) return "Pets";
      return skillNameMap.value?.[skillId]?.name || `Unknown Skill: ${skillId}`;
    };

    const getSkillImageSrc = (skillId: number): string => {
      return skillNameMap.value?.[skillId]?.iconUrl || "";
    };

    const getSkillBreakdown = (overallHealing: any): SkillStats[] => {
      if (!overallHealing?.skills) return [];
      return Object.values(overallHealing.skills) as SkillStats[];
    };
      const isolateSinglePlayer = (targetPlayerId: string) => {
    // Clear any active global hiding configurations
    globalHideMode.value = false;
    
    // Set all players to hidden first
    const allIds = playerDisplayData.value.map((p: any) => p.id);
    setAllHiddenPlayers(allIds, true);
    
    // Remove our specific chosen character from the hidden list to keep them visible
    hiddenPlayers.delete(targetPlayerId);
  };


        // Goal 2: Stacked Progress Bar Color Engine (Deep Burgundy + Neon Green)
    const getRowProps = ({ item }: { item: any }) => {
      const players = playerDisplayData.value;
      if (!players || players.length === 0) return { class: "character-row" };
      
      // Calculate scaling relative to the absolute top support throughput player
      const topHealer = players[0];
      const maxPool = (topHealer.overallHealing?.totalDamage || 0) + (topHealer.overallHealing?.overshieldProvided || 0);
      if (maxPool <= 0) return { class: "character-row" };

      const activeHeals = item.overallHealing?.totalDamage || 0;
      const shields = item.overallHealing?.overshieldProvided || 0;

      const healPercentage = (activeHeals / maxPool) * 100;
      const shieldPercentage = (shields / maxPool) * 100;

      return {
        class: "character-row",
        style: {
          background: `linear-gradient(to right, 
            rgba(89, 38, 38, 0.85) 0%, 
            rgba(89, 38, 38, 0.85) ${healPercentage}%, 
            rgba(57, 255, 20, 0.85) ${healPercentage}%, 
            rgba(57, 255, 20, 0.85) ${healPercentage + shieldPercentage}%, 
            transparent ${healPercentage + shieldPercentage}% 100%)`,
          backgroundClip: 'padding-box'
        }
      };
    };
    
    return {
      isolateSinglePlayer,
      expanded,
      mainTableHeaders,
      computedSkillTableHeaders,
      playerDisplayData,
      totalHealingForView,
      currentEncounterDuration,
      formatNumber,
      formatAbbreviated,
      getSkillName,
      getSkillImageSrc,
      getSkillBreakdown,
      getRowProps,
      getPlayerColor,
      toggleHiddenPlayer,
      hiddenPlayers,
    };
  }
});
</script>

<style scoped>
.pb-16 { 
  padding-bottom: 80px !important; 
}

:deep(.v-data-table) { 
  background: transparent !important; 
}

.dps-table :deep(table) { 
  border-spacing: 0 6px !important; 
  border-collapse: separate !important; 
}

.dps-table :deep(tbody tr.character-row) { 
  position: relative; 
  transition: all 0.2s ease; 
}

.dps-table :deep(td) { 
  border-bottom: none !important; 
  padding-top: 4px !important; 
  padding-bottom: 4px !important; 
  background-color: rgba(255, 255, 255, 0.03); 
}

.dps-table :deep(tbody tr) { 
  border-radius: 6px !important; 
}

.dps-table :deep(tbody tr td:first-child) { 
  border-top-left-radius: 6px !important; 
  border-bottom-left-radius: 6px !important; 
}

.dps-table :deep(tbody tr td:last-child) { 
  border-top-right-radius: 6px !important; 
  border-bottom-right-radius: 6px !important; 
}
</style>

