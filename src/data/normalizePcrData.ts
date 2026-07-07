import { createSimilarNameWarnings } from "./similarNameWarnings";
import type { Curve, CurveStats, PcrDataset, PcrEntity, PcrWarning } from "./types";

export function createPcrDatasetFromCurves(args: {
  curves: Curve[];
  fileName: string;
  sheetName: string;
  cycleCount: number;
  importedAtIso?: string;
  warnings?: PcrWarning[];
}): PcrDataset {
  const orderedCurveIds = args.curves.map((curve) => curve.curveId);
  const specimenMap = createEntityMap(args.curves, "specimen");
  const reagentMap = createEntityMap(args.curves, "reagent");
  const duplicateLabelWarnings = createDuplicateCurveLabelWarnings(args.curves);
  const similarWarnings = [
    ...createSimilarNameWarnings(
      [...specimenMap.values()].map((entity) => entity.label),
      "specimen",
      createCurveIdsByLabel(args.curves, "specimen")
    ),
    ...createSimilarNameWarnings(
      [...reagentMap.values()].map((entity) => entity.label),
      "reagent",
      createCurveIdsByLabel(args.curves, "reagent")
    )
  ];

  const warnings = [...(args.warnings ?? []), ...duplicateLabelWarnings, ...similarWarnings];

  return {
    schemaVersion: 1,
    datasetId: `dataset:${args.fileName}:${args.sheetName}:${args.curves.length}`,
    sourceFileName: args.fileName,
    sheetName: args.sheetName,
    sheetIndex: 0,
    importedAtIso: args.importedAtIso ?? new Date().toISOString(),
    cycleCount: args.cycleCount,
    curves: args.curves,
    orderedCurveIds,
    specimens: [...specimenMap.values()],
    reagents: [...reagentMap.values()],
    warnings
  };
}

export function createStats(values: Array<number | null>): CurveStats {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    pointCount: values.length,
    missingCount: values.length - finiteValues.length,
    minY: finiteValues.length > 0 ? Math.min(...finiteValues) : null,
    maxY: finiteValues.length > 0 ? Math.max(...finiteValues) : null
  };
}

export function createEntityId(kind: "specimen" | "reagent", label: string, fallbackKey?: string) {
  const key =
    label.length > 0
      ? Array.from(label).map((character) => character.codePointAt(0)?.toString(16)).join("_")
      : fallbackKey;
  return `${kind}:${key || "missing"}`;
}

function createEntityMap(curves: Curve[], kind: "specimen" | "reagent") {
  const map = new Map<string, PcrEntity>();

  curves.forEach((curve) => {
    const id = kind === "specimen" ? curve.specimenId : curve.reagentId;
    const label = kind === "specimen" ? curve.specimenLabel : curve.reagentLabel;
    const existing = map.get(id);
    if (existing) {
      existing.curveIds.push(curve.curveId);
    } else {
      map.set(id, {
        id,
        label,
        curveIds: [curve.curveId],
        warnings: []
      });
    }
  });

  return map;
}

function createCurveIdsByLabel(curves: Curve[], kind: "specimen" | "reagent") {
  const map = new Map<string, string[]>();

  curves.forEach((curve) => {
    const label = kind === "specimen" ? curve.specimenLabel : curve.reagentLabel;
    const curveIds = map.get(label) ?? [];
    curveIds.push(curve.curveId);
    map.set(label, curveIds);
  });

  return map;
}

function createDuplicateCurveLabelWarnings(curves: Curve[]): PcrWarning[] {
  const byDisplayLabel = new Map<string, string[]>();

  curves.forEach((curve) => {
    const curveIds = byDisplayLabel.get(curve.displayLabel) ?? [];
    curveIds.push(curve.curveId);
    byDisplayLabel.set(curve.displayLabel, curveIds);
  });

  return [...byDisplayLabel.entries()]
    .filter(([, curveIds]) => curveIds.length > 1)
    .map(([label, curveIds]) => ({
      code: "DUPLICATE_CURVE_LABEL",
      severity: "warning",
      scope: "dataset",
      message: `Duplicate curve label detected: ${label}`,
      labels: [label],
      curveIds
    }));
}

