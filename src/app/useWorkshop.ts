import { ref } from "vue";
import { useAtlas } from "@/features/atlas";
import { useGadget } from "@/features/gadget";
import { useHauler } from "@/features/hauler";
import { useLedger } from "@/features/ledger";
import { loadInitial, useVoyage } from "@/features/voyage";
import { berthState, crankLift } from "@/features/winch/lib/runtime";
import type { Notice } from "@/shared/commands";
import type { CamDesign, Dir } from "@/shared/types";

export function useWorkshop() {
  const document = ref(loadInitial());
  const notice = ref<Notice>({
    tone: "info",
    message: "把对得上的箱子压上踏板，门和地板会跟着变。",
  });
  const designerOpen = ref(false);
  const atlas = useAtlas(document);
  const hauler = useHauler(document);
  const gadget = useGadget(document);
  const ledger = useLedger(document);
  const voyage = useVoyage(document);

  function notify(next: Notice): void {
    notice.value = next;
  }

  function move(dir: Dir): void {
    const result = hauler.tryMove(dir);
    if (!result.moved) {
      if (result.reason === "cleared") {
        notify({ tone: "warn", message: "本关已通关。重置或另选关卡后再推。" });
      } else if (result.reason === "riding") {
        notify({ tone: "warn", message: "厢在层间悬着，先摇 Q/E 手轮到平层再跨出。" });
      }
      return;
    }
    gadget.refresh();
    const tick = ledger.afterMove(result);
    if (tick.cleared) {
      voyage.commitClear();
      notify({
        tone: "success",
        message: `通关，用了 ${document.value.attempt.steps} 步。最佳记录已写入目录。`,
      });
    }
  }

  function crank(sign: 1 | -1): void {
    const lift = document.value.level.lift;
    if (!lift) return;
    if (!lift.design) {
      notify({ tone: "warn", message: "还没有实装凸轮盘。先打开凸轮工单，拼出合格轮廓再试车。" });
      return;
    }
    const result = crankLift(document.value, sign);
    if (!result.cranked) return;
    gadget.refresh();
    ledger.afterMove({ moved: true, pushed: false });
    const order = lift.order;
    const berth = berthState(document.value.level);
    if (berth) {
      const floor = order.floors.find((f) => f.id === berth.floorId);
      notify({
        tone: "success",
        message: `手轮 ${lift.angle.toFixed(0)}° · 平层${floor?.label ?? ""}（差 ${berth.dev.toFixed(2)}mm），可以跨出。`,
      });
    } else {
      notify({
        tone: "info",
        message: `手轮 ${lift.angle.toFixed(0)}° · 厢高 ${result.height?.toFixed(1)}mm，层间悬停。`,
      });
    }
  }

  function installCam(design: CamDesign): boolean {
    const ok = voyage.installCam(design);
    if (ok) {
      const berth = berthState(document.value.level);
      notify({
        tone: "success",
        message: berth
          ? "凸轮盘实装到位，当前正好平层。摇 Q/E 试车。"
          : "凸轮盘实装到位。摇 Q/E 手轮换层试车。",
      });
    } else {
      notify({ tone: "warn", message: "校核没过：未闭合、装不进轴套或超出平层余量的轮廓不能实装。" });
    }
    return ok;
  }

  function reset(): void {
    voyage.resetLevel();
    notify({ tone: "info", message: "已重置当前关卡，最佳记录仍在。" });
  }

  function selectLevel(id: string): void {
    voyage.openLevel(id);
    designerOpen.value = false;
    notify({
      tone: "info",
      message: `进入「${document.value.level.title}」。${document.value.level.blurb}`,
    });
  }

  return {
    document,
    notice,
    designerOpen,
    atlas,
    hauler,
    gadget,
    ledger,
    voyage,
    move,
    crank,
    installCam,
    reset,
    selectLevel,
  };
}
