<template>
  <v-select v-model="rule.mode" :items="modes" label="Run counting period" variant="outlined" density="compact" hide-details />
  <v-row v-if="rule.mode === 'weekly'" dense class="mt-2">
    <v-col cols="12" sm="6">
      <v-select v-model="rule.weekDay" :items="weekdays" label="Weekly reset day" variant="outlined" density="compact" hide-details />
    </v-col>
    <v-col cols="12" sm="6">
      <v-text-field v-model="rule.weekTime" type="time" label="Reset time (local)" variant="outlined" density="compact" hide-details />
    </v-col>
  </v-row>
  <v-text-field v-if="rule.mode === 'rolling'" :model-value="rule.hours" @update:model-value="setHours" type="number" min="1" max="168" step="1" label="Previous hours (1–168)" variant="outlined" density="compact" hide-details class="mt-2" />
  <div v-if="rule.mode === 'scheduled' && !allowScheduled" class="text-caption text-medium-emphasis mt-1">Outside a group window, counts reset daily. Each group has its own counting period.</div>
</template>

<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import { namingWeekdays, type CountRule } from '@/utils/sessionNameFormat';
export default defineComponent({
  name: 'RunCountSettings',
  props: {
    rule: { type: Object as PropType<CountRule>, required: true },
    allowScheduled: { type: Boolean, default: false },
  },
  setup(props) {
    const modes = computed(() => [
      {title:'Daily (midnight)',value:'daily'},
      {title:'Weekly reset',value:'weekly'},
      {title:'Rolling time window',value:'rolling'},
      {title:props.allowScheduled ? 'Current scheduled window' : 'Scheduled groups (daily outside groups)',value:'scheduled'},
    ]);
    const weekdays = namingWeekdays.map((title,value) => ({title,value}));
    const setHours = (raw: string) => {
      const n = Number(raw);
      if (raw.trim() && Number.isFinite(n)) props.rule.hours = Math.max(1, Math.min(168, Math.round(n)));
    };
    return {modes, weekdays, setHours};
  },
});
</script>
