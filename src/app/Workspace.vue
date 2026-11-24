<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { StageView, TileLegend } from "@/features/atlas";
import { GadgetPanel } from "@/features/gadget";
import { MoverHud } from "@/features/hauler";
import { StepMeter } from "@/features/ledger";
import { LevelRail, RecordBoard } from "@/features/voyage";
import { WinchDesigner, WinchPanel } from "@/features/winch";
import { actionFromKey, shouldCapture } from "./keys";
import { useWorkshop } from "./useWorkshop";

const shop = useWorkshop();
const { document, notice, designerOpen } = shop;
const { title, blurb } = shop.atlas;
const { counts } = shop.hauler;
const { summary } = shop.gadget;
const { steps, status, coverage } = shop.ledger;
const { catalog, completed } = shop.voyage;

function onKey(event: KeyboardEvent): void {
  if (designerOpen.value) {
    if (event.key === "Escape") designerOpen.value = false;
    return;
  }
  if (!shouldCapture(event)) return;
  const action = actionFromKey(event);
  if (!action) return;
  event.preventDefault();
  if (action === "reset") shop.reset();
  else if (action === "crankUp") shop.crank(1);
  else if (action === "crankDown") shop.crank(-1);
  else shop.move(action);
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="workshop">
    <header class="mast">
      <div class="brand">
        <span class="mark" aria-hidden="true">闩</span>
        <div>
          <h1>栈闩工房</h1>
          <p>箱认踏板，板动门廊。一步一格，记下你走的路。</p>
        </div>
      </div>
      <p class="notice" :data-tone="notice.tone">{{ notice.message }}</p>
    </header>
    <div class="bench">
      <aside class="rail">
        <LevelRail :catalog="catalog" @select="shop.selectLevel" @reset="shop.reset" />
        <RecordBoard :completed="completed" />
      </aside>
      <main class="stage">
        <div class="stage-head">
          <h2>{{ title }}</h2>
          <p>{{ blurb }}</p>
        </div>
        <StageView :document="document" />
        <MoverHud :counts="counts" />
      </main>
      <aside class="side">
        <StepMeter :steps="steps" :status="status" :coverage="coverage" :lift-mode="!!document.level.lift" />
        <WinchPanel
          v-if="document.level.lift"
          :document="document"
          @open-designer="designerOpen = true"
        />
        <GadgetPanel :document="document" :summary="summary" />
        <TileLegend />
      </aside>
    </div>
    <WinchDesigner
      v-if="designerOpen && document.level.lift"
      :level="document.level"
      @close="designerOpen = false"
      @install="(design) => { if (shop.installCam(design)) designerOpen = false; }"
    />
  </div>
</template>
