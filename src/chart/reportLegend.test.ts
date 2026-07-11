import { describe, expect, it } from "vitest";
import { buildReportLegendProjection } from "./reportLegend";
import { createOneSpecimenEightReagentDataset, createSyntheticPcrDataset } from "../data/sampleData";
import type { LegendItem } from "./chartProjection";

function createLegendItems(curveIds: string[], labels: string[]): LegendItem[] {
  return curveIds.map((curveId, index) => ({
    curveId,
    label: labels[index],
    color: "#0b6fa4",
    lineType: "solid",
    markerType: "none",
    lineWidth: 2.25
  }));
}

describe("report legend projection", () => {
  it("compacts a single-specimen legend to reagent row names", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = dataset.curves.slice(0, 2);
    const projection = buildReportLegendProjection({
      curves,
      legendItems: createLegendItems(
        curves.map((curve) => curve.curveId),
        ["A1 | Specimen 1", "A2 | Specimen 1"]
      ),
      labelMode: "reagent",
      legendSettings: { previewVisible: true, reportLabelMode: "autoCompact", reportNameOverrides: {} }
    });

    expect(projection.compactedBy).toBe("specimen");
    expect(projection.title).toContain(curves[0].specimenLabel);
    expect(projection.items.map((item) => item.label)).toEqual([curves[0].reagentLabel, curves[1].reagentLabel]);
  });

  it("compacts a single-reagent legend to specimen row names", () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["S1", "S2"],
      reagentLabels: ["A1"]
    });
    const curves = dataset.curves;
    const projection = buildReportLegendProjection({
      curves,
      legendItems: createLegendItems(
        curves.map((curve) => curve.curveId),
        ["A1 | S1", "A1 | S2"]
      ),
      labelMode: "reagent",
      legendSettings: { previewVisible: true, reportLabelMode: "autoCompact", reportNameOverrides: {} }
    });

    expect(projection.compactedBy).toBe("reagent");
    expect(projection.title).toContain("A1");
    expect(projection.items.map((item) => item.label)).toEqual(["S1", "S2"]);
  });

  it("uses analysis labels without compacting them away", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const sourceItem = createLegendItems([curve.curveId], ["Analysis A1"])[0];
    const projection = buildReportLegendProjection({
      curves: [curve],
      legendItems: [sourceItem],
      labelMode: "reagent",
      legendSettings: {
        previewVisible: true,
        reportLabelMode: "autoCompact",
        reportNameOverrides: {}
      },
      curveOverrides: { [curve.curveId]: { displayName: "Analysis A1" } }
    });

    expect(projection.items[0].label).toBe("Analysis A1");
  });

  it("keeps user order and resolved style attached to the same curveId", () => {
    const dataset = createSyntheticPcrDataset({ specimenLabels: ["S1", "S2"], reagentLabels: ["A1", "A2"] });
    const curves = [dataset.curves[3], dataset.curves[0]];
    const legendItems: LegendItem[] = [
      {
        ...createLegendItems([curves[0].curveId], ["Condition B"])[0],
        color: "#7030a0",
        lineType: "dashed",
        markerType: "circle"
      },
      {
        ...createLegendItems([curves[1].curveId], ["Condition A"])[0],
        color: "#0926fb",
        lineType: "dotted",
        markerType: "rect"
      }
    ];
    const projection = buildReportLegendProjection({
      curves,
      legendItems,
      labelMode: "reagent",
      legendSettings: { previewVisible: true, reportLabelMode: "full", reportNameOverrides: {} }
    });

    expect(projection.items.map(({ curveId, color, lineType, markerType }) => ({ curveId, color, lineType, markerType }))).toEqual([
      { curveId: curves[0].curveId, color: "#7030a0", lineType: "dashed", markerType: "circle" },
      { curveId: curves[1].curveId, color: "#0926fb", lineType: "dotted", markerType: "rect" }
    ]);
  });
});
