import { createEntityId, createPcrDatasetFromCurves } from "./normalizePcrData";
import type { Curve, PcrDataset, PcrWarning } from "./types";

const regeneratedWarningCodes = new Set(["DUPLICATE_CURVE_LABEL", "SIMILAR_SPECIMEN_LABEL", "SIMILAR_REAGENT_LABEL"]);

export type DatasetMergeResult = {
  dataset: PcrDataset;
  appendedCurveIds: string[];
};

export function appendPcrDataset(base: PcrDataset, incoming: PcrDataset): DatasetMergeResult {
  const usedCurveIds = new Set(base.curves.map((curve) => curve.curveId));
  const nextFileIndex = getNextFileIndex(base);
  const idMap = new Map<string, string>();

  incoming.curves.forEach((curve) => {
    idMap.set(curve.curveId, createUniqueCurveId(curve.curveId, nextFileIndex, usedCurveIds));
  });

  const appendedCurves = incoming.curves.map((curve) => rekeyCurve(curve, idMap.get(curve.curveId) ?? curve.curveId));
  const appendedCurveIds = appendedCurves.map((curve) => curve.curveId);
  const warnings = [
    ...getPortableWarnings(base.warnings),
    ...getPortableWarnings(incoming.warnings).map((warning) => rekeyWarning(warning, idMap))
  ];
  const curves = [...base.curves, ...appendedCurves];

  return {
    dataset: createPcrDatasetFromCurves({
      curves,
      fileName: createMergedFileName(base.sourceFileName, nextFileIndex),
      sheetName: "Multiple first worksheets",
      cycleCount: Math.max(base.cycleCount, incoming.cycleCount),
      importedAtIso: base.importedAtIso,
      warnings: dedupeWarnings(warnings)
    }),
    appendedCurveIds
  };
}

function rekeyCurve(curve: Curve, curveId: string): Curve {
  return {
    ...curve,
    curveId,
    sourceId: `${curve.source.fileName}#${curve.source.sheetName}!${curve.source.columnLetter}`,
    specimenId: createEntityId("specimen", curve.specimenLabel, `missing_${curveId}`),
    reagentId: createEntityId("reagent", curve.reagentLabel, `missing_${curveId}`),
    warnings: curve.warnings.map((warning) => rekeyWarning(warning, new Map([[curve.curveId, curveId]])))
  };
}

function rekeyWarning(warning: PcrWarning, idMap: Map<string, string>): PcrWarning {
  if (!warning.curveIds) return warning;

  return {
    ...warning,
    curveIds: warning.curveIds.map((curveId) => idMap.get(curveId) ?? curveId)
  };
}

function getPortableWarnings(warnings: PcrWarning[]) {
  return warnings.filter((warning) => !regeneratedWarningCodes.has(warning.code));
}

function createUniqueCurveId(curveId: string, fileIndex: number, usedCurveIds: Set<string>) {
  const baseId = `file${fileIndex}_${curveId}`;
  let candidate = baseId;
  let suffix = 2;

  while (usedCurveIds.has(candidate)) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }

  usedCurveIds.add(candidate);
  return candidate;
}

function getNextFileIndex(dataset: PcrDataset) {
  const fileIds = dataset.curves
    .map((curve) => curve.curveId.match(/^file(\d+)_/u)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value));

  return fileIds.length === 0 ? 2 : Math.max(...fileIds) + 1;
}

function createMergedFileName(baseFileName: string, fileIndex: number) {
  const baseMatch = baseFileName.match(/^combined_(\d+)_files$/u);
  const currentFileCount = baseMatch ? Number(baseMatch[1]) : fileIndex - 1;
  return `combined_${currentFileCount + 1}_files`;
}

function dedupeWarnings(warnings: PcrWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = JSON.stringify(warning);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
