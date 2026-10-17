<template>
  <div class="scatter-container mt-6">
    <div class="scatter-header px-4 py-2 d-flex align-items-center justify-content-between">
      <span class="panel-title font-weight-bold">🎯 Chronological Action Timeline — {{ playerStats.name }}</span>
      <span class="ceiling-label text-slate text-caption">1s Max Point Grouping Active</span>
    </div>
    <div class="scatter-chart-wrapper position-relative" style="height: 320px;">
      <!-- Custom Tooltip Intercept Overlay -->
      <div 
        v-if="tooltip.visible" 
        class="custom-vue-tooltip position-absolute"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', borderColor: playerColor }"
      >
        <div class="tooltip-time mb-1 font-weight-bold">⏱️ Fight Timestamp: {{ formatTimeLabel(tooltip.time) }}</div>
        <div class="tooltip-damage font-weight-bold mb-2">💥 Combined Hit: {{ tooltip.totalDmg.toLocaleString() }}</div>
        <div class="tooltip-divider mb-2"></div>
        <div v-for="sk in tooltip.skills" :key="sk.skillId" class="tooltip-skill-row d-flex align-items-center justify-content-between mb-1">
          <span class="sk-name text-truncate pr-4">{{ getSkillName(sk.skillId) }}</span>
          <span class="sk-meta text-right font-weight-medium">
            {{ sk.damage.toLocaleString() }} <span class="text-slate">({{ sk.hitCount }}x)</span>
            <span v-if="sk.critCount > 0" class="text-red ml-1">🔥 Crit</span>
          </span>
        </div>
      </div>

      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, computed, inject, watch, onBeforeUnmount } from "vue";
import { Chart as ChartJS, ScatterController, PointElement, LinearScale, Tooltip } from "chart.js";

ChartJS.register(ScatterController, PointElement, LinearScale, Tooltip);

export default defineComponent({
  name: "DamageScatterChart",
  props: {
    playerStats: { type: Object, required: true },
    playerColor: { type: String, default: "#38bdf8" }
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const skillNameMap = inject("skillNameMap") as any;
    let chartInstance: ChartJS | null = null;

    const tooltip = ref({ visible: false, x: 0, y: 0, time: 0, totalDmg: 0, skills: [] as any[] });

    const formatTimeLabel = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getSkillName = (id: number) => skillNameMap.value?.[id]?.name || `Skill ${id}`;

    const chartDataPoints = computed(() => {
      if (!props.playerStats?.skillUses) return [];
      return props.playerStats.skillUses.map((evt: any) => ({
        x: evt.timestamp,
        y: evt.totalDmg,
        rawSkills: evt.skills
      }));
    });

    const initChart = () => {
      if (!canvasRef.value) return;
      
      chartInstance = new ChartJS(canvasRef.value, {
        type: "scatter",
        data: {
          datasets: [{
            label: `${props.playerStats.name} Cast Timeline`,
            data: chartDataPoints.value,
            backgroundColor: props.playerColor,
            pointRadius: 6,
            pointHoverRadius: 9,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              enabled: false, // Turn off native toolkit layer to let our Custom Vue frame take over
              external: (context) => {
                const model = context.tooltip;
                if (model.opacity === 0) {
                  tooltip.value.visible = false;
                  return;
                }
                const pt = model.dataPoints[0].raw as any;
                const rect = context.chart.canvas.getBoundingClientRect();
                
                tooltip.value.x = model.caretX + 15;
                tooltip.value.y = model.caretY - 30;
                tooltip.value.time = pt.x;
                tooltip.value.totalDmg = pt.y;
                tooltip.value.skills = pt.rawSkills || [];
                tooltip.value.visible = true;
              }
            }
          },
          scales: {
            x: {
              type: "linear",
              title: { display: true, text: "Timeline (M:S)", color: "#ffffff" },
              ticks: { color: "#cbd5e1", callback: (val) => formatTimeLabel(Number(val)) },
              grid: { color: "rgba(255,255,255,0.05)" }
            },
            y: {
              type: "linear",
              title: { display: true, text: "Hit Value", color: "#ffffff" },
              ticks: { color: "#cbd5e1" },
              grid: { color: "rgba(255,255,255,0.05)" }
            }
          }
        }
      });
    };

    watch(chartDataPoints, (newPoints) => {
      if (chartInstance) {
        chartInstance.data.datasets[0].data = newPoints;
        chartInstance.update("none");
      }
    }, { deep: true });

    onMounted(initChart);
    onBeforeUnmount(() => chartInstance?.destroy());

    return { canvasRef, tooltip, formatTimeLabel, getSkillName };
  }
});
</script>

<style scoped>
.scatter-container {
  background: rgba(23, 27, 36, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}
.scatter-header {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.custom-vue-tooltip {
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 10px;
  box-shadow: 0 12px 24px rgba(0,0,0,0.5);
  z-index: 999;
  pointer-events: none;
  font-size: 0.85rem;
  color: #cbd5e1;
  min-width: 250px;
}
.tooltip-divider { height: 1px; background: rgba(255,255,255,0.1); }
.text-red { color: #f87171; }
</style>
