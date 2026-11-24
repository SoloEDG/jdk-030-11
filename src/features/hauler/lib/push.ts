import { boxAt } from "./occupancy";
import { isPassable } from "@/features/gadget";
import { isPlayerRiding } from "@/features/winch/lib/runtime";
import { addVec } from "@/shared/document";
import { DIR_VEC, type Dir, type GameDocument, type MoveResult } from "@/shared/types";

export function applyMove(document: GameDocument, dir: Dir): MoveResult {
  if (document.attempt.status === "cleared") return { moved: false, pushed: false, reason: "cleared" };
  if (isPlayerRiding(document.level)) {
    // 厢在层间：人随厢悬空，只能摇手轮
    return { moved: false, pushed: false, reason: "riding" };
  }
  const delta = DIR_VEC[dir];
  const next = addVec(document.level.player, delta);
  const box = boxAt(document, next);
  if (box) {
    const beyond = addVec(box, delta);
    if (!isPassable(document, beyond, { ignoreBoxId: box.id, ignorePlayer: true })) {
      return { moved: false, pushed: false, reason: "blocked" };
    }
    box.x = beyond.x;
    box.y = beyond.y;
    document.level.player = next;
    return { moved: true, pushed: true, boxId: box.id };
  }
  if (!isPassable(document, next)) return { moved: false, pushed: false, reason: "blocked" };
  document.level.player = next;
  return { moved: true, pushed: false };
}
