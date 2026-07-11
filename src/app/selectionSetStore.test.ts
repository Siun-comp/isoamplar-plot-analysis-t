import { beforeEach, describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset, createSyntheticPcrDataset } from "../data/sampleData";
import { useAppStore } from "./appStore";

describe("selection set store", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
  });

  it("creates and applies tab-local curve membership without changing global order", () => {
    const curveIds = useAppStore.getState().dataset?.orderedCurveIds ?? [];
    useAppStore.getState().setCurvesSelected([curveIds[0], curveIds[3], curveIds[4]], true);
    expect(useAppStore.getState().createSelectionSet("Group 1")).toMatchObject({ ok: true });

    useAppStore.getState().setCurvesSelected(curveIds, false);
    useAppStore.getState().setCurvesSelected([curveIds[1], curveIds[2], curveIds[6]], true);
    expect(useAppStore.getState().createSelectionSet("Group 2")).toMatchObject({ ok: true });

    const firstSet = useAppStore.getState().selectionSets[0];
    expect(useAppStore.getState().applySelectionSet(firstSet.selectionSetId)).toEqual({ ok: true });
    expect([...useAppStore.getState().selection!.selectedCurveIds]).toEqual(firstSet.curveIds);
    expect(useAppStore.getState().selection!.orderedCurveIds).toEqual(curveIds);
  });

  it("returns once to the pre-apply selection and active set", () => {
    const curveIds = useAppStore.getState().dataset?.orderedCurveIds ?? [];
    useAppStore.getState().setCurvesSelected([curveIds[0]], true);
    useAppStore.getState().createSelectionSet("A");
    const firstSetId = useAppStore.getState().activeSelectionSetId!;

    useAppStore.getState().setCurvesSelected(curveIds, false);
    useAppStore.getState().setCurvesSelected([curveIds[1]], true);
    useAppStore.getState().createSelectionSet("B");
    const secondSetId = useAppStore.getState().activeSelectionSetId!;

    useAppStore.getState().applySelectionSet(firstSetId);
    expect(useAppStore.getState().activeSelectionSetId).toBe(firstSetId);
    expect(useAppStore.getState().returnToPreviousSelection()).toEqual({ ok: true });
    expect(useAppStore.getState().activeSelectionSetId).toBe(secondSetId);
    expect(useAppStore.getState().selection?.selectedCurveIds).toEqual(new Set([curveIds[1]]));
    expect(useAppStore.getState().returnToPreviousSelection().ok).toBe(false);
  });

  it("clears stale return state after manual selection and preserves sets across append", () => {
    const state = useAppStore.getState();
    const curveIds = state.dataset?.orderedCurveIds ?? [];
    state.setCurvesSelected([curveIds[0]], true);
    state.createSelectionSet("A");
    state.setCurvesSelected([curveIds[1]], true);
    state.createSelectionSet("B");
    state.applySelectionSet(useAppStore.getState().selectionSets[0].selectionSetId);
    expect(useAppStore.getState().selectionSetUndo).not.toBeNull();
    useAppStore.getState().toggleCurve(curveIds[2]);
    expect(useAppStore.getState().selectionSetUndo).toBeNull();

    const target = useAppStore.getState();
    const appended = createSyntheticPcrDataset({ specimenLabels: ["S2"], reagentLabels: ["R9"] });
    const result = target.appendPastedDataset(
      appended,
      target.activeAnalysisId,
      target.runtimeInstanceId,
      target.revision
    );
    expect(result.ok).toBe(true);
    expect(useAppStore.getState().selectionSets.map((selectionSet) => selectionSet.name)).toEqual(["A", "B"]);
    expect(useAppStore.getState().selectionSets.every((selectionSet) => !selectionSet.curveIds.some((id) => id.includes("R9")))).toBe(true);
  });

  it("keeps current selection when deleting the active set and clears sets on replacement", () => {
    const curveId = useAppStore.getState().dataset!.orderedCurveIds[0];
    useAppStore.getState().setCurvesSelected([curveId], true);
    useAppStore.getState().createSelectionSet("Keep selection");
    const selectionSetId = useAppStore.getState().activeSelectionSetId!;
    useAppStore.getState().deleteSelectionSet(selectionSetId);
    expect(useAppStore.getState().selection?.selectedCurveIds).toEqual(new Set([curveId]));
    expect(useAppStore.getState().activeSelectionSetId).toBeNull();

    useAppStore.getState().createSelectionSet("Temporary");
    useAppStore.getState().loadDataset(createSyntheticPcrDataset({ specimenLabels: ["Replacement"], reagentLabels: ["R1"] }));
    expect(useAppStore.getState().selectionSets).toEqual([]);
  });
});
