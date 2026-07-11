import { describe, expect, it } from "vitest";
import { createSyntheticPcrDataset } from "../data/sampleData";
import { createDefaultChartScale } from "./chartScale";
import { createDefaultStyleRules } from "./chartStyle";
import { buildChartProjection } from "./chartProjection";
import { layoutLegendItems } from "./legendLayout";

describe("chart legend projection identity", () => {
  it("retains curveId/source evidence when duplicate names and source suffixes still collide", () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Synthetic Same", "Synthetic Same"],
      reagentLabels: ["Assay 1"],
      fileName: "synthetic-collision.xlsx"
    });
    const firstSource = dataset.curves[0].source;
    dataset.curves[1].source = { ...firstSource };
    const selectedCurveIds = new Set(dataset.curves.map((curve) => curve.curveId));

    const projection = buildChartProjection({
      dataset,
      selectedCurveIds,
      scale: createDefaultChartScale(),
      styleRules: createDefaultStyleRules()
    });
    const layout = layoutLegendItems({
      items: projection.legendItems,
      maxTextWidth: 500,
      font: "12px Arial",
      measureText: (text) => text.length
    });

    expect(projection.legendItems[0].label).toBe(projection.legendItems[1].label);
    expect(layout.collisions).toHaveLength(1);
    expect(layout.collisions[0].curveIds).toEqual(dataset.curves.map((curve) => curve.curveId));
    expect(layout.collisions[0].sourceIdentities.every((identity) => identity.includes("synthetic-collision.xlsx"))).toBe(true);
  });
});
