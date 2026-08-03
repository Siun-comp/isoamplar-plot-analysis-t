export type SpecimenHeaderEntry = {
  columnIndex: number;
  label: string;
  canInherit: boolean;
  required?: boolean;
};

export type ResolvedSpecimenHeader = {
  columnIndex: number;
  label: string;
  inheritedFromColumnIndex?: number;
};

export type ResolveSpecimenHeadersResult =
  | { ok: true; headers: ResolvedSpecimenHeader[] }
  | { ok: false; missingColumnIndex: number };

export function resolveSpecimenHeaders(entries: readonly SpecimenHeaderEntry[]): ResolveSpecimenHeadersResult {
  if (entries.length === 0) return { ok: true, headers: [] };

  let currentLabel: string | null = null;
  let currentSourceColumnIndex: number | null = null;
  const headers: ResolvedSpecimenHeader[] = [];

  for (const entry of entries) {
    if (entry.label.trim()) {
      currentLabel = entry.label;
      currentSourceColumnIndex = entry.columnIndex;
      headers.push({ columnIndex: entry.columnIndex, label: entry.label });
      continue;
    }

    if (entry.canInherit && currentLabel !== null && currentSourceColumnIndex !== null) {
      headers.push({
        columnIndex: entry.columnIndex,
        label: currentLabel,
        inheritedFromColumnIndex: currentSourceColumnIndex
      });
      continue;
    }

    if (entry.required !== false && currentLabel === null) {
      return { ok: false, missingColumnIndex: entry.columnIndex };
    }

    headers.push({ columnIndex: entry.columnIndex, label: entry.label });
  }

  return { ok: true, headers };
}
