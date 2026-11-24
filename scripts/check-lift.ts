/**
 * 货梯凸轮工单校验脚本：
 * 1. 验证规范排法合格且报告合理
 * 2. 自动搜索能找到最优排法（先保余量、再最小化最坏偏差）
 * 3. 大滚轮在谷底搭桥超差（不可实装）
 * 4. 用真实游戏逻辑完整通关 lift-01
 */
import { getLevel, hydrate } from "@/features/voyage/lib/catalog";
import { evaluateDesign, searchBestDesign } from "@/features/winch/lib/design";
import { buildProfile } from "@/features/winch/lib/geom";
import { heightAt, simulateLift } from "@/features/winch/lib/sim";
import { berthState, crankLift } from "@/features/winch/lib/runtime";
import { applyMove } from "@/features/hauler/lib/push";
import { evaluateGadgets } from "@/features/gadget/lib/power";
import { goalsSatisfied } from "@/features/ledger/lib/win";
import type { CamDesign, Dir, GameDocument } from "@/shared/types";

const blueprint = getLevel("lift-01");
const order = blueprint.lift!;
let failures = 0;

function check(name: string, cond: boolean, detail = "") {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures += 1;
  console.log(`[${mark}] ${name}${detail ? " — " + detail : ""}`);
}

// ---------- 1. 规范排法 ----------
const canonical: CamDesign = {
  order: ["a30", "r1", "a55", "r2", "a80", "r3"],
  flips: {},
  rollerDia: 10,
  fillet: 5,
};
const report = evaluateDesign(order, canonical);
console.log("\n== 规范排法（滚轮10 内圆角5）==");
console.log("problems:", report.problems);
console.log("warnings:", report.warnings);
console.log(
  "maxR:",
  report.profile.maxR.toFixed(2),
  "minR:",
  report.profile.minR.toFixed(2),
  "minInnerFillet:",
  report.profile.minInnerFillet,
);
for (const s of report.analysis.stops) {
  console.log(`  stop ${s.stopId} -> ${s.floorId}: dev=${s.dev.toFixed(3)}mm ok=${s.ok}`);
}
console.log("worstDev:", report.analysis.worstDev.toFixed(3), "@", report.analysis.worstAngle);
check("规范排法闭合", report.profile.closed);
check("规范排法合格", report.qualified, report.problems.join(";"));

// ---------- 2. 自动搜索 ----------
const t0 = Date.now();
const outcome = searchBestDesign(order);
console.log("\n== 自动搜索 ==");
console.log(
  `tested=${outcome.tested} chained=${outcome.chained} feasible=${outcome.feasible} 用时=${Date.now() - t0}ms`,
);
check("搜索找到合格排法", outcome.best !== null);
if (outcome.best) {
  const b = outcome.best;
  console.log("best order:", b.design.order.join(" -> "));
  console.log("best flips:", JSON.stringify(b.design.flips));
  console.log("best roller:", b.design.rollerDia, "fillet:", b.design.fillet);
  console.log("best worstDev:", b.analysis.worstDev.toFixed(3));
  check("最优排法在余量内", b.analysis.worstDev <= order.tolerance);
}

// ---------- 3. 大滚轮搭桥 ----------
const bigRoller: CamDesign = { ...canonical, rollerDia: 24 };
const bigReport = evaluateDesign(order, bigRoller);
console.log("\n== 大滚轮24（应搭桥超差）==");
console.log("worstDev:", bigReport.analysis.worstDev.toFixed(3), "problems:", bigReport.problems);
check("滚轮24 在一层窗口超差", !bigReport.qualified && bigReport.analysis.worstDev > order.tolerance);

// 谷底支撑高度抽样：滚轮越大，一层窗口内越早被两段爬升抬离
for (const dia of [10, 18, 24]) {
  const profile = buildProfile(order, { ...canonical, rollerDia: dia });
  const curve = simulateLift(profile.points, dia / 2);
  const samples = [15, 11, 9, 7, 23, 25].map((a) => `${a}°:${heightAt(curve, a).toFixed(2)}`);
  console.log(`滚轮${dia} 一层窗口附近厢高:`, samples.join("  "));
}

// ---------- 4. 通关演练 ----------
console.log("\n== 通关演练 ==");
const document: GameDocument = {
  version: 1,
  currentLevelId: "lift-01",
  level: hydrate(blueprint),
  attempt: { steps: 0, status: "playing" },
  records: {},
};
evaluateGadgets(document);

// 未实装时摇轮应被拒绝
const denied = crankLift(document, 1);
check("未实装不能摇轮", !denied.cranked);

// 实装最优设计
const best = outcome.best!;
document.level.lift!.design = best.design;
document.level.lift!.angle = 15;
check("实装后一层平层", berthState(document.level)?.floorId === "f1");

function move(dir: Dir) {
  const r = applyMove(document, dir);
  if (!r.moved)
    throw new Error(`移动被挡: ${dir} @ (${document.level.player.x},${document.level.player.y})`);
  evaluateGadgets(document);
  document.attempt.steps += 1;
}
function crankTo(angle: number) {
  let guard = 0;
  while (document.level.lift!.angle !== angle) {
    const before = document.level.lift!.angle;
    const diff = ((angle - before) % 360 + 360) % 360;
    const sign = diff <= 180 ? 1 : -1;
    const r = crankLift(document, sign as 1 | -1);
    if (!r.cranked) throw new Error("摇轮失败");
    evaluateGadgets(document);
    document.attempt.steps += 1;
    guard += 1;
    if (guard > 200) throw new Error("摇轮超限");
  }
}
function seq(dirs: Dir[]) {
  for (const d of dirs) move(d);
}

// 阶段一：A(5,6) 装厢 -> 三层 -> 推入 (1,2)
seq(["w", "w", "n"]); // 玩家 (8,7)->(6,6)
seq(["w", "w", "w"]); // 推 A 上厢 (2,6)，玩家随至 (3,6)
crankTo(245);
check("三层平层", berthState(document.level)?.floorId === "f3");
seq(["w"]); // A -> (1,2) 目标
check("A 命中三层目标", document.level.boxes.some((b) => b.x === 1 && b.y === 2));
crankTo(15);
check("回到一层平层", berthState(document.level)?.floorId === "f1");

// 阶段二：B(7,6) 装厢 -> 二层 -> 推入 (1,4)
seq(["e", "e", "e", "e", "s", "e", "e", "n"]); // (2,6)->(8,6)
seq(["w", "w", "w", "w", "w"]); // 推 B 上厢 (2,6)，玩家随至 (3,6)
crankTo(110);
check("二层平层", berthState(document.level)?.floorId === "f2");
seq(["w"]); // B -> (1,4) 目标
check("B 命中二层目标", document.level.boxes.some((b) => b.x === 1 && b.y === 4));

console.log("player:", document.level.player);
console.log(
  "boxes:",
  document.level.boxes.map((b) => `(${b.x},${b.y})`).join(" "),
);
console.log("steps:", document.attempt.steps);
check("全部目标命中", goalsSatisfied(document));

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
