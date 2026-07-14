import { describe, expect, it } from "vitest";
import { calculateThresholdResult } from "../analysis/threshold";
import { createStats, createSyntheticPcrDataset } from "../data/sampleData";
import type { Curve } from "../data/types";
import { createThresholdResultsExcelClipboardPayload } from "./thresholdClipboard";

describe("Threshold Excel clipboard payload", () => {
  it("creates four Excel cells per visible result with numeric estimates and blank unavailable values", () => {
    const baseCurves = createSyntheticPcrDataset({
      specimenLabels: ["=Synthetic specimen", "Synthetic specimen 2"],
      reagentLabels: ["Synthetic assay"],
      cycleCount: 4
    }).curves;
    const crossedCurve: Curve = {
      ...baseCurves[0],
      y: [1, 6, 1, 7],
      stats: createStats([1, 6, 1, 7])
    };
    const notReachedCurve: Curve = {
      ...baseCurves[1],
      y: [1, 2, 3, 4],
      stats: createStats([1, 2, 3, 4])
    };
    const crossed = calculateThresholdResult(crossedCurve, 5);
    const notReached = calculateThresholdResult(notReachedCurve, 5);

    const payload = createThresholdResultsExcelClipboardPayload({
      curves: [crossedCurve, notReachedCurve],
      results: [crossed, notReached]
    });

    expect(payload.text.split("\r\n")).toEqual([
      "검체\t시약\t추정 교차 Cycle\t결과 상태",
      "\u200B=Synthetic specimen\tSynthetic assay\t1.8\t교차 (다중 교차 검토)",
      "Synthetic specimen 2\tSynthetic assay\t\t미도달"
    ]);
    expect(payload.html).toContain("Malgun Gothic");
    expect(payload.html).toContain("font-size:9pt");
    expect(payload.html).toContain("&#8203;=Synthetic specimen");
    expect(payload.html).toContain(">1.8</td>");
    expect(payload.html).toContain("교차 (다중 교차 검토)");
  });

  it("rejects a result whose curve identity is unavailable instead of silently omitting it", () => {
    const curve = createSyntheticPcrDataset({ cycleCount: 4 }).curves[0];
    const result = calculateThresholdResult({ ...curve, y: [1, 2, 3, 6], stats: createStats([1, 2, 3, 6]) }, 5);

    expect(() => createThresholdResultsExcelClipboardPayload({ curves: [], results: [result] })).toThrow(
      /Threshold result curve is missing/u
    );
  });
});
