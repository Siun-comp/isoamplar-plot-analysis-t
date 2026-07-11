import type { SelectionSet } from "../data/types";

export type SelectionSetValidationResult =
  | { ok: true; name: string }
  | { ok: false; reason: string };

export function normalizeSelectionSetName(name: string) {
  return name.trim();
}

export function validateSelectionSetName(
  name: string,
  selectionSets: SelectionSet[],
  excludedSelectionSetId?: string
): SelectionSetValidationResult {
  const normalizedName = normalizeSelectionSetName(name);
  if (!normalizedName) return { ok: false, reason: "선택 세트 이름을 입력하십시오." };

  const normalizedKey = normalizedName.toLocaleLowerCase();
  const duplicate = selectionSets.some(
    (selectionSet) =>
      selectionSet.selectionSetId !== excludedSelectionSetId &&
      normalizeSelectionSetName(selectionSet.name).toLocaleLowerCase() === normalizedKey
  );
  if (duplicate) return { ok: false, reason: "같은 이름의 선택 세트가 이미 있습니다." };
  return { ok: true, name: normalizedName };
}

export function createSelectionSetId(selectionSets: SelectionSet[]) {
  const usedIds = new Set(selectionSets.map((selectionSet) => selectionSet.selectionSetId));
  let sequence = selectionSets.length + 1;
  let candidate = `selection-set-${sequence}`;
  while (usedIds.has(candidate)) {
    sequence += 1;
    candidate = `selection-set-${sequence}`;
  }
  return candidate;
}

export function createOrderedSelectionSetCurveIds(selectedCurveIds: Iterable<string>, orderedCurveIds: string[]) {
  const selected = new Set(selectedCurveIds);
  return orderedCurveIds.filter((curveId) => selected.has(curveId));
}

export function hasSameSelectionSetMembership(first: Iterable<string>, second: Iterable<string>) {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  if (firstSet.size !== secondSet.size) return false;
  for (const curveId of firstSet) {
    if (!secondSet.has(curveId)) return false;
  }
  return true;
}

export function validateSelectionSetCurveIds(curveIds: string[], datasetCurveIds: Set<string>) {
  if (curveIds.length === 0) return "선택한 곡선이 없어 선택 세트를 저장할 수 없습니다.";
  if (new Set(curveIds).size !== curveIds.length) return "선택 세트에 중복된 curveId가 있습니다.";
  if (curveIds.some((curveId) => !datasetCurveIds.has(curveId))) {
    return "선택 세트에 현재 데이터에 없는 curveId가 있습니다.";
  }
  return null;
}
