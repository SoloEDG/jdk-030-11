/** 诊断：内圆角是否真正改变轮廓与升降曲线。 */
import { getLevel } from "@/features/voyage/lib/catalog";
import { buildProfile } from "@/features/winch/lib/geom";
import { heightAt, simulateLift } from "@/features/winch/lib/sim";
import type { CamDesign } from "@/shared/types";

const order = getLevel("lift-01").lift!;
const base: CamDesign = {
  order: ["a30", "r1", "a55", "r2", "a80", "r3"],
  flips: {},
  rollerDia: 10,
  fillet: 3,
};

for (const fillet of [2, 3, 5, 8]) {
  const profile = buildProfile(order, { ...base, fillet });
  // 谷底（0° 接缝附近）最小半径采样
  const near = profile.points.filter((p) => {
    const a = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
    return a < 6 || a > 354;
  });
  const minR = Math.min(...near.map((p) => Math.hypot(p.x, p.y)));
  const curve = simulateLift(profile.points, 5);
  console.log(
    `圆角${fillet}: 点数=${profile.points.length} 谷底附近最小半径=${minR.toFixed(3)} 23°厢高=${heightAt(curve, 23).toFixed(4)}`,
  );
}
