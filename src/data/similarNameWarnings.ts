import type { PcrWarning, PcrWarningCode } from "./types";

export type SimilarNameKind = "specimen" | "reagent";

export function createComparableLabel(label: string) {
  return label.trim().toLocaleLowerCase().replace(/[\s_-]+/gu, "");
}

export function createSimilarNameWarnings(
  labels: string[],
  kind: SimilarNameKind,
  curveIdsByLabel: Map<string, string[]>
): PcrWarning[] {
  const groups = new Map<string, Set<string>>();

  labels.forEach((label) => {
    const key = createComparableLabel(label);
    if (!key) return;
    const labelSet = groups.get(key) ?? new Set<string>();
    labelSet.add(label);
    groups.set(key, labelSet);
  });

  const code: PcrWarningCode =
    kind === "specimen" ? "SIMILAR_SPECIMEN_LABEL" : "SIMILAR_REAGENT_LABEL";
  const displayKind = kind === "specimen" ? "Specimen" : "Reagent";

  return [...groups.values()]
    .filter((labelSet) => labelSet.size > 1)
    .map((labelSet) => {
      const similarLabels = [...labelSet].sort((a, b) => a.localeCompare(b));
      const curveIds = similarLabels.flatMap((label) => curveIdsByLabel.get(label) ?? []);

      return {
        code,
        severity: "warning",
        scope: "dataset",
        message: `${displayKind} labels look similar but were not merged: ${similarLabels.join(", ")}`,
        labels: similarLabels,
        curveIds
      };
    });
}

