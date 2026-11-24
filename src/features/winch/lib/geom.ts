import type { CamDesign, CamPieceSpec, LiftOrder } from "@/shared/types";

export interface Pt {
  x: number;
  y: number;
}

export const DEG = Math.PI / 180;

export function rot(p: Pt, angleDeg: number): Pt {
  const a = angleDeg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function len(p: Pt): number {
  return Math.hypot(p.x, p.y);
}

function norm(p: Pt): Pt {
  const l = len(p) || 1;
  return { x: p.x / l, y: p.y / l };
}

/** 片在链中的起止半径（直边片翻面后互换）。 */
export function pieceEnds(spec: CamPieceSpec, flipped: boolean): { start: number; end: number } {
  const a = spec.kind === "arc" ? spec.r0 : flipped ? spec.r1 : spec.r0;
  const b = spec.kind === "arc" ? spec.r0 : flipped ? spec.r0 : spec.r1;
  return { start: a, end: b };
}

interface PlacedPiece {
  spec: CamPieceSpec;
  flipped: boolean;
  theta0: number;
  start: number;
  end: number;
}

/** 片参数方程：角度 theta（度）-> 笛卡尔点。直边片为等速（阿基米德）斜边。 */
function piecePoint(p: PlacedPiece, thetaDeg: number): Pt {
  const t = thetaDeg * DEG;
  if (p.spec.kind === "arc") {
    return { x: p.spec.r0 * Math.cos(t), y: p.spec.r0 * Math.sin(t) };
  }
  const u = (thetaDeg - p.theta0) / p.spec.span;
  const r = p.start + (p.end - p.start) * u;
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

/** 片在角度 theta 处的单位切向（沿转角增大方向）。 */
function pieceTangent(p: PlacedPiece, thetaDeg: number): Pt {
  const t = thetaDeg * DEG;
  if (p.spec.kind === "arc") return { x: -Math.sin(t), y: Math.cos(t) };
  const u = (thetaDeg - p.theta0) / p.spec.span;
  const r = p.start + (p.end - p.start) * u;
  const m = (p.end - p.start) / (p.spec.span * DEG);
  return norm({
    x: m * Math.cos(t) - r * Math.sin(t),
    y: m * Math.sin(t) + r * Math.cos(t),
  });
}

/** 片弧长（数值积分，足够密）。 */
function pieceLength(p: PlacedPiece): number {
  const steps = 64;
  let total = 0;
  let prev = piecePoint(p, p.theta0);
  for (let i = 1; i <= steps; i += 1) {
    const cur = piecePoint(p, p.theta0 + (p.spec.span * i) / steps);
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return total;
}

/** 从片首起算弧长 s 处的角度（度）。 */
function thetaAtArcLength(p: PlacedPiece, s: number): number {
  const steps = 96;
  let total = 0;
  let prev = piecePoint(p, p.theta0);
  for (let i = 1; i <= steps; i += 1) {
    const theta = p.theta0 + (p.spec.span * i) / steps;
    const cur = piecePoint(p, theta);
    const seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (total + seg >= s) {
      const k = seg > 0 ? (s - total) / seg : 0;
      return p.theta0 + (p.spec.span * (i - 1 + k)) / steps;
    }
    total += seg;
    prev = cur;
  }
  return p.theta0 + p.spec.span;
}

export interface ProfileResult {
  points: Pt[];
  chained: boolean;
  closed: boolean;
  spanOk: boolean;
  filletFits: boolean;
  hasConcaveJoint: boolean;
  minInnerFillet: number;
  maxR: number;
  minR: number;
  problems: string[];
}

const CHAIN_EPS = 1e-6;

/**
 * 按设计把圆弧片/直边片拼成闭合轮廓（从 0° 起沿转角增大方向）。
 * 凹接缝（谷底）按给定内圆角半径倒圆；凸棱保持尖棱。
 */
export function buildProfile(order: LiftOrder, design: CamDesign): ProfileResult {
  const problems: string[] = [];
  const byId = new Map(order.pieces.map((piece) => [piece.id, piece]));
  const placed: PlacedPiece[] = [];
  let cursor = 0;
  let chained = true;
  let prevEnd: number | null = null;
  for (const id of design.order) {
    const spec = byId.get(id);
    if (!spec) {
      problems.push(`未知片段 ${id}`);
      continue;
    }
    const flipped = Boolean(design.flips[id]);
    const ends = pieceEnds(spec, flipped);
    if (prevEnd != null && Math.abs(ends.start - prevEnd) > CHAIN_EPS) chained = false;
    placed.push({ spec, flipped, theta0: cursor, start: ends.start, end: ends.end });
    prevEnd = ends.end;
    cursor += spec.span;
  }
  const spanOk = Math.abs(cursor - 360) <= 1e-6;
  if (!spanOk) problems.push(`片段总跨度 ${cursor.toFixed(1)}° ≠ 360°`);
  const firstStart = placed.length > 0 ? placed[0].start : 0;
  const closed = chained && spanOk && placed.length > 0 && Math.abs((prevEnd ?? 0) - firstStart) <= CHAIN_EPS;
  if (!chained) problems.push("轮廓断链：相邻片段端半径不接");
  else if (!closed) problems.push("轮廓未闭合：尾端接不回首端");

  // 计算各接缝的转角方向与凹性
  const n = placed.length;
  const jointConcave: boolean[] = new Array(n).fill(false);
  const trim: number[] = new Array(n).fill(0); // 每个接缝两侧的倒圆回切量
  let filletFits = true;
  let hasConcaveJoint = false;
  if (closed) {
    for (let i = 0; i < n; i += 1) {
      const a = placed[i];
      const b = placed[(i + 1) % n];
      const ta = pieceTangent(a, a.theta0 + a.spec.span);
      const tb = pieceTangent(b, b.theta0);
      const cross = ta.x * tb.y - ta.y * tb.x;
      const turn = Math.atan2(cross, ta.x * tb.x + ta.y * tb.y);
      // 轮廓沿转角增大方向为逆时针，材料在行进左侧：
      // 右转（turn<0）是凹缝（谷底），需倒内圆角；左转是凸棱，保持尖棱。
      if (turn < -1e-6) {
        jointConcave[i] = true;
        hasConcaveJoint = true;
        trim[i] = design.fillet * Math.tan(-turn / 2);
      }
    }
    // 校验每片两端回切量不超过片长
    for (let i = 0; i < n; i += 1) {
      const prevJoint = (i + n - 1) % n;
      const need = trim[prevJoint] + trim[i];
      const have = pieceLength(placed[i]);
      if (need > have - 0.5) {
        filletFits = false;
        problems.push(
          `内圆角 ${design.fillet}mm 在片段 ${placed[i].spec.id} 上放不下（需 ${need.toFixed(1)}mm，片长 ${have.toFixed(1)}mm）`,
        );
      }
    }
  }

  // 采样轮廓：逐片切除两端回切量，凹缝处插入倒圆弧
  const points: Pt[] = [];
  const samplePiece = (p: PlacedPiece, fromTheta: number, toTheta: number) => {
    const span = toTheta - fromTheta;
    if (span <= 0) return;
    const approxLen = Math.max(1, span * DEG * Math.max(p.start, p.end));
    const steps = Math.max(2, Math.ceil(approxLen / 0.6));
    for (let i = 0; i <= steps; i += 1) {
      const theta = fromTheta + (span * i) / steps;
      const q = piecePoint(p, theta);
      const last = points[points.length - 1];
      if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 1e-9) points.push(q);
    }
  };

  if (placed.length > 0) {
    for (let i = 0; i < n; i += 1) {
      const p = placed[i];
      const prevJoint = (i + n - 1) % n;
      const startTrim = closed ? trim[prevJoint] : 0;
      const endTrim = closed ? trim[i] : 0;
      const from = startTrim > 0 ? thetaAtArcLength(p, startTrim) : p.theta0;
      const to = endTrim > 0 ? thetaAtArcLength(p, pieceLength(p) - endTrim) : p.theta0 + p.spec.span;
      samplePiece(p, from, to);
      // 接缝 i：片 i 尾 -> 片 i+1 头
      if (closed && jointConcave[i]) {
        const b = placed[(i + 1) % n];
        const f = design.fillet;
        // 顶点与顶点处切向：圆角圆心由两条顶点切线的空气侧偏移线交出，
        // 弧端点取圆心到切线的垂足，保证弧朝谷底俯伏而非外鼓。
        const V = piecePoint(p, p.theta0 + p.spec.span);
        const d1 = pieceTangent(p, p.theta0 + p.spec.span);
        const d2 = pieceTangent(b, b.theta0);
        // 左法线；圆角圆心在空气侧（行进右侧，即左法线的反向）
        const n1 = { x: -d1.y, y: d1.x };
        const n2 = { x: -d2.y, y: d2.x };
        // 圆心 = V − f·n1 + λ·d1 = V − f·n2 + μ·d2
        const ax = d1.x;
        const ay = d1.y;
        const bx = -d2.x;
        const by = -d2.y;
        const rx = -f * n2.x + f * n1.x;
        const ry = -f * n2.y + f * n1.y;
        const det = ax * by - ay * bx;
        if (Math.abs(det) > 1e-9) {
          const lambda = (rx * by - ry * bx) / det;
          const C = { x: V.x - f * n1.x + lambda * d1.x, y: V.y - f * n1.y + lambda * d1.y };
          // 垂足（圆与两切线的切点）
          const dot1 = (C.x - V.x) * d1.x + (C.y - V.y) * d1.y;
          const F1 = { x: V.x + dot1 * d1.x, y: V.y + dot1 * d1.y };
          const dot2 = (C.x - V.x) * d2.x + (C.y - V.y) * d2.y;
          const F2 = { x: V.x + dot2 * d2.x, y: V.y + dot2 * d2.y };
          const a1 = Math.atan2(F1.y - C.y, F1.x - C.x);
          const a2 = Math.atan2(F2.y - C.y, F2.x - C.x);
          // 沿朝向接缝顶点的短弧采样
          const av = Math.atan2(V.y - C.y, V.x - C.x);
          let delta = a2 - a1;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;
          const mid = a1 + delta / 2;
          const midErr = Math.abs(Math.atan2(Math.sin(mid - av), Math.cos(mid - av)));
          const sweep = midErr > Math.PI / 2 ? delta - Math.sign(delta) * 2 * Math.PI : delta;
          const arcSteps = Math.max(3, Math.ceil((Math.abs(sweep) * f) / 0.5));
          for (let k = 1; k <= arcSteps; k += 1) {
            const ang = a1 + (sweep * k) / arcSteps;
            points.push({ x: C.x + f * Math.cos(ang), y: C.y + f * Math.sin(ang) });
          }
        }
      }
    }
  }

  let maxR = 0;
  let minR = Infinity;
  for (const q of points) {
    const r = len(q);
    if (r > maxR) maxR = r;
    if (r < minR) minR = r;
  }

  return {
    points,
    chained,
    closed,
    spanOk,
    filletFits,
    hasConcaveJoint,
    minInnerFillet: hasConcaveJoint ? design.fillet : Infinity,
    maxR,
    minR,
    problems,
  };
}
