import type { PcrDataset } from "../data/types";
import { formatCurveLabel } from "../data/curveLabels";

export function getMatchedCurveIds(dataset: PcrDataset, query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return new Set(dataset.orderedCurveIds);
  }

  return new Set(
    dataset.curves
      .filter((curve) =>
        [
          curve.specimenLabel,
          curve.reagentLabel,
          curve.displayLabel,
          formatCurveLabel(curve, "reagent"),
          formatCurveLabel(curve, "specimen"),
          curve.source.columnLetter,
          curve.source.fileName,
          curve.source.sheetName
        ].some((value) => normalizeSearchText(value).includes(normalizedQuery))
      )
      .map((curve) => curve.curveId)
  );
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}
