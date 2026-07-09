import { describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { createPlottedDataCsv } from "./plottedDataExport";

describe("plotted data CSV export", () => {
  it("exports currently visible curves as a rectangular CSV with blanks for missing y", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = dataset.curves.slice(0, 2).map((curve) => ({ ...curve, y: [...curve.y] }));
    curves[1].y[1] = null;

    const result = createPlottedDataCsv({ curves });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.csv.split("\r\n");
    expect(lines[0]).toBe("Cycle,검체 1 │ A1,검체 1 │ A2");
    expect(lines[2].endsWith(",")).toBe(true);
  });

  it("rejects non-rectangular selected curves", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curves = [dataset.curves[0], { ...dataset.curves[1], x: dataset.curves[1].x.slice(0, -1) }];

    const result = createPlottedDataCsv({ curves });

    expect(result.ok).toBe(false);
  });

  it("uses reagent-first headers when label mode is reagent", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const result = createPlottedDataCsv({
      curves: dataset.curves.slice(0, 1),
      labelMode: "reagent"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toBe("Cycle,A1 │ 검체 1");
  });

  it("uses analysis labels as exported headers", () => {
    const dataset = createOneSpecimenEightReagentDataset();
    const curve = dataset.curves[0];
    const result = createPlottedDataCsv({
      curves: [curve],
      curveOverrides: {
        [curve.curveId]: { displayName: "Condition A" }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.csv.split("\r\n")[0]).toBe("Cycle,Condition A");
  });
});
