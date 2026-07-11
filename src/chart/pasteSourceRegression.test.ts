import { describe, expect, it } from "vitest";
import { createDefaultChartScale } from "./chartScale";
import { buildPcrChartOption } from "./chartConfig";
import { createPlottedDataCsv } from "./plottedDataExport";
import { parsePastedTable } from "../data/parsePastedTable";

describe("Quick Paste chart and export regression", () => {
  it("passes parsed paste points, null gaps, labels, and styles through the normal chart projection", () => {
    const parsed = parsePastedTable("Comparison\nAssay A\n0.1\nbad\n-2\n1e3", {
      mode: "fullTable",
      sourceName: "Paste chart source",
      sourceInstanceId: "paste-chart-regression"
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const curve = parsed.dataset.curves[0];
    const result = buildPcrChartOption({
      dataset: parsed.dataset,
      selectedCurveIds: new Set([curve.curveId]),
      orderedCurveIds: [curve.curveId],
      scale: createDefaultChartScale(),
      labelMode: "reagent",
      curveOverrides: {
        [curve.curveId]: {
          displayName: "Condition A",
          color: "#7030A0",
          lineType: "dashed",
          markerType: "triangle",
          source: "custom"
        }
      }
    });
    const option = result.option as Record<string, any>;

    expect(result.visibleCurves).toEqual([curve]);
    expect(result.legendItems).toEqual([
      expect.objectContaining({
        curveId: curve.curveId,
        label: "Condition A",
        color: "#7030A0",
        lineType: "dashed",
        markerType: "triangle"
      })
    ]);
    expect(option.series[0]).toMatchObject({
      id: curve.curveId,
      name: "Condition A",
      showSymbol: true,
      symbol: "triangle",
      connectNulls: false,
      lineStyle: { color: "#7030A0", type: "dashed" }
    });
    expect(option.series[0].data).toEqual([
      [1, 0.1],
      [2, null],
      [3, -2],
      [4, 1000]
    ]);
    expect(option.series[0].smooth).toBeUndefined();
    expect(option.series[0].sampling).toBeUndefined();
  });

  it("exports a rectangular plotted CSV with paste null values left blank", () => {
    const parsed = parsePastedTable("Specimen X\tSpecimen X\nA1\tA2\n0.1\t0.2\n\t1.2", {
      mode: "fullTable",
      sourceName: "Paste CSV source",
      sourceInstanceId: "paste-csv-regression"
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const csv = createPlottedDataCsv({
      curves: parsed.dataset.curves,
      labelMode: "reagent",
      curveOverrides: {
        [parsed.dataset.curves[0].curveId]: { displayName: "Baseline", source: "custom" }
      }
    });

    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(csv.csv).toBe("Cycle,Baseline,A2 │ Specimen X\r\n1,0.1,0.2\r\n2,,1.2");
  });
});
