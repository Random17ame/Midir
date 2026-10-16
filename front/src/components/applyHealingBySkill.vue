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
    <!-- Character Row Names -->
    <template v-slot:[`item.name`]="{ item }">
      <div class="d-flex align-center font-weight-bold py-1">
        <v-btn
          icon
          variant="text"
          density="compact"
          size="small"
          class="mr-1"
          @click.stop="toggleHiddenPlayer(item.id)"
        >
          <v-icon :color="hiddenPlayers.has(item.id) ? 'grey' : 'white'">
            {{ hiddenPlayers.has(item.id) ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}
          </v-icon>
        </v-btn>
        <span>{{ hiddenPlayers.has(item.id) ? 'Hidden' : item.name }}</span>
      </div>
    </template>

    <!-- Effective Healing Output Cell -->
    <template v-slot:[`item.overallHealing.totalDamage`]="{ item }">
      <div class="text-right font-weight-bold">
        {{ formatAbbreviated(item.overallHealing?.totalDamage) }}
        <span class="text-grey font-weight-medium text-caption ml-1">
          ({{ totalHealingForView > 0 ? ((item.overallHealing?.totalDamage / totalHealingForView) * 100).toFixed(1) : '0.0' }}%)
        </span>
      </div>
    </template>

    <!-- Healing Per Second (HPS) Cell -->
    <template v-slot:[`item.overallHealing.dps`]="{ item }">
      <div class="text-right font-weight-bold">
        {{ formatNumber(item.overallHealing?.dps) }} HPS
      </div>
    </template>

    <!-- Overshield Volume Output Cell (Goal 2 Counter) -->
    <template v-slot:[`item.overallHealing.overshieldProvided`]="{ item }">
      <div class="text-right font-weight-bold text-light-green-accent-3">
        {{ formatAbbreviated(item.overallHealing?.overshieldProvided || 0) }}
      </div>
    </template>

    <!-- Critical Heal Percentage Rate Cell -->
    <template v-slot:[`item.overallHealing.critRate`]="{ item }">
      <div class="text-center font-weight-bold text-amber">
        {{ (item.overallHealing?.critRate || 0).toFixed(1) }}%
      </div>
    </template>

    <!-- Skill Breakdown Expanded Sub-Table Grid -->
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
            :row-props="(skillItem) => getSkillRowProps(skillItem, item.overallHealing?.skills?.[0]?.totalDamage, item.name, item)"
          >
            <!-- Nested Skill Identifier Rows -->
            <template v-slot:[`item.skillName`]="{ item: skillItem }">
              <div class="d-flex align-center px-2 py-1 skill-bar-cell">
                <img
                  v-if="getSkillImageSrc(skillItem.id)"
                  width="24"
                  height="24"
                  :src="getSkillImageSrc(skillItem.id)"
                  class="mr-2 rounded-sm"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
                <span class="font-weight-bold text-body-2">{{ getSkillName(skillItem.id) }}</span>
              </div>
            </template>

            <template v-slot:[`item.uses`]="{ item: skillItem }">
              <div class="text-right font-weight-medium">{{ formatNumber(skillItem.uses) }}</div>
            </template>

            <template v-slot:[`item.totalDamage`]="{ item: skillItem }">
              <div class="text-right font-weight-bold">
                {{ formatNumber(skillItem.totalDamage) }}
              </div>
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
import { fightSummary, activeSessionId, selectedTargetId, hiddenPlayers } from "@/store";
import { DamageBreakdown, SkillStats } from "@/protocols";
import { isGroupTargetId, getGroupMemberTargetIds, getEncounterDurationForTargets } from "@/utils/targetGrouping";
import { getMabiNameColor, getClassColor } from "@/util";
import { toggleHiddenPlayer, globalHideMode, showClassColorsForVisiblePlayers } from "@/store";

export default defineComponent({
  name: "ApplyHealingBySkill",
  props: {
    attackerNameMap: {
      type: Object as () => { [id: string]: string },
      required: false,
    },
  },
  setup(props) {
    const skillNameMap = inject("skillNameMap") as any;
    const condNameMap = inject("condNameMap") as any;
    const expanded = ref<string[]>([]);
    const viewMode = ref<"table">("table");

    watch(activeSessionId, () => {
      expanded.value = [];
    });

    const getPlayerColor = (item: any) => {
      const isHidden = globalHideMode.value || hiddenPlayers.has(item.id);
      const shouldUseClassColor = isHidden || showClassColorsForVisiblePlayers.value;
      return shouldUseClassColor
        ? getClassColor(item.talentName, item.talentColor)
        : getMabiNameColor(item.name);
    };
    const mainTableHeaders = computed(() => [
      { title: "Hide", key: "isHidden", sortable: false, width: "1%" },
      { title: "Character", key: "name", sortable: true, width: "20%" },
      { title: "Healing Contribution", key: "overallHealing.totalDamage", sortable: true, align: "end", width: "35%" },
      { title: "HPS", key: "overallHealing.dps", sortable: true, align: "end", width: "20%" },
      { title: "Overshields Provided", key: "overallHealing.overshieldProvided", sortable: true, align: "end", width: "20%" },
      { title: "Crit %", key: "overallHealing.critRate", sortable: true, align: "center", width: "15%" },
      { title: "", key: "data-table-expand", width: "4%" },
    ] as const);

    const computedSkillTableHeaders = computed(() => [
      { title: "Skill", key: "skillName", sortable: true, width: "200px" },
      { title: "Uses", key: "uses", sortable: true, align: "end" },
      { title: "Total Healed", key: "totalDamage", sortable: true, align: "end" },
      { title: "HPS", key: "dps", sortable: true, align: "end" },
      { title: "Overshield", key: "overshieldProvided", sortable: true, align: "end" },
      { title: "Crit %", key: "critRate", sortable: true, align: "center" }
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
      // Logic for calculating encounter duration based on targets and fight summary
    });

    const playerDisplayData = computed(() => {
      // Maps, groups, filters, and sorts player display data and healing breakdowns
    });

    const totalHealingForView = computed(() => {
      return playerDisplayData.value.reduce((sum, p) => sum + (p.overallHealing?.totalDamage || 0), 0);
    });

    const getSkillName = (skillId: number): string => {
      if (skillId === 9999) return "Pets";
      return skillNameMap.value[skillId]?.name || `Unknown Skill: ${skillId}`;
    };

    const getSkillImageSrc = (skillId: number): string => {
      return skillNameMap.value[skillId]?.iconUrl || "";
    };

    const getSkillBreakdown = (overallHealing: any): SkillStats[] => {
      if (!overallHealing?.skills) return [];
      return Object.values(overallHealing.skills) as SkillStats[];
    };

    const getRowProps = ({ item }: { item: any }) => {
      // Generates row background gradients and border styles for visual charts
    };

    const getSkillRowProps = (skillItem: any, totalDamage: number, playerName: string, parentItem: any) => {
      return { class: "skill-row" };
    };

    return {
      expanded,
      viewMode,
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
      getSkillRowProps,
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dps-table :deep(tbody tr.character-row:hover) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  z-index: 1;
}

.dps-table :deep(tbody tr:not(.character-row):hover) {
  filter: none !important;
  transform: none !important;
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

.skill-bar-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
</style>

