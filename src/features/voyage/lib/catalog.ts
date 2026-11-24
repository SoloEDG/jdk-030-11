import { createId } from "@/shared/document";
import type {
  BoxKind,
  FloorMorph,
  LiftOrder,
  RuntimeLevel,
  TileKind,
} from "@/shared/types";

export interface LevelBlueprint {
  id: string;
  title: string;
  blurb: string;
  rows: string[];
  player: { x: number; y: number };
  boxes: { kind: BoxKind; x: number; y: number }[];
  plates: {
    accept: BoxKind;
    x: number;
    y: number;
    doorIds: string[];
    floorIds: string[];
  }[];
  doors: { id: string; x: number; y: number }[];
  floors: { id: string; x: number; y: number; morph: FloorMorph }[];
  lift?: LiftOrder;
}

function tilesOf(rows: string[]): TileKind[][] {
  return rows.map((row) =>
    [...row].map((ch) => {
      if (ch === "#") return "wall";
      if (ch === "*") return "goal";
      if (ch === "~") return "gap";
      return "floor";
    }),
  );
}

export const LEVELS: LevelBlueprint[] = [
  {
    id: "latch-01",
    title: "门闩入门",
    blurb: "木箱压上木踏板才会开门。多出来的箱子用来压住开关。",
    rows: [
      "#########",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "###...###",
      "#......*#",
      "#......*#",
      "#########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 3, y: 3 },
      { kind: "timber", x: 4, y: 3 },
      { kind: "timber", x: 3, y: 7 },
    ],
    plates: [{ accept: "timber", x: 3, y: 4, doorIds: ["d1"], floorIds: [] }],
    doors: [{ id: "d1", x: 4, y: 5 }],
    floors: [],
  },
  {
    id: "latch-02",
    title: "认材",
    blurb: "铁踏板只认铁箱。木箱压上去门不会动。",
    rows: [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "####...###",
      "#.......*#",
      "#.......*#",
      "##########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 5, y: 4 },
      { kind: "iron", x: 6, y: 3 },
      { kind: "timber", x: 3, y: 7 },
    ],
    plates: [{ accept: "iron", x: 6, y: 4, doorIds: ["d1"], floorIds: [] }],
    doors: [{ id: "d1", x: 5, y: 5 }],
    floors: [],
  },
  {
    id: "latch-03",
    title: "架桥",
    blurb: "木踏板升起缺口上的桥板。铁箱过桥后，木箱去压本侧目标。",
    rows: [
      "###########",
      "#........*#",
      "#.........#",
      "#.........#",
      "#~~~~~~~~~#",
      "#.........#",
      "#........*#",
      "#.........#",
      "###########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 3, y: 2 },
      { kind: "iron", x: 4, y: 3 },
    ],
    plates: [{ accept: "timber", x: 3, y: 3, doorIds: [], floorIds: ["b1", "b2", "b3"] }],
    doors: [],
    floors: [
      { id: "b1", x: 3, y: 4, morph: "bridge" },
      { id: "b2", x: 4, y: 4, morph: "bridge" },
      { id: "b3", x: 5, y: 4, morph: "bridge" },
    ],
  },
  {
    id: "latch-04",
    title: "封廊",
    blurb: "先把一只木箱送进左侧目标，再压踏板。踏板会封住那条廊并打开右侧的门。",
    rows: [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "##.##..###",
      "#*......*#",
      "#........#",
      "##########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 2, y: 6 },
      { kind: "timber", x: 4, y: 2 },
      { kind: "timber", x: 6, y: 4 },
    ],
    plates: [{ accept: "timber", x: 4, y: 3, doorIds: ["d1"], floorIds: ["s1"] }],
    doors: [{ id: "d1", x: 5, y: 5 }],
    floors: [{ id: "s1", x: 2, y: 5, morph: "seal" }],
  },
  {
    id: "latch-05",
    title: "双色闸",
    blurb: "玻璃踏板与木踏板各管一扇门。两只箱子都要过闸到达目标。",
    rows: [
      "###########",
      "#.........#",
      "#.........#",
      "#.........#",
      "##...#...##",
      "#.........#",
      "#*.......*#",
      "#.........#",
      "###########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 2, y: 2 },
      { kind: "glass", x: 8, y: 2 },
      { kind: "timber", x: 3, y: 3 },
      { kind: "glass", x: 7, y: 3 },
    ],
    plates: [
      { accept: "timber", x: 2, y: 3, doorIds: ["west"], floorIds: [] },
      { accept: "glass", x: 8, y: 3, doorIds: ["east"], floorIds: [] },
    ],
    doors: [
      { id: "west", x: 3, y: 4 },
      { id: "east", x: 7, y: 4 },
    ],
    floors: [],
  },
  {
    id: "lift-01",
    title: "货梯试车",
    blurb: "先在凸轮工单里拼出合格凸轮盘并实装，再摇 Q/E 手轮换层。只有真正平齐时才能跨出。",
    rows: [
      "###########",
      "##~~~######",
      "#*~~~######",
      "##~~~######",
      "#*~~~######",
      "##~~~######",
      "##~~~.....#",
      "##~~~.....#",
      "###########",
    ],
    player: { x: 8, y: 7 },
    boxes: [
      { kind: "timber", x: 5, y: 6 },
      { kind: "timber", x: 7, y: 6 },
      { kind: "timber", x: 9, y: 6 },
    ],
    plates: [],
    doors: [],
    floors: [],
    lift: {
      shaftCols: [2, 3, 4],
      floors: [
        { id: "f1", label: "一层", height: 30, row: 6 },
        { id: "f2", label: "二层", height: 55, row: 4 },
        { id: "f3", label: "三层", height: 80, row: 2 },
      ],
      stops: [
        { id: "s1", angle: 15, floorId: "f1" },
        { id: "s2", angle: 110, floorId: "f2" },
        { id: "s3", angle: 245, floorId: "f3" },
      ],
      windowDeg: 8,
      tolerance: 1.5,
      sleeveRadius: 92,
      boreRadius: 15,
      rollerOptions: [10, 14, 18, 24],
      filletMin: 3,
      filletOptions: [2, 3, 5, 8],
      pieces: [
        { id: "a30", kind: "arc", span: 24, r0: 30, r1: 30 },
        { id: "a55", kind: "arc", span: 75, r0: 55, r1: 55 },
        { id: "a80", kind: "arc", span: 91, r0: 80, r1: 80 },
        { id: "r1", kind: "ramp", span: 50, r0: 30, r1: 55 },
        { id: "r2", kind: "ramp", span: 50, r0: 55, r1: 80 },
        { id: "r3", kind: "ramp", span: 70, r0: 80, r1: 30 },
      ],
      crankStepDeg: 5,
    },
  },
];

export function getLevel(id: string): LevelBlueprint {
  const found = LEVELS.find((level) => level.id === id);
  if (!found) throw new Error(`未知关卡 ${id}`);
  return found;
}

export function hydrate(blueprint: LevelBlueprint): RuntimeLevel {
  return {
    id: blueprint.id,
    title: blueprint.title,
    blurb: blueprint.blurb,
    width: blueprint.rows[0].length,
    height: blueprint.rows.length,
    tiles: tilesOf(blueprint.rows),
    player: { ...blueprint.player },
    boxes: blueprint.boxes.map((box) => ({ ...box, id: createId(box.kind) })),
    plates: blueprint.plates.map((plate, index) => ({
      ...plate,
      id: `p-${blueprint.id}-${index}`,
      powered: false,
    })),
    doors: blueprint.doors.map((door) => ({ ...door, open: false })),
    floors: blueprint.floors.map((floor) => ({ ...floor, active: false })),
    lift: blueprint.lift
      ? {
          order: blueprint.lift,
          design: null,
          angle: blueprint.lift.stops[0]?.angle ?? 0,
          riding: { player: false, boxIds: [] },
        }
      : null,
  };
}
