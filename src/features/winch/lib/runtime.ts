import type { CamDesign, GameDocument, LiftOrder, RuntimeLevel, Vec } from "@/shared/types";
import { buildProfile } from "./geom";
import { berthAt, heightAt, simulateLift, type LiftCurve } from "./sim";

const curveCache = new Map<string, LiftCurve>();

function designKey(levelId: string, design: CamDesign): string {
  return `${levelId}|${design.rollerDia}|${design.fillet}|${design.order.join(",")}|${JSON.stringify(design.flips)}`;
}

/** 实装设计的升降曲线（带缓存）。 */
export function installedCurve(levelId: string, order: LiftOrder, design: CamDesign): LiftCurve {
  const key = designKey(levelId, design);
  let curve = curveCache.get(key);
  if (!curve) {
    const profile = buildProfile(order, design);
    curve = simulateLift(profile.points, design.rollerDia / 2);
    curveCache.set(key, curve);
    if (curveCache.size > 12) {
      const first = curveCache.keys().next().value;
      if (first) curveCache.delete(first);
    }
  }
  return curve;
}

export function liftCurveOf(level: RuntimeLevel): LiftCurve | null {
  if (!level.lift?.design) return null;
  return installedCurve(level.id, level.lift.order, level.lift.design);
}

/** 当前厢高（未实装时按停靠在一层）。 */
export function carHeight(level: RuntimeLevel): number {
  const lift = level.lift;
  if (!lift) return 0;
  const curve = liftCurveOf(level);
  if (!curve) return lift.order.floors[0]?.height ?? 0;
  return heightAt(curve, lift.angle);
}

/** 当前是否平层停靠（需已实装合格凸轮）。 */
export function berthState(level: RuntimeLevel): { stopId: string; floorId: string; dev: number } | null {
  const lift = level.lift;
  if (!lift?.design) return null;
  const curve = liftCurveOf(level);
  if (!curve) return null;
  return berthAt(lift.order, curve, lift.angle);
}

/** 厢板平层时占据的格子。 */
export function carCellsAt(order: LiftOrder, floorId: string): Vec[] {
  const floor = order.floors.find((f) => f.id === floorId);
  if (!floor) return [];
  return order.shaftCols.map((x) => ({ x, y: floor.row }));
}

/** 当前（若平层）厢板格子；未实装时厢板驻车在一层。 */
export function carCells(level: RuntimeLevel): Vec[] {
  const lift = level.lift;
  if (!lift) return [];
  if (!lift.design) {
    const ground = lift.order.floors[0];
    return ground ? carCellsAt(lift.order, ground.id) : [];
  }
  const berth = berthState(level);
  if (!berth) return [];
  return carCellsAt(lift.order, berth.floorId);
}

export function isBoxRiding(level: RuntimeLevel, boxId: string): boolean {
  return Boolean(level.lift?.riding.boxIds.includes(boxId));
}

export function isPlayerRiding(level: RuntimeLevel): boolean {
  return Boolean(level.lift?.riding.player);
}

/** 厢板渲染用浮点行（按厢高在楼层间插值）。 */
export function carRowFloat(level: RuntimeLevel): number {
  const lift = level.lift;
  if (!lift) return 0;
  const floors = [...lift.order.floors].sort((a, b) => a.height - b.height);
  if (floors.length === 0) return 0;
  const h = carHeight(level);
  if (h <= floors[0].height) return floors[0].row;
  for (let i = 0; i < floors.length - 1; i += 1) {
    const lo = floors[i];
    const hi = floors[i + 1];
    if (h <= hi.height) {
      const k = (h - lo.height) / (hi.height - lo.height);
      return lo.row + k * (hi.row - lo.row);
    }
  }
  return floors[floors.length - 1].row;
}

export interface CrankResult {
  cranked: boolean;
  reason?: "no-cam";
  angle?: number;
  height?: number;
  berth?: { stopId: string; floorId: string; dev: number } | null;
  riders?: number;
}

/** 摇手轮一格：凸轮转过 crankStepDeg，厢内人箱随厢换层。 */
export function crankLift(document: GameDocument, sign: 1 | -1): CrankResult {
  const level = document.level;
  const lift = level.lift;
  if (!lift) return { cranked: false, reason: "no-cam" };
  if (!lift.design) return { cranked: false, reason: "no-cam" };

  // 起吊前：平层时把厢板上的实体标记为随厢
  const before = berthState(level);
  const riders: string[] = [];
  let playerRides = false;
  if (before) {
    const cells = carCellsAt(lift.order, before.floorId);
    const onCar = (p: Vec) => cells.some((c) => c.x === p.x && c.y === p.y);
    if (onCar(level.player)) playerRides = true;
    for (const box of level.boxes) {
      if (onCar(box)) riders.push(box.id);
    }
  }
  if (playerRides || riders.length > 0) {
    lift.riding = { player: playerRides, boxIds: riders };
  }

  lift.angle = ((lift.angle + sign * lift.order.crankStepDeg) % 360 + 360) % 360;

  // 到位后：若平层，把随厢实体落到新层厢板上（保持所在列）
  const after = berthState(level);
  if (after) {
    const floor = lift.order.floors.find((f) => f.id === after.floorId);
    if (floor) {
      if (lift.riding.player) {
        level.player = { x: level.player.x, y: floor.row };
      }
      for (const id of lift.riding.boxIds) {
        const box = level.boxes.find((b) => b.id === id);
        if (box) box.y = floor.row;
      }
    }
    lift.riding = { player: false, boxIds: [] };
  }

  return {
    cranked: true,
    angle: lift.angle,
    height: carHeight(level),
    berth: after,
    riders: (lift.riding.player ? 1 : 0) + lift.riding.boxIds.length,
  };
}
