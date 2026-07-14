import { describe, expect, it } from "vitest";
import type { Curve, PcrWarning } from "../data/types";
import {
  THRESHOLD_RULE_ID,
  calculateThresholdResult,
  calculateThresholdResults,
  createDefaultThresholdSettings,
  isThresholdDraftApplied,
  parseThresholdInput,
  thresholdResultRequiresReview
} from "./threshold";

function createCurve(y: Array<number | null>, options: { x?: number[]; warnings?: PcrWarning[]; id?: string } = {}): Curve {
  const finite = y.filter((value): value is number => value !== null);
  return {
    curveId: options.id ?? "curve-1",
    sourceId: "source-1",
    specimenId: "specimen-1",
    reagentId: "reagent-1",
    specimenLabel: "Synthetic specimen",
    reagentLabel: "Synthetic reagent",
    displayLabel: "Synthetic specimen │ Synthetic reagent",
    x: options.x ?? y.map((_, index) => index + 1),
    y,
    source: {
      sourceKind: "excel",
      sourceInstanceId: "source-instance-1",
      fileName: "synthetic.xlsx",
      sheetName: "Sheet1",
      sheetIndex: 0,
      columnIndex: 2,
      columnLetter: "C",
      specimenCell: "C1",
      reagentCell: "C2",
      dataStartCell: "C3",
      dataEndCell: `C${y.length + 2}`
    },
    stats: {
      pointCount: y.length,
      missingCount: y.length - finite.length,
      minY: finite.length ? Math.min(...finite) : null,
      maxY: finite.length ? Math.max(...finite) : null
    },
    warnings: options.warnings ?? []
  };
}

describe("Threshold input", () => {
  it("accepts decimal and exponent notation while rejecting Number coercion extras", () => {
    expect(parseThresholdInput(" -1.25e+3 ")).toEqual({ ok: true, value: -1250 });
    expect(parseThresholdInput(".5")).toEqual({ ok: true, value: 0.5 });
    expect(parseThresholdInput("0x10")).toEqual({ ok: false, reason: "invalid-format" });
    expect(parseThresholdInput("0b10")).toEqual({ ok: false, reason: "invalid-format" });
    expect(parseThresholdInput("1,000")).toEqual({ ok: false, reason: "invalid-format" });
    expect(parseThresholdInput("1e999")).toEqual({ ok: false, reason: "non-finite" });
    expect(parseThresholdInput(" ")).toEqual({ ok: false, reason: "empty" });
  });

  it("creates disabled defaults and compares draft/applied numerically", () => {
    expect(createDefaultThresholdSettings()).toEqual({
      enabled: false,
      draftValue: "",
      applied: null,
      showInPreview: true,
      includeInPlotExport: true
    });
    expect(
      isThresholdDraftApplied({
        ...createDefaultThresholdSettings(),
        draftValue: "1e3",
        applied: { value: 1000, ruleId: THRESHOLD_RULE_ID }
      })
    ).toBe(true);
    expect(
      isThresholdDraftApplied({
        ...createDefaultThresholdSettings(),
        draftValue: "-0",
        applied: { value: 0, ruleId: THRESHOLD_RULE_ID }
      })
    ).toBe(true);
  });
});

describe("raw-first-upward-linear-v1", () => {
  it("calculates an exact and fractional adjacent crossing without changing raw data", () => {
    const curve = createCurve([0, 5, 10]);
    const original = structuredClone(curve);
    const exact = calculateThresholdResult(curve, 5);
    const fractional = calculateThresholdResult(curve, 7.5);

    expect(exact.outcome).toBe("crossed");
    expect(exact.primaryEvent?.interpolatedCycle).toBe(2);
    expect(exact.firstObservedAtOrAbovePoint).toMatchObject({ index: 1, x: 2, y: 5 });
    expect(fractional.primaryEvent?.interpolatedCycle).toBe(2.5);
    expect(curve).toEqual(original);
  });

  it("keeps negative, scientific, and large finite values at full number precision", () => {
    expect(calculateThresholdResult(createCurve([-1e6, 0, 1e6]), -5e5).primaryEvent?.interpolatedCycle).toBe(1.5);
    expect(calculateThresholdResult(createCurve([1e300, 1.5e300]), 1.25e300).primaryEvent?.interpolatedCycle).toBe(1.5);
    expect(calculateThresholdResult(createCurve([-Number.MAX_VALUE, Number.MAX_VALUE]), 0).primaryEvent?.interpolatedCycle).toBe(1.5);
  });

  it("distinguishes starts-at, starts-above, leading gap, and insufficient input", () => {
    expect(calculateThresholdResult(createCurve([5]), 5).outcome).toBe("starts-at-threshold");
    expect(calculateThresholdResult(createCurve([6, 1, 7]), 5).outcome).toBe("starts-above-threshold");
    const leading = calculateThresholdResult(createCurve([null, null, 5, 6]), 5);
    expect(leading.outcome).toBe("indeterminate-leading-gap");
    expect(leading.primaryEvent).toBeNull();
    expect(leading.events[0]).toMatchObject({ eventType: "indeterminate-leading-gap", relation: "primary" });
    expect(calculateThresholdResult(createCurve([]), 5).outcome).toBe("insufficient-data");
    expect(calculateThresholdResult(createCurve([1]), 5).outcome).toBe("insufficient-data");
    expect(calculateThresholdResult(createCurve([null, 1]), 5).outcome).toBe("insufficient-data");
  });

  it("gives chronological priority to a potential gap and keeps later crossings", () => {
    const result = calculateThresholdResult(createCurve([1, null, 6, 1, 7]), 5);
    expect(result.outcome).toBe("indeterminate-gap");
    expect(result.primaryEvent).toBeNull();
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "indeterminate-gap", relation: "primary" }),
        expect.objectContaining({ eventType: "crossing", relation: "subsequent" })
      ])
    );
    expect(result.candidateCount).toBe(1);
  });

  it("retains every gap as evidence without turning below-gap-below or trailing gaps into crossing outcomes", () => {
    const result = calculateThresholdResult(createCurve([1, null, 2, null]), 5);
    expect(result.outcome).toBe("not-reached");
    expect(result.hasMissingData).toBe(true);
    expect(result.gapEventCount).toBe(2);
    expect(result.events.every((event) => event.eventType === "missing-data")).toBe(true);
  });

  it("retains multiple upward events and plateau/downward semantics", () => {
    const multiple = calculateThresholdResult(createCurve([1, 6, 2, 7, 7]), 5);
    expect(multiple.outcome).toBe("crossed");
    expect(multiple.candidateCount).toBe(2);
    expect(multiple.multipleUpwardCrossings).toBe(true);
    expect(multiple.events.filter((event) => event.eventType === "crossing")).toHaveLength(2);
    expect(calculateThresholdResult(createCurve([6, 5, 4]), 5).outcome).toBe("starts-above-threshold");
    expect(calculateThresholdResult(createCurve([1, 4, 4]), 5).outcome).toBe("not-reached");
  });

  it("flags ambiguous outcomes and multiple crossings for review", () => {
    expect(thresholdResultRequiresReview(calculateThresholdResult(createCurve([1, 6, 2, 7]), 5))).toBe(true);
    expect(thresholdResultRequiresReview(calculateThresholdResult(createCurve([1, 6, 7]), 5))).toBe(false);
    expect(thresholdResultRequiresReview(calculateThresholdResult(createCurve([1, 2, 3]), 5))).toBe(false);
    expect(thresholdResultRequiresReview(calculateThresholdResult(createCurve([6, 1, 7]), 5))).toBe(true);
    expect(thresholdResultRequiresReview(calculateThresholdResult(createCurve([1, null, 7]), 5))).toBe(true);
  });

  it("attaches exact source and formula-cache evidence to bracket points", () => {
    const warning: PcrWarning = {
      code: "FORMULA_CACHED_VALUE_USED",
      severity: "warning",
      scope: "cell",
      message: "Synthetic cached formula",
      curveIds: ["curve-1"],
      sourceRefs: [
        {
          sourceInstanceId: "source-instance-1",
          sourceName: "synthetic.xlsx",
          sourceKind: "excel",
          worksheet: "Sheet1",
          cell: "C4",
          columnLetter: "C",
          formulaCacheStatus: "used"
        }
      ]
    };
    const event = calculateThresholdResult(createCurve([1, 6], { warnings: [warning] }), 5).events[0];
    expect(event.formulaCacheEvidence).toBe(true);
    expect(event.sourceReferences).toEqual([
      expect.objectContaining({ sourceInstanceId: "source-instance-1", cell: "C3", index: 0, y: 1 }),
      expect.objectContaining({ sourceInstanceId: "source-instance-1", cell: "C4", index: 1, y: 6, formulaCacheStatus: "used" })
    ]);
  });

  it("keeps a valid crossing when the interpolation result is non-finite", () => {
    const result = calculateThresholdResult(
      createCurve([0, 1], { x: [-Number.MAX_VALUE, Number.MAX_VALUE] }),
      0.5
    );
    expect(result.outcome).toBe("crossed");
    expect(result.primaryEvent).toMatchObject({ interpolatedCycle: null, interpolationStatus: "non-finite" });
  });

  it("rejects mismatched, non-finite, and non-increasing arrays", () => {
    expect(() => calculateThresholdResult(createCurve([1, 2], { x: [1] }), 1.5)).toThrow("lengths must match");
    expect(() => calculateThresholdResult(createCurve([1, 2], { x: [1, 1] }), 1.5)).toThrow("strictly increasing");
    expect(() => calculateThresholdResult(createCurve([1, Number.NaN]), 1.5)).toThrow("finite or null");
    expect(() => calculateThresholdResult(createCurve([1, 2]), Number.POSITIVE_INFINITY)).toThrow("finite number");
    expect(() => calculateThresholdResults([], Number.NaN)).toThrow("finite number");
  });

  it("handles a 100 by 100 calculation iteratively", () => {
    const curves = Array.from({ length: 100 }, (_, curveIndex) =>
      createCurve(
        Array.from({ length: 100 }, (_, pointIndex) => pointIndex + curveIndex / 100),
        { id: `curve-${curveIndex}` }
      )
    );
    const results = calculateThresholdResults(curves, 50);
    expect(results).toHaveLength(100);
    expect(results.every((result) => result.outcome === "crossed")).toBe(true);
  });
});
