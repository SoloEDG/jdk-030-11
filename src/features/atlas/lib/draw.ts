import { tileCenter } from "./grid";
import { berthState, carRowFloat, isBoxRiding, isPlayerRiding } from "@/features/winch/lib/runtime";
import type { Box, Door, FloorPatch, GameDocument, Plate, RuntimeLevel } from "@/shared/types";

export const TILE = 46;

const ink = "#1c1610";
const plank = "#3a2a1c";
const brass = "#c9a36a";
const moss = "#7d9b6a";
const rust = "#b56a32";
const steel = "#8a93a0";
const glass = "#7ec8c8";
const pit = "#0b0907";

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  tile = TILE,
): CanvasRenderingContext2D {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = width * tile;
  const h = height * tile;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function paintStage(ctx: CanvasRenderingContext2D, document: GameDocument, tile = TILE): void {
  const { level } = document;
  ctx.clearRect(0, 0, level.width * tile, level.height * tile);
  ctx.fillStyle = pit;
  ctx.fillRect(0, 0, level.width * tile, level.height * tile);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      paintTile(ctx, x, y, level.tiles[y][x], tile);
    }
  }
  for (const floor of level.floors) paintFloor(ctx, floor, tile);
  if (level.lift) paintLift(ctx, level, tile);
  for (const plate of level.plates) paintPlate(ctx, plate, tile);
  for (const door of level.doors) paintDoor(ctx, door, tile);
  for (const box of level.boxes) {
    if (!isBoxRiding(level, box.id)) paintBox(ctx, box, tile);
  }
  const riding = isPlayerRiding(level);
  if (!riding) {
    paintPlayer(ctx, level.player.x, level.player.y, tile, document.attempt.status === "cleared");
  }
  if (level.lift) paintRiders(ctx, level, tile);
}

function paintLift(ctx: CanvasRenderingContext2D, level: RuntimeLevel, tile: number): void {
  const lift = level.lift;
  if (!lift) return;
  const { order } = lift;
  const x0 = order.shaftCols[0] * tile;
  const width = order.shaftCols.length * tile;
  // 井道导轨
  ctx.fillStyle = "rgba(201,163,106,0.07)";
  ctx.fillRect(x0 + 2, 0, width - 4, level.height * tile);
  ctx.strokeStyle = "rgba(201,163,106,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 3, 0);
  ctx.lineTo(x0 + 3, level.height * tile);
  ctx.moveTo(x0 + width - 3, 0);
  ctx.lineTo(x0 + width - 3, level.height * tile);
  ctx.stroke();
  // 各层门槛刻线与层标
  ctx.font = "10px ui-serif, Palatino, serif";
  ctx.textAlign = "right";
  for (const floor of order.floors) {
    const fy = floor.row * tile + tile / 2;
    ctx.strokeStyle = brass;
    ctx.beginPath();
    ctx.moveTo(x0 - 5, fy);
    ctx.lineTo(x0 + 5, fy);
    ctx.stroke();
    ctx.fillStyle = "rgba(232,215,184,0.75)";
    ctx.fillText(floor.label, x0 - 7, fy + 3);
  }
  // 厢板（按厢高插值的浮点行）
  const row = carRowFloat(level);
  const py = row * tile + tile * 0.18;
  const berthed = berthState(level);
  // 缆绳
  ctx.strokeStyle = "rgba(138,147,160,0.6)";
  ctx.beginPath();
  ctx.moveTo(x0 + width / 2, 0);
  ctx.lineTo(x0 + width / 2, py);
  ctx.stroke();
  // 厢体
  ctx.fillStyle = "#4a3b2a";
  ctx.fillRect(x0 + 4, py, width - 8, tile * 0.64);
  ctx.strokeStyle = berthed ? moss : brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 4, py, width - 8, tile * 0.64);
  ctx.fillStyle = berthed ? moss : brass;
  ctx.fillRect(x0 + 4, py + tile * 0.64 - 4, width - 8, 4);
  if (berthed) {
    ctx.fillStyle = ink;
    ctx.font = "11px ui-serif, Palatino, serif";
    ctx.textAlign = "center";
    ctx.fillText("平", x0 + width / 2, py + tile * 0.64 - 8);
  }
}

function paintRiders(ctx: CanvasRenderingContext2D, level: RuntimeLevel, tile: number): void {
  const lift = level.lift;
  if (!lift) return;
  const row = carRowFloat(level);
  for (const box of level.boxes) {
    if (isBoxRiding(level, box.id)) paintBoxAt(ctx, box, row, tile);
  }
  if (isPlayerRiding(level)) {
    paintPlayerAt(ctx, level.player.x, row, tile);
  }
}

function paintBoxAt(ctx: CanvasRenderingContext2D, box: Box, row: number, tile: number): void {
  const px = box.x * tile + 8;
  const py = row * tile + 8;
  const fill = box.kind === "timber" ? rust : box.kind === "iron" ? steel : "rgba(126,200,200,0.55)";
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, tile - 16, tile - 16);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, tile - 16, tile - 16);
}

function paintPlayerAt(ctx: CanvasRenderingContext2D, x: number, row: number, tile: number): void {
  const cx = x * tile + tile / 2;
  const cy = row * tile + tile / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 3, 2, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 3, 2, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  tile: number,
): void {
  const px = x * tile;
  const py = y * tile;
  if (kind === "wall") {
    ctx.fillStyle = plank;
    ctx.fillRect(px, py, tile, tile);
    ctx.strokeStyle = "#2a1d14";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + 4, tile - 8, tile - 8);
    ctx.fillStyle = "rgba(201,163,106,0.18)";
    ctx.fillRect(px + 8, py + 10, tile - 16, 3);
    return;
  }
  if (kind === "gap") {
    ctx.fillStyle = pit;
    ctx.fillRect(px, py, tile, tile);
    ctx.strokeStyle = "rgba(201,163,106,0.2)";
    ctx.strokeRect(px + 6, py + 6, tile - 12, tile - 12);
    return;
  }
  ctx.fillStyle = kind === "goal" ? "#2c2618" : "#4a3b2a";
  ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
  if (kind === "goal") {
    ctx.strokeStyle = moss;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 10, py + 10, tile - 20, tile - 20);
    ctx.fillStyle = "rgba(125,155,106,0.35)";
    ctx.fillRect(px + 16, py + 16, tile - 32, tile - 32);
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, floor: FloorPatch, tile: number): void {
  const px = floor.x * tile;
  const py = floor.y * tile;
  if (floor.morph === "bridge") {
    ctx.fillStyle = floor.active ? "#6a5638" : "rgba(80,70,50,0.35)";
    ctx.fillRect(px + 8, py + 18, tile - 16, 16);
    ctx.strokeStyle = brass;
    ctx.strokeRect(px + 8, py + 18, tile - 16, 16);
    return;
  }
  if (floor.active) {
    ctx.fillStyle = "rgba(90,40,30,0.72)";
    ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
  } else {
    ctx.strokeStyle = "rgba(181,106,50,0.7)";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 8, py + 8, tile - 16, tile - 16);
    ctx.setLineDash([]);
  }
}

function paintPlate(ctx: CanvasRenderingContext2D, plate: Plate, tile: number): void {
  const px = plate.x * tile + 9;
  const py = plate.y * tile + 9;
  const color = plate.accept === "timber" ? rust : plate.accept === "iron" ? steel : glass;
  ctx.fillStyle = plate.powered ? color : "#241c14";
  ctx.fillRect(px, py, tile - 18, tile - 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, tile - 18, tile - 18);
  ctx.fillStyle = plate.powered ? ink : color;
  ctx.font = "11px ui-serif, Palatino, serif";
  ctx.textAlign = "center";
  ctx.fillText(plate.accept === "timber" ? "木" : plate.accept === "iron" ? "铁" : "玻", px + (tile - 18) / 2, py + 22);
}

function paintDoor(ctx: CanvasRenderingContext2D, door: Door, tile: number): void {
  const px = door.x * tile;
  const py = door.y * tile;
  ctx.fillStyle = door.open ? "rgba(201,163,106,0.22)" : "#5b4630";
  ctx.fillRect(px + 14, py + 4, tile - 28, tile - 8);
  ctx.strokeStyle = brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 14, py + 4, tile - 28, tile - 8);
  if (!door.open) {
    ctx.beginPath();
    ctx.arc(px + tile / 2 + 6, py + tile / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = brass;
    ctx.fill();
  }
}

function paintBox(ctx: CanvasRenderingContext2D, box: Box, tile: number): void {
  const px = box.x * tile + 8;
  const py = box.y * tile + 8;
  const fill = box.kind === "timber" ? rust : box.kind === "iron" ? steel : "rgba(126,200,200,0.55)";
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, tile - 16, tile - 16);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, tile - 16, tile - 16);
  if (box.kind === "timber") {
    ctx.strokeStyle = "rgba(28,22,16,0.45)";
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 12);
    ctx.lineTo(px + tile - 20, py + 12);
    ctx.moveTo(px + 4, py + 24);
    ctx.lineTo(px + tile - 20, py + 24);
    ctx.stroke();
  }
  if (box.kind === "iron") {
    ctx.fillStyle = "#5c6570";
    ctx.fillRect(px + 6, py + 6, 6, 6);
    ctx.fillRect(px + tile - 34, py + tile - 34, 6, 6);
  }
}

function paintPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: number,
  cleared: boolean,
): void {
  const c = tileCenter(x, y, tile);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = cleared ? moss : brass;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x - 4, c.y - 3, 2, 0, Math.PI * 2);
  ctx.arc(c.x + 4, c.y - 3, 2, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
}
