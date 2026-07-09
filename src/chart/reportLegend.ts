import type { LegendItem } from "./chartProjection";
import { formatCurveLabel, formatCurveSourceSuffix } from "../data/curveLabels";
import type { Curve, CurveStyleOverride, GroupingMode, LegendSettings } from "../data/types";

export type ReportLegendProjection = {
  title: string;
  items: LegendItem[];
  compactedBy: "specimen" | "reagent" | null;
};

export function buildReportLegendProjection(args: {
  curves: Curve[];
  legendItems: LegendItem[];
  labelMode: GroupingMode;
  legendSettings: LegendSettings;
  curveOverrides?: Record<string, CurveStyleOverride>;
}): ReportLegendProjection {
  const curvesById = new Map(args.curves.map((curve) => [curve.curveId, curve]));
  const compactContext =
    args.legendSettings.reportLabelMode === "autoCompact" ? getCompactContext(args.legendItems, curvesById) : null;
  const generatedLabels = args.legendItems.map((item) => {
    const curve = curvesById.get(item.curveId);
    const analysisLabel = args.curveOverrides?.[item.curveId]?.displayName?.trim();
    const legacyReportLabel = args.legendSettings.reportNameOverrides[item.curveId]?.trim();
    if (analysisLabel) return { item, label: item.label, isCustom: true };
    if (legacyReportLabel) return { item, label: legacyReportLabel, isCustom: true };
    if (!curve) return { item, label: item.label, isCustom: false };
    if (compactContext?.kind === "specimen") return { item, label: curve.reagentLabel || formatCurveLabel(curve, args.labelMode), isCustom: false };
    if (compactContext?.kind === "reagent") return { item, label: curve.specimenLabel || formatCurveLabel(curve, args.labelMode), isCustom: false };
    return { item, label: item.label, isCustom: false };
  });
  const generatedCounts = new Map<string, number>();
  generatedLabels.forEach(({ label, isCustom }) => {
    if (!isCustom) {
      generatedCounts.set(label, (generatedCounts.get(label) ?? 0) + 1);
    }
  });

  return {
    title: compactContext?.title ?? "Legend",
    compactedBy: compactContext?.kind ?? null,
    items: generatedLabels.map(({ item, label, isCustom }) => {
      const curve = curvesById.get(item.curveId);
      const finalLabel =
        !isCustom && curve && (generatedCounts.get(label) ?? 0) > 1 ? `${label} [${formatCurveSourceSuffix(curve)}]` : label;
      return {
        ...item,
        label: finalLabel
      };
    })
  };
}

function getCompactContext(items: LegendItem[], curvesById: Map<string, Curve>) {
  const curves = items.map((item) => curvesById.get(item.curveId)).filter((curve): curve is Curve => Boolean(curve));
  if (curves.length < 2) return null;

  const specimenLabels = new Set(curves.map((curve) => curve.specimenLabel));
  const reagentLabels = new Set(curves.map((curve) => curve.reagentLabel));
  const oneSpecimenManyReagents = specimenLabels.size === 1 && reagentLabels.size > 1;
  const oneReagentManySpecimens = reagentLabels.size === 1 && specimenLabels.size > 1;

  if (oneSpecimenManyReagents) {
    return { kind: "specimen" as const, title: `Legend - Specimen: ${curves[0].specimenLabel || "Empty label"}` };
  }
  if (oneReagentManySpecimens) {
    return { kind: "reagent" as const, title: `Legend - Reagent: ${curves[0].reagentLabel || "Empty label"}` };
  }
  return null;
}
