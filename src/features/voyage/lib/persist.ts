import type { CamDesign, LevelRecord } from "@/shared/types";

export const STORAGE_KEY = "jdk-030.voyage.v1";

export interface VoyageSave {
  version: 1;
  currentLevelId: string;
  records: Record<string, LevelRecord>;
  cams?: Record<string, CamDesign>;
}

function readCams(raw: unknown): Record<string, CamDesign> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CamDesign> = {};
  for (const [id, cam] of Object.entries(raw as Record<string, unknown>)) {
    if (!cam || typeof cam !== "object") continue;
    const c = cam as Partial<CamDesign>;
    if (!Array.isArray(c.order) || !c.order.every((p) => typeof p === "string")) continue;
    if (typeof c.rollerDia !== "number" || typeof c.fillet !== "number") continue;
    out[id] = {
      order: [...c.order],
      flips: c.flips && typeof c.flips === "object" ? { ...c.flips } : {},
      rollerDia: c.rollerDia,
      fillet: c.fillet,
    };
  }
  return out;
}

export function readSave(): VoyageSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VoyageSave;
    if (parsed.version !== 1 || typeof parsed.currentLevelId !== "string") return null;
    if (!parsed.records || typeof parsed.records !== "object" || Array.isArray(parsed.records)) return null;
    const records = Object.fromEntries(Object.entries(parsed.records).filter(([, record]) =>
      record && Number.isSafeInteger(record.bestSteps) && record.bestSteps > 0 &&
      Number.isFinite(record.clearedAt) && Number.isFinite(new Date(record.clearedAt).getTime()),
    ));
    return { version: 1, currentLevelId: parsed.currentLevelId, records, cams: readCams(parsed.cams) };
  } catch {
    return null;
  }
}

export function writeSave(save: VoyageSave): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function betterRecord(
  current: LevelRecord | undefined,
  steps: number,
  at: number,
): LevelRecord {
  if (!current || steps < current.bestSteps) return { bestSteps: steps, clearedAt: at };
  return current;
}
