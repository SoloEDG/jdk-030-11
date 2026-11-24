export { buildProfile, pieceEnds, rot, DEG } from "./lib/geom";
export type { Pt, ProfileResult } from "./lib/geom";
export {
  analyzeLift,
  berthAt,
  contactPoints,
  heightAt,
  nearStop,
  simulateLift,
} from "./lib/sim";
export type { LiftAnalysis, LiftCurve, StopAnalysis } from "./lib/sim";
export { evaluateDesign, searchBestDesign } from "./lib/design";
export type { DesignReport, SearchOutcome } from "./lib/design";
export {
  berthState,
  carCells,
  carCellsAt,
  carHeight,
  carRowFloat,
  crankLift,
  installedCurve,
  isBoxRiding,
  isPlayerRiding,
  liftCurveOf,
} from "./lib/runtime";
export type { CrankResult } from "./lib/runtime";
export { default as WinchPanel } from "./ui/WinchPanel.vue";
export { default as WinchDesigner } from "./ui/WinchDesigner.vue";
