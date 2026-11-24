import { KEY_DIR } from "@/shared/commands";
import type { Dir } from "@/shared/types";

export type KeyAction = Dir | "reset" | "crankUp" | "crankDown";

export function actionFromKey(event: KeyboardEvent): KeyAction | null {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select")) {
    return null;
  }
  if (event.key === "r" || event.key === "R") return "reset";
  if (event.key === "q" || event.key === "Q") return "crankDown";
  if (event.key === "e" || event.key === "E") return "crankUp";
  return KEY_DIR[event.key] ?? null;
}

export function shouldCapture(event: KeyboardEvent): boolean {
  return actionFromKey(event) !== null;
}
