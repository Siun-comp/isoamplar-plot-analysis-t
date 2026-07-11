import { describe, expect, it } from "vitest";
import { appendPcrDataset } from "./mergeDatasets";
import { createSyntheticPcrDataset } from "./sampleData";

describe("PCR dataset append merge", () => {
  it("rekeys appended curves and keeps original curve ids stable", () => {
    const base = createSyntheticPcrDataset({
      fileName: "first.xlsx",
      specimenLabels: ["검체 1"],
      reagentLabels: ["A1", "A2"]
    });
    const incoming = createSyntheticPcrDataset({
      fileName: "second.xlsx",
      specimenLabels: ["검체 2"],
      reagentLabels: ["A1", "A2"]
    });

    const result = appendPcrDataset(base, incoming);

    expect(result.dataset.curves).toHaveLength(4);
    expect(result.dataset.orderedCurveIds.slice(0, 2)).toEqual(base.orderedCurveIds);
    expect(result.appendedCurveIds).toEqual(["file2_sheet0_col_A", "file2_sheet0_col_B"]);
    expect(new Set(result.dataset.orderedCurveIds).size).toBe(result.dataset.orderedCurveIds.length);
    expect(result.dataset.reagents).toHaveLength(2);
    expect(result.dataset.specimens).toHaveLength(2);
  });

  it("keeps repeated imports with identical file metadata traceable as separate source instances", () => {
    const base = createSyntheticPcrDataset({
      fileName: "repeated.xlsx",
      specimenLabels: ["Specimen 1"],
      reagentLabels: ["A1"]
    });
    const incoming = createSyntheticPcrDataset({
      fileName: "repeated.xlsx",
      specimenLabels: ["Specimen 1"],
      reagentLabels: ["A1"]
    });

    const result = appendPcrDataset(base, incoming);
    const [firstCurve, secondCurve] = result.dataset.curves;

    expect(firstCurve.source.sourceInstanceId).not.toBe(secondCurve.source.sourceInstanceId);
    expect(firstCurve.sourceId).not.toBe(secondCurve.sourceId);
  });
});
