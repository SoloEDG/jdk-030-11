import type { LiftOrder } from "@/shared/types";
import { DEG, type Pt } from "./geom";

export interface LiftCurve {
  stepDeg: number;
  count: number;
  /** 每个转角采样点的厢底高度（滚轮中心高 - 滚轮半径）。 */
  h: Float64Array;
  /** 每个采样点的实际支撑点（凸轮系坐标），最多两个（搭桥时两个）。 */
  contactA: Int32Array;
  contactB: Int32Array;
}

/**
 * 滚轮托厢底仿真：凸轮转过 theta 时，滚轮（半径 rollerR）中心在过轴心的竖直导轨上，
 * 静止托在轮廓最高点。厢底高度 = 滚轮中心高 - 滚轮半径。
 * 逐点取 q.y + sqrt(R² - q.x²) 的上包络 —— 两段靠近的爬升会让滚轮同时搭到
 * 两个远离的盘沿（搭桥），此处自然体现为滚轮下不到谷底。
 */
export function simulateLift(points: Pt[], rollerR: number, stepDeg = 0.5): LiftCurve {
  const count = Math.round(360 / stepDeg);
  const h = new Float64Array(count);
  const contactA = new Int32Array(count).fill(-1);
  const contactB = new Int32Array(count).fill(-1);
  if (points.length === 0) return { stepDeg, count, h, contactA, contactB };
  const xs = new Float64Array(points.length);
  const ys = new Float64Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    xs[i] = points[i].x;
    ys[i] = points[i].y;
  }
  for (let k = 0; k < count; k += 1) {
    const theta = k * stepDeg;
    // 从动件在正上方：凸轮角 theta 的轮廓点转到 +y 轴，即整体旋转 (90° - theta)
    const a = (90 - theta) * DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let best = -Infinity;
    let bestIdx = -1;
    for (let i = 0; i < points.length; i += 1) {
      const qx = xs[i] * c - ys[i] * s;
      if (qx > rollerR || qx < -rollerR) continue;
      const qy = xs[i] * s + ys[i] * c;
      const lift = qy + Math.sqrt(rollerR * rollerR - qx * qx);
      if (lift > best) {
        best = lift;
        bestIdx = i;
      }
    }
    // 找出与最高点等高的第二个接触点（搭桥）
    let second = -1;
    if (bestIdx >= 0) {
      for (let i = 0; i < points.length; i += 1) {
        if (i === bestIdx) continue;
        const qx = xs[i] * c - ys[i] * s;
        if (qx > rollerR || qx < -rollerR) continue;
        const qy = xs[i] * s + ys[i] * c;
        const lift = qy + Math.sqrt(rollerR * rollerR - qx * qx);
        if (Math.abs(lift - best) <= 1e-4) {
          // 与首触点保持最小角距，避免把相邻采样点误报为第二沿
          const ia = Math.min(Math.abs(i - bestIdx), points.length - Math.abs(i - bestIdx));
          if (ia > 4) {
            second = i;
            break;
          }
        }
      }
    }
    h[k] = best - rollerR;
    contactA[k] = bestIdx;
    contactB[k] = second;
  }
  return { stepDeg, count, h, contactA, contactB };
}

export function heightAt(curve: LiftCurve, angleDeg: number): number {
  const wrapped = ((angleDeg % 360) + 360) % 360;
  const pos = wrapped / curve.stepDeg;
  const i0 = Math.floor(pos) % curve.count;
  const i1 = (i0 + 1) % curve.count;
  const frac = pos - Math.floor(pos);
  return curve.h[i0] * (1 - frac) + curve.h[i1] * frac;
}

/** 当前转角下的实际支撑点（凸轮系坐标）。 */
export function contactPoints(curve: LiftCurve, points: Pt[], angleDeg: number): Pt[] {
  const wrapped = ((angleDeg % 360) + 360) % 360;
  const k = Math.round(wrapped / curve.stepDeg) % curve.count;
  const out: Pt[] = [];
  const a = curve.contactA[k];
  const b = curve.contactB[k];
  if (a >= 0 && points[a]) out.push(points[a]);
  if (b >= 0 && points[b]) out.push(points[b]);
  return out;
}

export interface StopAnalysis {
  stopId: string;
  floorId: string;
  dev: number;
  ok: boolean;
  worstAngle: number;
}

export interface LiftAnalysis {
  stops: StopAnalysis[];
  worstDev: number;
  worstAngle: number;
  worstStopId: string | null;
}

function angleDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
}

/** 逐停靠点：门开窗口内 |厢高 - 门槛| 的最大值；再取全盘最坏。 */
export function analyzeLift(order: LiftOrder, curve: LiftCurve): LiftAnalysis {
  const stops: StopAnalysis[] = [];
  let worstDev = -1;
  let worstAngle = 0;
  let worstStopId: string | null = null;
  for (const stop of order.stops) {
    const floor = order.floors.find((f) => f.id === stop.floorId);
    if (!floor) continue;
    let dev = 0;
    let devAngle = stop.angle;
    const samples = Math.max(8, Math.ceil((order.windowDeg * 2) / 0.25));
    for (let i = 0; i <= samples; i += 1) {
      const theta = stop.angle - order.windowDeg + (2 * order.windowDeg * i) / samples;
      const d = Math.abs(heightAt(curve, theta) - floor.height);
      if (d > dev) {
        dev = d;
        devAngle = ((theta % 360) + 360) % 360;
      }
    }
    const ok = dev <= order.tolerance + 1e-9;
    stops.push({ stopId: stop.id, floorId: stop.floorId, dev, ok, worstAngle: devAngle });
    if (dev > worstDev) {
      worstDev = dev;
      worstAngle = devAngle;
      worstStopId = stop.id;
    }
  }
  return { stops, worstDev, worstAngle, worstStopId };
}

/** 当前转角是否平层停靠：在某停靠点窗口内且 |厢高-门槛| ≤ 余量。 */
export function berthAt(
  order: LiftOrder,
  curve: LiftCurve,
  angleDeg: number,
): { stopId: string; floorId: string; dev: number } | null {
  for (const stop of order.stops) {
    if (angleDist(angleDeg, stop.angle) > order.windowDeg) continue;
    const floor = order.floors.find((f) => f.id === stop.floorId);
    if (!floor) continue;
    const dev = Math.abs(heightAt(curve, angleDeg) - floor.height);
    if (dev <= order.tolerance + 1e-9) return { stopId: stop.id, floorId: floor.id, dev };
  }
  return null;
}

/** 转角是否处于某停靠窗口内（不论是否平层）——用于提示。 */
export function nearStop(order: LiftOrder, angleDeg: number): string | null {
  for (const stop of order.stops) {
    if (angleDist(angleDeg, stop.angle) <= order.windowDeg) return stop.id;
  }
  return null;
}
