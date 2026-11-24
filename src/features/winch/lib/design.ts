import type { CamDesign, LiftOrder } from "@/shared/types";
import { buildProfile, pieceEnds, type ProfileResult } from "./geom";
import { analyzeLift, simulateLift, type LiftAnalysis, type LiftCurve } from "./sim";

export interface DesignReport {
  design: CamDesign;
  profile: ProfileResult;
  curve: LiftCurve;
  analysis: LiftAnalysis;
  qualified: boolean;
  problems: string[];
  warnings: string[];
}

/** 完整校核一份设计：闭合 -> 尺寸 -> 车削极限 -> 滚轮仿真 -> 平层余量。 */
export function evaluateDesign(order: LiftOrder, design: CamDesign): DesignReport {
  const problems: string[] = [];
  const warnings: string[] = [];
  const profile = buildProfile(order, design);
  problems.push(...profile.problems);
  if (!profile.filletFits && !profile.problems.some((p) => p.includes("内圆角"))) {
    problems.push("内圆角超出片段长度");
  }
  if (profile.hasConcaveJoint && design.fillet < order.filletMin) {
    problems.push(`内圆角 ${design.fillet}mm 小于车床极限 ${order.filletMin}mm`);
  }
  if (profile.maxR > order.sleeveRadius + 1e-9) {
    problems.push(`最大半径 ${profile.maxR.toFixed(1)}mm 装不进轴套半径 ${order.sleeveRadius}mm`);
  }
  if (profile.minR < order.boreRadius - 1e-9) {
    problems.push(`最小半径 ${profile.minR.toFixed(1)}mm 侵入轮毂 ${order.boreRadius}mm`);
  }
  const rollerR = design.rollerDia / 2;
  if (profile.hasConcaveJoint && rollerR > design.fillet) {
    warnings.push(`滚轮半径 ${rollerR}mm 大于内圆角 ${design.fillet}mm，谷底可能托不实`);
  }
  const curve = simulateLift(profile.points, rollerR);
  const analysis = profile.closed
    ? analyzeLift(order, curve)
    : { stops: [], worstDev: Infinity, worstAngle: 0, worstStopId: null };
  if (profile.closed && analysis.worstDev > order.tolerance + 1e-9) {
    problems.push(
      `最坏离层偏差 ${analysis.worstDev.toFixed(2)}mm 超出平层余量 ${order.tolerance}mm`,
    );
  }
  const qualified =
    profile.closed &&
    profile.chained &&
    profile.spanOk &&
    profile.filletFits &&
    problems.length === 0;
  return { design, profile, curve, analysis, qualified, problems, warnings };
}

export interface SearchOutcome {
  best: DesignReport | null;
  tested: number;
  chained: number;
  feasible: number;
  /** 不可行时最接近合格的偏差（供提示）。 */
  nearestDev: number;
}

/**
 * 试算最优排法：枚举片序 × 直边翻面 × 滚轮直径 × 内圆角。
 * 先保住各停靠窗口全在余量内（硬约束），再使最坏离层偏差最小（软目标）。
 */
export function searchBestDesign(order: LiftOrder): SearchOutcome {
  const ids = order.pieces.map((p) => p.id);
  let tested = 0;
  let chained = 0;
  let feasible = 0;
  let nearestDev = Infinity;
  let best: DesignReport | null = null;

  const consider = (design: CamDesign) => {
    tested += 1;
    const report = evaluateDesign(order, design);
    const structural =
      report.profile.closed && report.profile.chained && report.profile.filletFits;
    if (!structural) return;
    chained += 1;
    const dev = report.analysis.worstDev;
    if (dev < nearestDev) nearestDev = dev;
    if (!report.qualified) return;
    feasible += 1;
    if (!best || dev < best.analysis.worstDev - 1e-9) best = report;
  };

  // 枚举排列（Heap 算法）
  const permute = (arr: string[], visit: (perm: string[]) => void) => {
    const a = [...arr];
    const rec = (k: number) => {
      if (k <= 1) {
        visit([...a]);
        return;
      }
      rec(k - 1);
      for (let i = 0; i < k - 1; i += 1) {
        const j = k % 2 === 0 ? i : 0;
        [a[j], a[k - 1]] = [a[k - 1], a[j]];
        rec(k - 1);
      }
    };
    rec(a.length);
  };

  // 对给定片序，沿链推导直边翻面（首片两种取向都试）
  const assignFlips = (seq: string[], visit: (flips: Record<string, boolean>) => void) => {
    const byId = new Map(order.pieces.map((p) => [p.id, p]));
    const flips: Record<string, boolean> = {};
    const dfs = (index: number, prevEnd: number | null): boolean => {
      if (index >= seq.length) {
        // 闭环：尾端须接回首端
        const first = byId.get(seq[0])!;
        const firstEnds = pieceEnds(first, Boolean(flips[first.id]));
        if (prevEnd != null && Math.abs(prevEnd - firstEnds.start) <= 1e-6) visit({ ...flips });
        return true;
      }
      const spec = byId.get(seq[index])!;
      const options = spec.kind === "arc" ? [false] : [false, true];
      let any = false;
      for (const flip of options) {
        const ends = pieceEnds(spec, flip);
        if (prevEnd != null && Math.abs(ends.start - prevEnd) > 1e-6) continue;
        flips[spec.id] = flip;
        if (dfs(index + 1, ends.end)) any = true;
        delete flips[spec.id];
      }
      return any;
    };
    dfs(0, null);
  };

  permute(ids, (seq) => {
    assignFlips(seq, (flips) => {
      for (const rollerDia of order.rollerOptions) {
        for (const fillet of order.filletOptions) {
          consider({ order: [...seq], flips: { ...flips }, rollerDia, fillet });
        }
      }
    });
  });

  return { best, tested, chained, feasible, nearestDev };
}
