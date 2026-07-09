import { describe, expect, it } from "vitest";
import { createSyntheticPcrDataset } from "./sampleData";
import { formatCurveLabel } from "./curveLabels";

describe("curve labels", () => {
  it("uses a vertical separator so slash characters inside labels remain distinguishable", () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["7/8_old"],
      reagentLabels: ["RSV A_15"]
    });
    const curve = dataset.curves[0];

    expect(formatCurveLabel(curve, "reagent")).toBe("RSV A_15 │ 7/8_old");
    expect(formatCurveLabel(curve, "specimen")).toBe("7/8_old │ RSV A_15");
    expect(curve.displayLabel).toBe("7/8_old │ RSV A_15");
  });
});
