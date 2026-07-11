import { describe, expect, it } from "vitest";
import {
  createOrderedSelectionSetCurveIds,
  createSelectionSetId,
  hasSameSelectionSetMembership,
  validateSelectionSetCurveIds,
  validateSelectionSetName
} from "./selectionSets";

describe("selection sets", () => {
  it("normalizes names and rejects case-insensitive duplicates", () => {
    const sets = [{ selectionSetId: "selection-set-1", name: "Condition A", curveIds: ["a"] }];
    expect(validateSelectionSetName("  Condition B  ", sets)).toEqual({ ok: true, name: "Condition B" });
    expect(validateSelectionSetName("condition a", sets)).toEqual({
      ok: false,
      reason: "같은 이름의 선택 세트가 이미 있습니다."
    });
    expect(validateSelectionSetName("Condition A", sets, "selection-set-1")).toEqual({
      ok: true,
      name: "Condition A"
    });
  });

  it("creates stable IDs and projects membership through the current global order", () => {
    const sets = [
      { selectionSetId: "selection-set-2", name: "A", curveIds: ["a"] },
      { selectionSetId: "selection-set-3", name: "B", curveIds: ["b"] }
    ];
    expect(createSelectionSetId(sets)).toBe("selection-set-4");
    expect(createOrderedSelectionSetCurveIds(["c", "a"], ["a", "b", "c"])).toEqual(["a", "c"]);
  });

  it("compares membership without depending on order", () => {
    expect(hasSameSelectionSetMembership(["a", "b"], ["b", "a"])).toBe(true);
    expect(hasSameSelectionSetMembership(["a"], ["a", "b"])).toBe(false);
  });

  it("rejects empty, duplicate, and unknown curve references", () => {
    const datasetIds = new Set(["a", "b"]);
    expect(validateSelectionSetCurveIds([], datasetIds)).toContain("선택한 곡선");
    expect(validateSelectionSetCurveIds(["a", "a"], datasetIds)).toContain("중복");
    expect(validateSelectionSetCurveIds(["a", "c"], datasetIds)).toContain("없는 curveId");
    expect(validateSelectionSetCurveIds(["a", "b"], datasetIds)).toBeNull();
  });
});
