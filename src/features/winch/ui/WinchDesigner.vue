<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import CamView from "./CamView.vue";
import { evaluateDesign, searchBestDesign } from "../lib/design";
import { pieceEnds } from "../lib/geom";
import type { CamDesign, CamPieceSpec, RuntimeLevel } from "@/shared/types";

const props = defineProps<{ level: RuntimeLevel }>();
const emit = defineEmits<{ close: []; install: [design: CamDesign] }>();

const order = props.level.lift!.order;

const draft = reactive<CamDesign>({
  order: props.level.lift?.design ? [...props.level.lift.design.order] : [],
  flips: props.level.lift?.design ? { ...props.level.lift.design.flips } : {},
  rollerDia: props.level.lift?.design?.rollerDia ?? order.rollerOptions[0],
  fillet: props.level.lift?.design?.fillet ?? order.filletOptions[0],
});

const searchNote = ref("");
const searching = ref(false);

const report = computed(() => evaluateDesign(order, draft));

const remaining = computed(() => order.pieces.filter((p) => !draft.order.includes(p.id)));

function pieceLabel(p: CamPieceSpec): string {
  return p.kind === "arc" ? `圆弧 R${p.r0}·${p.span}°` : `直边 ${p.r0}→${p.r1}·${p.span}°`;
}

function add(id: string): void {
  if (draft.order.includes(id)) return;
  draft.order.push(id);
  searchNote.value = "";
}

function removeAt(index: number): void {
  draft.order.splice(index, 1);
  searchNote.value = "";
}

function clearAll(): void {
  draft.order = [];
  draft.flips = {};
  searchNote.value = "";
}

function flipOf(id: string): boolean {
  return Boolean(draft.flips[id]);
}

function toggleFlip(id: string): void {
  draft.flips[id] = !draft.flips[id];
}

function endsOf(id: string): { start: number; end: number } {
  const spec = order.pieces.find((p) => p.id === id)!;
  return pieceEnds(spec, flipOf(id));
}

function jointOk(index: number): boolean {
  if (index + 1 >= draft.order.length) return true;
  return Math.abs(endsOf(draft.order[index]).end - endsOf(draft.order[index + 1]).start) < 1e-6;
}

function runSearch(): void {
  searching.value = true;
  searchNote.value = "";
  // 让出一帧再跑，避免按钮状态不更新
  setTimeout(() => {
    const outcome = searchBestDesign(order);
    searching.value = false;
    if (outcome.best) {
      draft.order = [...outcome.best.design.order];
      draft.flips = { ...outcome.best.design.flips };
      draft.rollerDia = outcome.best.design.rollerDia;
      draft.fillet = outcome.best.design.fillet;
      searchNote.value =
        `试算 ${outcome.tested} 组，合格 ${outcome.feasible} 组。` +
        `最优最坏偏差 ${outcome.best.analysis.worstDev.toFixed(2)}mm，已套用。`;
    } else {
      searchNote.value =
        `试算 ${outcome.tested} 组无一合格` +
        (Number.isFinite(outcome.nearestDev)
          ? `，最接近的偏差 ${outcome.nearestDev.toFixed(2)}mm 仍超余量`
          : "") +
        "。没有能装进轴套半径的合格轮廓。";
    }
  }, 30);
}

function stopLabel(stopId: string): string {
  const stop = order.stops.find((s) => s.id === stopId);
  const floor = order.floors.find((f) => f.id === stop?.floorId);
  return `${stop?.angle ?? "?"}°→${floor?.label ?? "?"}`;
}

function install(): void {
  if (!report.value.qualified) return;
  emit("install", {
    order: [...draft.order],
    flips: { ...draft.flips },
    rollerDia: draft.rollerDia,
    fillet: draft.fillet,
  });
}
</script>

<template>
  <div class="designer-backdrop" @click.self="emit('close')">
    <div class="designer" role="dialog" aria-label="凸轮工单">
      <header class="designer-head">
        <h2>凸轮工单 · 货梯试车</h2>
        <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <div class="designer-body">
        <div class="designer-left">
          <CamView :order="order" :report="report" />
          <p class="hint">
            仓面检视：滚轮托着厢底，支撑点以橙点标出；右侧为各层门槛与升降曲线。
            间隙区段可自由过渡，停靠窗口内必须在平层余量内。
          </p>
        </div>
        <div class="designer-right">
          <section>
            <h3>工单指标</h3>
            <ul class="spec">
              <li v-for="stop in order.stops" :key="stop.id">
                停靠 {{ stop.angle }}° →
                {{ order.floors.find((f) => f.id === stop.floorId)?.label }}
                （窗口 ±{{ order.windowDeg }}°）
              </li>
              <li>平层余量 ±{{ order.tolerance }}mm · 轴套半径 ≤{{ order.sleeveRadius }}mm</li>
              <li>轮毂 ≥{{ order.boreRadius }}mm · 车削内圆角 ≥{{ order.filletMin }}mm</li>
            </ul>
          </section>
          <section>
            <h3>片库（点选拼入）</h3>
            <ul class="inventory">
              <li v-for="piece in remaining" :key="piece.id">
                <button type="button" @click="add(piece.id)">{{ pieceLabel(piece) }}</button>
              </li>
              <li v-if="remaining.length === 0" class="dim">片库已用完</li>
            </ul>
          </section>
          <section>
            <h3>拼合顺序（自 0° 起）</h3>
            <ol class="sequence">
              <template v-for="(id, i) in draft.order" :key="id">
                <li>
                  <span class="seq-label">{{ pieceLabel(order.pieces.find((p) => p.id === id)!) }}</span>
                  <button
                    v-if="order.pieces.find((p) => p.id === id)?.kind === 'ramp'"
                    type="button"
                    class="mini"
                    @click="toggleFlip(id)"
                  >
                    翻面
                  </button>
                  <button type="button" class="mini" @click="removeAt(i)">取下</button>
                </li>
                <li v-if="i + 1 < draft.order.length" class="joint" :class="{ bad: !jointOk(i) }">
                  {{ jointOk(i) ? "└ 半径相接" : "└ 断链：端半径不接" }}
                </li>
              </template>
              <li v-if="draft.order.length === 0" class="dim">还没有拼入任何片段</li>
            </ol>
          </section>
          <section class="params">
            <label>
              滚轮直径
              <select v-model.number="draft.rollerDia">
                <option v-for="d in order.rollerOptions" :key="d" :value="d">{{ d }}mm</option>
              </select>
            </label>
            <label>
              内圆角
              <select v-model.number="draft.fillet">
                <option v-for="f in order.filletOptions" :key="f" :value="f">{{ f }}mm</option>
              </select>
            </label>
          </section>
          <section>
            <h3>校核</h3>
            <ul class="checks">
              <li :class="{ bad: report.problems.length > 0, good: report.qualified }">
                {{ report.qualified ? "合格：可实装试车" : "未合格：不能过门" }}
              </li>
              <li v-for="(problem, i) in report.problems" :key="i" class="bad">{{ problem }}</li>
              <li v-for="(warning, i) in report.warnings" :key="`w${i}`" class="warn">{{ warning }}</li>
              <li v-if="report.profile.closed">
                最小内圆角
                {{ report.profile.hasConcaveJoint ? `${report.profile.minInnerFillet}mm` : "无内角" }}
                · 最大半径 {{ report.profile.maxR.toFixed(1) }}mm
              </li>
            </ul>
            <ul v-if="report.profile.closed" class="stops">
              <li
                v-for="stop in report.analysis.stops"
                :key="stop.stopId"
                :class="{ bad: !stop.ok, good: stop.ok }"
              >
                {{ stopLabel(stop.stopId) }}：偏差 {{ stop.dev.toFixed(2) }}mm
                {{ stop.ok ? "✓" : "✗" }}
              </li>
              <li>最坏离层偏差 {{ report.analysis.worstDev.toFixed(2) }}mm</li>
            </ul>
          </section>
          <div class="actions">
            <button type="button" :disabled="searching" @click="runSearch">
              {{ searching ? "试算中…" : "试算最优排法" }}
            </button>
            <button type="button" @click="clearAll">清空</button>
            <button
              type="button"
              class="primary"
              :disabled="!report.qualified"
              @click="install"
            >
              实装试车
            </button>
          </div>
          <p v-if="searchNote" class="note">{{ searchNote }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
