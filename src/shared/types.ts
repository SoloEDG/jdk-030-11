export type Dir = "n" | "e" | "s" | "w";
export type TileKind = "wall" | "floor" | "goal" | "gap";
export type BoxKind = "timber" | "iron" | "glass";
export type FloorMorph = "bridge" | "seal";
export type AttemptStatus = "playing" | "cleared";

export interface Vec {
  x: number;
  y: number;
}

export interface Box {
  id: string;
  kind: BoxKind;
  x: number;
  y: number;
}

export interface Plate {
  id: string;
  x: number;
  y: number;
  accept: BoxKind;
  doorIds: string[];
  floorIds: string[];
  powered: boolean;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

export interface FloorPatch {
  id: string;
  x: number;
  y: number;
  morph: FloorMorph;
  active: boolean;
}

/** 圆弧片: r0 === r1 为定半径 dwell；直边片: r0 -> r1 等速斜边（可翻面）。 */
export interface CamPieceSpec {
  id: string;
  kind: "arc" | "ramp";
  span: number;
  r0: number;
  r1: number;
}

export interface LiftFloorSpec {
  id: string;
  label: string;
  height: number;
  row: number;
}

export interface LiftStopSpec {
  id: string;
  angle: number;
  floorId: string;
}

/** 工单：货梯凸轮的设计指标与给定片库。 */
export interface LiftOrder {
  shaftCols: number[];
  floors: LiftFloorSpec[];
  stops: LiftStopSpec[];
  windowDeg: number;
  tolerance: number;
  sleeveRadius: number;
  boreRadius: number;
  rollerOptions: number[];
  filletMin: number;
  filletOptions: number[];
  pieces: CamPieceSpec[];
  crankStepDeg: number;
}

/** 一份凸轮盘设计：片序 + 翻面 + 滚轮直径 + 内圆角。同一卷盘所有停靠点共用。 */
export interface CamDesign {
  order: string[];
  flips: Record<string, boolean>;
  rollerDia: number;
  fillet: number;
}

export interface LiftRuntime {
  order: LiftOrder;
  design: CamDesign | null;
  angle: number;
  riding: { player: boolean; boxIds: string[] };
}

export interface RuntimeLevel {
  id: string;
  title: string;
  blurb: string;
  width: number;
  height: number;
  tiles: TileKind[][];
  player: Vec;
  boxes: Box[];
  plates: Plate[];
  doors: Door[];
  floors: FloorPatch[];
  lift: LiftRuntime | null;
}

export interface Attempt {
  steps: number;
  status: AttemptStatus;
}

export interface LevelRecord {
  bestSteps: number;
  clearedAt: number;
}

export interface GameDocument {
  version: 1;
  currentLevelId: string;
  level: RuntimeLevel;
  attempt: Attempt;
  records: Record<string, LevelRecord>;
}

export interface MoveResult {
  moved: boolean;
  pushed: boolean;
  boxId?: string;
  reason?: "blocked" | "cleared" | "idle" | "riding";
}

export const BOX_LABEL: Record<BoxKind, string> = {
  timber: "木箱",
  iron: "铁箱",
  glass: "玻璃箱",
};

export const DIR_VEC: Record<Dir, Vec> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};
