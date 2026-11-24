<script setup lang="ts">
import { computed } from "vue";
import { berthState, carHeight } from "../lib/runtime";
import type { GameDocument } from "@/shared/types";

const props = defineProps<{ document: GameDocument }>();
defineEmits<{ openDesigner: [] }>();

const lift = computed(() => props.document.level.lift);
const berth = computed(() => berthState(props.document.level));
const height = computed(() => carHeight(props.document.level));
const floorLabel = (id: string) =>
  lift.value?.order.floors.find((f) => f.id === id)?.label ?? id;
</script>

<template>
  <section v-if="lift" class="panel winch" aria-label="货梯">
    <h2>货梯</h2>
    <p class="lede">
      {{ lift.design ? "凸轮盘已实装，Q/E 摇手轮换层。" : "未实装凸轮盘，厢板驻车在一层。" }}
    </p>
    <ul>
      <li>手轮转角 {{ lift.angle.toFixed(0) }}°</li>
      <li>厢高 {{ height.toFixed(1) }}mm</li>
      <li v-if="berth" class="live">平层{{ floorLabel(berth.floorId) }}（差 {{ berth.dev.toFixed(2) }}mm），可以跨出</li>
      <li v-else>层间悬停，平层后才能跨出</li>
      <li v-if="lift.design">
        滚轮 {{ lift.design.rollerDia }}mm · 内圆角 {{ lift.design.fillet }}mm
      </li>
    </ul>
    <button type="button" class="reset" @click="$emit('openDesigner')">打开凸轮工单</button>
  </section>
</template>
