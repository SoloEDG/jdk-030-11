import { computed, type Ref } from "vue";
import { LEVELS, getLevel, hydrate } from "../lib/catalog";
import { betterRecord, readSave, writeSave } from "../lib/persist";
import { evaluateGadgets } from "@/features/gadget";
import { freshAttempt } from "@/features/ledger";
import { evaluateDesign } from "@/features/winch/lib/design";
import type { CamDesign, GameDocument } from "@/shared/types";

/** 实装保存的凸轮盘：重新校核合格才算数，未闭合/超差的 的草图不能过门。 */
function installSavedCam(document: GameDocument, design: CamDesign | undefined): boolean {
  const lift = document.level.lift;
  if (!lift || !design) return false;
  const report = evaluateDesign(lift.order, design);
  if (!report.qualified) return false;
  lift.design = design;
  return true;
}

export function loadInitial(): GameDocument {
  const saved = readSave();
  const currentLevelId =
    saved && LEVELS.some((level) => level.id === saved.currentLevelId)
      ? saved.currentLevelId
      : LEVELS[0].id;
  const document: GameDocument = {
    version: 1,
    currentLevelId,
    level: hydrate(getLevel(currentLevelId)),
    attempt: freshAttempt(),
    records: saved?.records ?? {},
  };
  installSavedCam(document, saved?.cams?.[currentLevelId]);
  evaluateGadgets(document);
  return document;
}

export function useVoyage(document: Ref<GameDocument>) {
  const catalog = computed(() =>
    LEVELS.map((level) => ({
      id: level.id,
      title: level.title,
      blurb: level.blurb,
      bestSteps: document.value.records[level.id]?.bestSteps ?? null,
      current: level.id === document.value.currentLevelId,
    })),
  );
  const completed = computed(() =>
    Object.entries(document.value.records)
      .map(([id, record]) => ({
        id,
        title: LEVELS.find((level) => level.id === id)?.title ?? id,
        bestSteps: record.bestSteps,
        clearedAt: record.clearedAt,
      }))
      .sort((a, b) => a.bestSteps - b.bestSteps),
  );

  function persist(): void {
    const cams: Record<string, CamDesign> = {};
    const lift = document.value.level.lift;
    if (lift?.design) cams[document.value.currentLevelId] = lift.design;
    const saved = readSave();
    writeSave({
      version: 1,
      currentLevelId: document.value.currentLevelId,
      records: document.value.records,
      cams: { ...saved?.cams, ...cams },
    });
  }

  function openLevel(id: string): void {
    const blueprint = getLevel(id);
    document.value.currentLevelId = id;
    document.value.level = hydrate(blueprint);
    document.value.attempt = freshAttempt();
    installSavedCam(document.value, readSave()?.cams?.[id]);
    evaluateGadgets(document.value);
    persist();
  }

  function resetLevel(): void {
    openLevel(document.value.currentLevelId);
  }

  function commitClear(): void {
    const id = document.value.currentLevelId;
    const steps = document.value.attempt.steps;
    document.value.records[id] = betterRecord(document.value.records[id], steps, Date.now());
    persist();
  }

  /** 实装凸轮盘（须已通过校核），并写入存档。 */
  function installCam(design: CamDesign): boolean {
    const lift = document.value.level.lift;
    if (!lift) return false;
    const report = evaluateDesign(lift.order, design);
    if (!report.qualified) return false;
    lift.design = design;
    persist();
    return true;
  }

  return { catalog, completed, openLevel, resetLevel, commitClear, installCam, persist };
}
