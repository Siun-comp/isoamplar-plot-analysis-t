import { beforeEach, describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { buildPcrChartOption } from "../chart/chartConfig";
import { useAppStore } from "./appStore";

describe("app store style preset and legend order", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("applies a preset by overwriting selected curve overrides and supports one-step undo", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurveOverride(firstCurveId, { color: "#111111", lineType: "dotted" });
    useAppStore.getState().applyStylePreset("reagentColorSolid", [firstCurveId]);

    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#0b6fa4",
      lineType: "solid",
      markerType: "none"
    });
    expect(useAppStore.getState().lastPresetMessage).toBe("1 curves updated by preset.");

    useAppStore.getState().undoLastPreset();
    expect(useAppStore.getState().curveOverrides[firstCurveId]).toMatchObject({
      color: "#111111",
      lineType: "dotted"
    });
    expect(useAppStore.getState().lastPresetUndo).toBeNull();
  });

  it("uses full dataset order when presetting a later reagent curve", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().applyStylePreset("reagentColorSolid", [secondCurveId]);

    expect(useAppStore.getState().curveOverrides[secondCurveId]).toMatchObject({
      color: "#d97706",
      lineType: "solid",
      markerType: "none"
    });
  });

  it("stores editable P1 scale presets for the current analysis session", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setAxisPresetValue("y", "preset1", "label", "P1 narrow");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "min", "0");
    useAppStore.getState().setAxisPresetValue("y", "preset1", "max", "100");
    useAppStore.getState().setAxisScaleMode("y", "preset1");
    useAppStore.getState().setCurvesSelected([firstCurveId], true);

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });
    const option = result.option as Record<string, any>;

    expect(option.yAxis.min).toBe(0);
    expect(option.yAxis.max).toBe(100);

    useAppStore.getState().setCurvesSelected([firstCurveId], false);
    expect(useAppStore.getState().chartScale.y.mode).toBe("preset1");

    useAppStore.getState().loadDataset(dataset);
    expect(useAppStore.getState().chartScale.y.preset1?.min).toBe("");
  });

  it("uses current user order as chart series order", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const firstCurveId = dataset.curves[0].curveId;
    const secondCurveId = dataset.curves[1].curveId;

    useAppStore.getState().loadDataset(dataset);
    useAppStore.getState().setCurvesSelected([firstCurveId, secondCurveId], true);
    useAppStore.getState().moveCurveOrder(secondCurveId, "up");

    const state = useAppStore.getState();
    const result = buildPcrChartOption({
      dataset,
      selectedCurveIds: state.selection?.selectedCurveIds ?? new Set<string>(),
      orderedCurveIds: state.selection?.orderedCurveIds,
      scale: state.chartScale,
      styleRules: state.styleRules,
      curveOverrides: state.curveOverrides
    });
    const option = result.option as Record<string, any>;

    expect(result.visibleCurves.map((curve) => curve.curveId)).toEqual([secondCurveId, firstCurveId]);
    expect(option.series.map((series: any) => series.id)).toEqual([secondCurveId, firstCurveId]);
  });
});
