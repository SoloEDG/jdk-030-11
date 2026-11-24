<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { contactPoints, heightAt } from "../lib/sim";
import { rot } from "../lib/geom";
import type { DesignReport } from "../lib/design";
import type { LiftOrder } from "@/shared/types";

const props = defineProps<{ order: LiftOrder; report: DesignReport }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const angle = ref(0);

const rollerR = computed(() => props.report.design.rollerDia / 2);
const height = computed(() => heightAt(props.report.curve, angle.value));
const contacts = computed(() =>
  contactPoints(props.report.curve, props.report.profile.points, angle.value),
);
const nearest = computed(() => {
  let bestFloor: (typeof props.order.floors)[number] | null = null;
  let bestDist = Infinity;
  for (const floor of props.order.floors) {
    const d = Math.abs(height.value - floor.height);
    if (d < bestDist) {
      bestDist = d;
      bestFloor = floor;
    }
  }
  return { floor: bestFloor, diff: bestFloor ? height.value - bestFloor.height : 0 };
});
const berthNow = computed(
  () => nearest.value.floor != null && Math.abs(nearest.value.diff) <= props.order.tolerance,
);

function step(delta: number): void {
  angle.value = (((angle.value + delta) % 360) + 360) % 360;
}

function toWorst(): void {
  angle.value = props.report.analysis.worstAngle;
}

const W = 640;
const H = 380;
const DIAL_CX = 180;
const DIAL_CY = 190;

function render(): void {
  const el = canvas.value;
  if (!el) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  el.width = Math.floor(W * dpr);
  el.height = Math.floor(H * dpr);
  el.style.width = `${W}px`;
  el.style.height = `${H}px`;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0d0a08";
  ctx.fillRect(0, 0, W, H);

  const { order, report } = props;
  const scale = 150 / order.sleeveRadius;
  const theta = angle.value;
  const turn = (p: { x: number; y: number }) => {
    const q = rot(p, 90 - theta);
    return { x: DIAL_CX + q.x * scale, y: DIAL_CY - q.y * scale };
  };

  // 轴套与轮毂
  ctx.strokeStyle = "rgba(232,215,184,0.35)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, order.sleeveRadius * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(232,215,184,0.2)";
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, order.boreRadius * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 停靠转角刻度与门开窗口（随盘转动）
  for (const stop of order.stops) {
    const floor = order.floors.find((f) => f.id === stop.floorId);
    const r0 = (report.profile.maxR + 6) * scale;
    // 窗口弧
    ctx.strokeStyle = "rgba(201,163,106,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const start = ((90 - theta + stop.angle - order.windowDeg) * Math.PI) / 180;
    const end = ((90 - theta + stop.angle + order.windowDeg) * Math.PI) / 180;
    ctx.arc(DIAL_CX, DIAL_CY, r0, -end, -start);
    ctx.stroke();
    ctx.lineWidth = 1;
    // 刻度
    const tick = turn({
      x: Math.cos((stop.angle * Math.PI) / 180) * (report.profile.maxR + 11),
      y: Math.sin((stop.angle * Math.PI) / 180) * (report.profile.maxR + 11),
    });
    ctx.fillStyle = "#c9a36a";
    ctx.beginPath();
    ctx.arc(tick.x, tick.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "10px ui-serif, Palatino, serif";
    ctx.textAlign = "center";
    ctx.fillText(floor?.label ?? "", tick.x, tick.y - 7);
  }

  // 轮廓
  ctx.beginPath();
  const pts = report.profile.points;
  for (let i = 0; i < pts.length; i += 1) {
    const q = turn(pts[i]);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(90,70,48,0.55)";
  ctx.fill();
  ctx.strokeStyle = report.qualified ? "#7d9b6a" : "#b56a32";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 厢底线（当前厢高）
  const h = height.value;
  const floorY = DIAL_CY - h * scale;
  ctx.strokeStyle = "rgba(126,200,200,0.65)";
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(DIAL_CX - 150, floorY);
  ctx.lineTo(DIAL_CX + 150, floorY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 滚轮（从动件，固定在正上方导轨）
  const c = h + rollerR.value;
  const rollerX = DIAL_CX;
  const rollerY = DIAL_CY - c * scale;
  ctx.beginPath();
  ctx.arc(rollerX, rollerY, rollerR.value * scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(138,147,160,0.35)";
  ctx.fill();
  ctx.strokeStyle = "#8a93a0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rollerX, rollerY - 30);
  ctx.lineTo(rollerX, rollerY - rollerR.value * scale);
  ctx.strokeStyle = "rgba(138,147,160,0.6)";
  ctx.stroke();

  // 实际支撑点
  for (const p of contacts.value) {
    const q = turn(p);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e8b898";
    ctx.fill();
    ctx.strokeStyle = "#1c1610";
    ctx.stroke();
  }

  // 右侧：门槛标尺 + 升降曲线
  const rulerX = 400;
  const yOf = (heightMm: number) => 350 - (heightMm / order.sleeveRadius) * 320;
  ctx.strokeStyle = "rgba(232,215,184,0.3)";
  ctx.beginPath();
  ctx.moveTo(rulerX, 20);
  ctx.lineTo(rulerX, 350);
  ctx.stroke();
  ctx.font = "10px ui-serif, Palatino, serif";
  ctx.textAlign = "right";
  for (const floor of order.floors) {
    const fy = yOf(floor.height);
    // 平层余量带
    ctx.fillStyle = "rgba(125,155,106,0.14)";
    ctx.fillRect(rulerX, yOf(floor.height + order.tolerance), 210, yOf(floor.height - order.tolerance) - yOf(floor.height + order.tolerance));
    ctx.strokeStyle = "#7d9b6a";
    ctx.beginPath();
    ctx.moveTo(rulerX - 6, fy);
    ctx.lineTo(rulerX + 210, fy);
    ctx.stroke();
    ctx.fillStyle = "rgba(232,215,184,0.8)";
    ctx.fillText(`${floor.label} ${floor.height}mm`, rulerX - 8, fy + 3);
  }
  // 升降曲线 h(theta)
  const curve = report.curve;
  ctx.beginPath();
  for (let k = 0; k < curve.count; k += 1) {
    const x = rulerX + 10 + (k / curve.count) * 200;
    const y = yOf(curve.h[k]);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#7ec8c8";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
  // 停靠窗口竖带
  for (const stop of order.stops) {
    const x0 = rulerX + 10 + (stop.angle - order.windowDeg) / 360 * 200;
    const x1 = rulerX + 10 + (stop.angle + order.windowDeg) / 360 * 200;
    ctx.fillStyle = "rgba(201,163,106,0.12)";
    ctx.fillRect(x0, 20, x1 - x0, 330);
  }
  // 最差点
  const worstX = rulerX + 10 + (report.analysis.worstAngle / 360) * 200;
  const worstY = yOf(heightAt(curve, report.analysis.worstAngle));
  ctx.strokeStyle = "#b56a32";
  ctx.beginPath();
  ctx.moveTo(worstX, 20);
  ctx.lineTo(worstX, 350);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(worstX, worstY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#b56a32";
  ctx.fill();
  // 当前转角游标与厢高游标
  const curX = rulerX + 10 + (theta / 360) * 200;
  ctx.strokeStyle = "#e8d7b8";
  ctx.beginPath();
  ctx.moveTo(curX, 20);
  ctx.lineTo(curX, 350);
  ctx.stroke();
  const curY = yOf(h);
  ctx.strokeStyle = "#7ec8c8";
  ctx.beginPath();
  ctx.moveTo(rulerX - 6, curY);
  ctx.lineTo(rulerX + 210, curY);
  ctx.stroke();

  // 读数
  ctx.fillStyle = "#e8d7b8";
  ctx.font = "12px ui-serif, Palatino, serif";
  ctx.textAlign = "left";
  ctx.fillText(`转角 ${theta.toFixed(0)}°`, 12, 20);
  ctx.fillText(`厢高 ${h.toFixed(2)}mm`, 12, 36);
  const near = nearest.value;
  if (near.floor) {
    const sign = near.diff >= 0 ? "+" : "";
    ctx.fillStyle = berthNow.value ? "#7d9b6a" : "#e8b898";
    ctx.fillText(`与${near.floor.label}门槛差 ${sign}${near.diff.toFixed(2)}mm`, 12, 52);
  }
  if (contacts.value.length > 1) {
    ctx.fillStyle = "#e8b898";
    ctx.fillText("双沿搭桥：滚轮同时搭到两处盘沿", 12, 68);
  }
}

onMounted(render);
watch([angle, () => props.report], render, { deep: false });
</script>

<template>
  <div class="camview">
    <canvas ref="canvas" role="img" aria-label="凸轮盘仓面检视" />
    <div class="handwheel">
      <button type="button" @click="step(-order.crankStepDeg)">−{{ order.crankStepDeg }}°</button>
      <input
        type="range"
        min="0"
        max="359"
        step="1"
        :value="Math.round(angle)"
        aria-label="手轮转角"
        @input="angle = Number(($event.target as HTMLInputElement).value)"
      />
      <button type="button" @click="step(order.crankStepDeg)">+{{ order.crankStepDeg }}°</button>
      <button type="button" class="worst" @click="toWorst">转到误差最大处</button>
    </div>
  </div>
</template>
