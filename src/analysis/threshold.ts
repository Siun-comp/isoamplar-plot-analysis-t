import type { Curve, FormulaCacheStatus, ImportedSourceKind } from "../data/types";

export const THRESHOLD_RULE_ID = "raw-first-upward-linear-v1" as const;

export type ThresholdRuleId = typeof THRESHOLD_RULE_ID;

export type AppliedThreshold = {
  value: number;
  ruleId: ThresholdRuleId;
};

export type ThresholdSettings = {
  enabled: boolean;
  draftValue: string;
  applied: AppliedThreshold | null;
  showInPreview: boolean;
  includeInPlotExport: boolean;
};

export type ThresholdOutcome =
  | "crossed"
  | "not-reached"
  | "starts-at-threshold"
  | "starts-above-threshold"
  | "indeterminate-leading-gap"
  | "indeterminate-gap"
  | "insufficient-data";

export type ThresholdSourceReference = {
  sourceInstanceId?: string;
  sourceKind?: ImportedSourceKind;
  sourceName: string;
  worksheet: string;
  columnLetter: string;
  cell: string;
  index: number;
  x: number;
  y: number | null;
  formulaCacheStatus: FormulaCacheStatus;
};

export type ThresholdEvidencePoint = {
  index: number;
  x: number;
  y: number;
  source: ThresholdSourceReference;
};

export type ThresholdEventType =
  | "crossing"
  | "indeterminate-leading-gap"
  | "indeterminate-gap"
  | "missing-data";

export type ThresholdEvent = {
  eventType: ThresholdEventType;
  relation: "primary" | "subsequent" | "evidence-only";
  eventIndex: number;
  leftPoint: ThresholdEvidencePoint | null;
  rightPoint: ThresholdEvidencePoint | null;
  missingStartIndex: number | null;
  missingEndIndex: number | null;
  interpolatedCycle: number | null;
  interpolationStatus: "finite" | "not-applicable" | "non-finite";
  formulaCacheEvidence: boolean;
  sourceReferences: ThresholdSourceReference[];
};

export type ThresholdIndeterminateGap = {
  kind: "leading-gap" | "internal-gap";
  leftPoint: ThresholdEvidencePoint | null;
  rightPoint: ThresholdEvidencePoint;
  missingStartIndex: number;
  missingEndIndex: number;
  formulaCacheEvidence: boolean;
  sourceReferences: ThresholdSourceReference[];
};

export type ThresholdResult = {
  curveId: string;
  threshold: number;
  ruleId: ThresholdRuleId;
  outcome: ThresholdOutcome;
  firstObservedAtOrAbovePoint: ThresholdEvidencePoint | null;
  primaryEvent: ThresholdEvent | null;
  candidateCount: number;
  gapEventCount: number;
  hasMissingData: boolean;
  multipleUpwardCrossings: boolean;
  events: ThresholdEvent[];
  firstIndeterminateGap: ThresholdIndeterminateGap | null;
};

export type ThresholdInputParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid-format" | "non-finite" };

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export function createDefaultThresholdSettings(): ThresholdSettings {
  return {
    enabled: false,
    draftValue: "",
    applied: null,
    showInPreview: true,
    includeInPlotExport: true
  };
}

export function parseThresholdInput(input: string): ThresholdInputParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (!DECIMAL_NUMBER_PATTERN.test(trimmed)) return { ok: false, reason: "invalid-format" };
  const value = Number(trimmed);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: "non-finite" };
}

export function isThresholdDraftApplied(settings: ThresholdSettings) {
  if (!settings.applied) return false;
  const parsed = parseThresholdInput(settings.draftValue);
  return parsed.ok && Object.is(normalizeNegativeZero(parsed.value), normalizeNegativeZero(settings.applied.value));
}

export function calculateThresholdResults(curves: Curve[], threshold: number) {
  if (!Number.isFinite(threshold)) throw new Error("Threshold must be a finite number.");
  return curves.map((curve) => calculateThresholdResult(curve, threshold));
}

export function thresholdResultRequiresReview(result: ThresholdResult) {
  return (
    result.multipleUpwardCrossings ||
    (result.outcome !== "crossed" && result.outcome !== "not-reached")
  );
}

export function calculateThresholdResult(curve: Curve, threshold: number): ThresholdResult {
  validateThresholdInput(curve, threshold);
  const context = createCalculationContext(curve);

  const firstObservedIndex = curve.y.findIndex((value) => value !== null && value >= threshold);
  const firstObservedAtOrAbovePoint =
    firstObservedIndex >= 0
      ? createEvidencePoint(curve, context, firstObservedIndex, curve.y[firstObservedIndex] as number)
      : null;
  const events = collectThresholdEvents(curve, context, threshold);
  const crossingEvents = events.filter((event) => event.eventType === "crossing");
  const gapEvents = events.filter((event) => event.eventType !== "crossing");
  const finiteIndices = curve.y.flatMap((value, index) => (value === null ? [] : [index]));
  const firstFiniteIndex = finiteIndices[0] ?? -1;
  const firstFiniteValue = firstFiniteIndex >= 0 ? (curve.y[firstFiniteIndex] as number) : null;
  const firstPotentialEvent = events.find((event) => isPotentialEvent(event));

  let outcome: ThresholdOutcome;
  if (finiteIndices.length === 0) {
    outcome = "insufficient-data";
  } else if (firstFiniteIndex === 0 && firstFiniteValue === threshold) {
    outcome = "starts-at-threshold";
  } else if (firstFiniteIndex === 0 && (firstFiniteValue as number) > threshold) {
    outcome = "starts-above-threshold";
  } else if (firstFiniteIndex > 0 && (firstFiniteValue as number) >= threshold) {
    outcome = "indeterminate-leading-gap";
  } else if (finiteIndices.length === 1) {
    outcome = "insufficient-data";
  } else if (firstPotentialEvent?.eventType === "crossing") {
    outcome = "crossed";
  } else if (firstPotentialEvent?.eventType === "indeterminate-gap") {
    outcome = "indeterminate-gap";
  } else {
    outcome = "not-reached";
  }

  const primaryEvent =
    outcome === "crossed"
      ? firstPotentialEvent?.eventType === "crossing"
        ? firstPotentialEvent
        : null
      : outcome === "indeterminate-gap" || outcome === "indeterminate-leading-gap"
        ? firstPotentialEvent ?? events.find((event) => event.eventType === "indeterminate-leading-gap") ?? null
        : null;

  const relatedEvents = events.map((event) => ({
    ...event,
    relation:
      event === primaryEvent
        ? ("primary" as const)
        : event.eventType === "missing-data"
          ? ("evidence-only" as const)
          : ("subsequent" as const)
  }));
  const resolvedPrimaryEvent = primaryEvent
    ? relatedEvents.find((event) => event.eventIndex === primaryEvent.eventIndex) ?? null
    : null;
  const firstGapEvent = relatedEvents.find(
    (event) => event.eventType === "indeterminate-leading-gap" || event.eventType === "indeterminate-gap"
  );

  return {
    curveId: curve.curveId,
    threshold,
    ruleId: THRESHOLD_RULE_ID,
    outcome,
    firstObservedAtOrAbovePoint,
    primaryEvent: outcome === "crossed" ? resolvedPrimaryEvent : null,
    candidateCount: crossingEvents.length,
    gapEventCount: gapEvents.length,
    hasMissingData: gapEvents.length > 0,
    multipleUpwardCrossings: crossingEvents.length > 1,
    events: relatedEvents,
    firstIndeterminateGap: firstGapEvent?.rightPoint
      ? {
          kind: firstGapEvent.eventType === "indeterminate-leading-gap" ? "leading-gap" : "internal-gap",
          leftPoint: firstGapEvent.leftPoint,
          rightPoint: firstGapEvent.rightPoint,
          missingStartIndex: firstGapEvent.missingStartIndex as number,
          missingEndIndex: firstGapEvent.missingEndIndex as number,
          formulaCacheEvidence: firstGapEvent.formulaCacheEvidence,
          sourceReferences: firstGapEvent.sourceReferences
        }
      : null
  };
}

type ThresholdCalculationContext = {
  formulaStatusByCell: Map<string, FormulaCacheStatus>;
};

function createCalculationContext(curve: Curve): ThresholdCalculationContext {
  const formulaStatusByCell = new Map<string, FormulaCacheStatus>();
  for (const warning of curve.warnings) {
    for (const sourceRef of warning.sourceRefs ?? []) {
      if (!sourceRef.cell || !sourceRef.formulaCacheStatus) continue;
      if (sourceRef.sourceInstanceId && sourceRef.sourceInstanceId !== curve.source.sourceInstanceId) continue;
      if (sourceRef.sourceName !== curve.source.fileName) continue;
      if (sourceRef.worksheet && sourceRef.worksheet !== curve.source.sheetName) continue;
      if (sourceRef.columnLetter && sourceRef.columnLetter !== curve.source.columnLetter) continue;
      formulaStatusByCell.set(sourceRef.cell, sourceRef.formulaCacheStatus);
    }
  }
  return { formulaStatusByCell };
}

function collectThresholdEvents(curve: Curve, context: ThresholdCalculationContext, threshold: number) {
  const events: ThresholdEvent[] = [];
  let index = 0;

  while (index < curve.y.length) {
    const value = curve.y[index];
    if (value === null) {
      const missingStartIndex = index;
      while (index + 1 < curve.y.length && curve.y[index + 1] === null) index += 1;
      const missingEndIndex = index;
      const leftIndex = missingStartIndex - 1;
      const rightIndex = missingEndIndex + 1;
      const leftValue = leftIndex >= 0 ? curve.y[leftIndex] : null;
      const rightValue = rightIndex < curve.y.length ? curve.y[rightIndex] : null;
      const isLeadingUncertainty = missingStartIndex === 0 && rightValue !== null && rightValue >= threshold;
      const isInternalUncertainty =
        leftValue !== null && rightValue !== null && leftValue < threshold && rightValue >= threshold;
      const sourceReferences: ThresholdSourceReference[] = [];
      if (leftValue !== null) sourceReferences.push(createSourceReference(curve, context, leftIndex, leftValue));
      for (let missingIndex = missingStartIndex; missingIndex <= missingEndIndex; missingIndex += 1) {
        sourceReferences.push(createSourceReference(curve, context, missingIndex, null));
      }
      if (rightValue !== null) sourceReferences.push(createSourceReference(curve, context, rightIndex, rightValue));
      events.push({
        eventType: isLeadingUncertainty
          ? "indeterminate-leading-gap"
          : isInternalUncertainty
            ? "indeterminate-gap"
            : "missing-data",
        relation: "evidence-only",
        eventIndex: events.length,
        leftPoint: leftValue === null ? null : createEvidencePoint(curve, context, leftIndex, leftValue),
        rightPoint: rightValue === null ? null : createEvidencePoint(curve, context, rightIndex, rightValue),
        missingStartIndex,
        missingEndIndex,
        interpolatedCycle: null,
        interpolationStatus: "not-applicable",
        formulaCacheEvidence: sourceReferences.some((source) => source.formulaCacheStatus === "used"),
        sourceReferences
      });
      index += 1;
      continue;
    }

    if (index > 0) {
      const previousValue = curve.y[index - 1];
      if (previousValue !== null && previousValue < threshold && value >= threshold) {
        const leftPoint = createEvidencePoint(curve, context, index - 1, previousValue);
        const rightPoint = createEvidencePoint(curve, context, index, value);
        const interpolatedCycle = interpolateCycle(leftPoint, rightPoint, threshold);
        const sourceReferences = [leftPoint.source, rightPoint.source];
        events.push({
          eventType: "crossing",
          relation: "subsequent",
          eventIndex: events.length,
          leftPoint,
          rightPoint,
          missingStartIndex: null,
          missingEndIndex: null,
          interpolatedCycle,
          interpolationStatus: interpolatedCycle === null ? "non-finite" : "finite",
          formulaCacheEvidence: sourceReferences.some((source) => source.formulaCacheStatus === "used"),
          sourceReferences
        });
      }
    }
    index += 1;
  }

  return events;
}

function isPotentialEvent(event: ThresholdEvent) {
  return (
    event.eventType === "crossing" ||
    event.eventType === "indeterminate-leading-gap" ||
    event.eventType === "indeterminate-gap"
  );
}

function interpolateCycle(left: ThresholdEvidencePoint, right: ThresholdEvidencePoint, threshold: number) {
  const scale = Math.max(Math.abs(threshold), Math.abs(left.y), Math.abs(right.y), 1);
  const ratio = (threshold / scale - left.y / scale) / (right.y / scale - left.y / scale);
  const value = left.x + ratio * (right.x - left.x);
  return Number.isFinite(value) ? value : null;
}

function createEvidencePoint(
  curve: Curve,
  context: ThresholdCalculationContext,
  index: number,
  y: number
): ThresholdEvidencePoint {
  return {
    index,
    x: curve.x[index],
    y,
    source: createSourceReference(curve, context, index, y)
  };
}

function createSourceReference(
  curve: Curve,
  context: ThresholdCalculationContext,
  index: number,
  y: number | null
): ThresholdSourceReference {
  const cell = createDataCellReference(curve, index);
  return {
    sourceInstanceId: curve.source.sourceInstanceId,
    sourceKind: curve.source.sourceKind,
    sourceName: curve.source.fileName,
    worksheet: curve.source.sheetName,
    columnLetter: curve.source.columnLetter,
    cell,
    index,
    x: curve.x[index],
    y,
    formulaCacheStatus: context.formulaStatusByCell.get(cell) ?? "not-formula"
  };
}

function createDataCellReference(curve: Curve, index: number) {
  const startRow = Number(curve.source.dataStartCell.match(/(\d+)$/u)?.[1]);
  const row = Number.isInteger(startRow) && startRow > 0 ? startRow + index : index + 3;
  return `${curve.source.columnLetter}${row}`;
}

function validateThresholdInput(curve: Curve, threshold: number) {
  if (!Number.isFinite(threshold)) throw new Error("Threshold must be a finite number.");
  if (curve.x.length !== curve.y.length) throw new Error("Threshold input X/Y lengths must match.");
  let previousX = -Infinity;
  curve.x.forEach((x, index) => {
    if (!Number.isFinite(x)) throw new Error(`Threshold input x[${index}] must be finite.`);
    if (x <= previousX) throw new Error("Threshold input X values must be strictly increasing.");
    previousX = x;
  });
  curve.y.forEach((y, index) => {
    if (y !== null && !Number.isFinite(y)) throw new Error(`Threshold input y[${index}] must be finite or null.`);
  });
}

function normalizeNegativeZero(value: number) {
  return Object.is(value, -0) ? 0 : value;
}
