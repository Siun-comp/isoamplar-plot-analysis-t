import type { Curve, GroupingMode } from "./types";

export const curveLabelSeparator = " │ ";

export function formatCurveLabel(curve: Curve, groupingMode: GroupingMode = "specimen") {
  const specimenLabel = curve.specimenLabel || `Empty specimen ${curve.source.specimenCell}`;
  const reagentLabel = curve.reagentLabel || `Empty reagent ${curve.source.reagentCell}`;

  return groupingMode === "reagent"
    ? formatCurveEntityPair(reagentLabel, specimenLabel)
    : formatCurveEntityPair(specimenLabel, reagentLabel);
}

export function formatCurveEntityPair(firstLabel: string, secondLabel: string) {
  return `${firstLabel}${curveLabelSeparator}${secondLabel}`;
}

export function formatCurveSourceSuffix(curve: Curve) {
  const appendedFileMatch = curve.curveId.match(/^file(\d+)_/u);
  const appendedFileSuffix = appendedFileMatch ? ` [file${appendedFileMatch[1]}]` : "";
  return `${curve.source.fileName}:${curve.source.columnLetter}${appendedFileSuffix}`;
}
