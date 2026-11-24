/** 细扫：一层 dwell 居中停靠 + 窗口/内圆角组合。 */
import { getLevel } from "@/features/voyage/lib/catalog";
import { evaluateDesign } from "@/features/winch/lib/design";
import type { CamDesign, LiftOrder } from "@/shared/types";

const base = getLevel("lift-01").lift!;

function row(a30span: number, stopAngle: number, windowDeg: number, fillet: number) {
  const order: LiftOrder = JSON.parse(JSON.stringify(base));
  const a30 = order.pieces.find((p) => p.id === "a30")!;
  const a80 = order.pieces.find((p) => p.id === "a80")!;
  a80.span += a30.span - a30span;
  a30.span = a30span;
  order.stops[0].angle = stopAngle;
  order.windowDeg = windowDeg;
  const parts: string[] = [
    `A30=${a30span} 停${stopAngle}° 窗±${windowDeg} 圆角${fillet}`.padEnd(30),
  ];
  for (const dia of [10, 14, 18, 24]) {
    const design: CamDesign = {
      order: ["a30", "r1", "a55", "r2", "a80", "r3"],
      flips: {},
      rollerDia: dia,
      fillet,
    };
    const report = evaluateDesign(order, design);
    const s1 = report.analysis.stops.find((s) => s.stopId === "s1")!;
    parts.push(`d${dia}:${s1.dev.toFixed(2)}${s1.ok ? "✓" : "✗"}`);
  }
  console.log(parts.join("  "));
}

for (const fillet of [3, 5]) {
  for (const win of [6, 8]) {
    row(20, 10, win, fillet);
    row(24, 10, win, fillet);
    row(24, 15, win, fillet);
    row(28, 15, win, fillet);
    row(30, 15, win, fillet);
  }
}
