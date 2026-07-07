import { formatCurveLabel } from "../data/curveLabels";
import type { Curve, CurveStyleOverride, GroupingMode, LineType, StyleRules } from "../data/types";

export const defaultChartColors = [
  "#0b6fa4",
  "#d97706",
  "#5b8c5a",
  "#b23a48",
  "#6f5fa8",
  "#1d7a7a",
  "#a15c38",
  "#455a64",
  "#2f80ed",
  "#f2b705"
];

const lineTypeCycle: LineType[] = ["solid", "dashed", "dotted"];

export function createDefaultStyleRules(): StyleRules {
  return {
    colorBy: "reagent",
    lineTypeBy: "specimen",
    specimenColors: {},
    reagentColors: {},
    specimenLineTypes: {},
    reagentLineTypes: {}
  };
}

export function resolveCurveStyle(args: {
  curve: Curve;
  index: number;
  fallbackColorIndex?: number;
  labelMode?: GroupingMode;
  styleRules: StyleRules;
  override?: CurveStyleOverride;
}) {
  const { curve, index, fallbackColorIndex, labelMode, styleRules, override } = args;
  const colorGroupId = styleRules.colorBy === "specimen" ? curve.specimenId : curve.reagentId;
  const colorRules = styleRules.colorBy === "specimen" ? styleRules.specimenColors : styleRules.reagentColors;
  const lineTypeGroupId = styleRules.lineTypeBy === "specimen" ? curve.specimenId : curve.reagentId;
  const lineTypeRules =
    styleRules.lineTypeBy === "specimen" ? styleRules.specimenLineTypes : styleRules.reagentLineTypes;
  const defaultColorIndex = fallbackColorIndex ?? index;

  return {
    displayName: override?.displayName || formatCurveLabel(curve, labelMode),
    color: override?.color || colorRules[colorGroupId] || defaultChartColors[defaultColorIndex % defaultChartColors.length],
    lineType: override?.lineType || lineTypeRules[lineTypeGroupId] || "solid",
    markerType: override?.markerType ?? "none",
    lineWidth: override?.lineWidth ?? 2.25,
    visible: override?.visible ?? true
  };
}

export function createPresetOverrides(args: {
  curves: Curve[];
  referenceCurves?: Curve[];
  preset: BuiltInStylePresetId;
}): Record<string, CurveStyleOverride> {
  const { curves, preset } = args;
  const referenceCurves = args.referenceCurves ?? curves;
  const specimenColorMap = createEntityStyleMap(referenceCurves, "specimen", defaultChartColors);
  const reagentColorMap = createEntityStyleMap(referenceCurves, "reagent", defaultChartColors);
  const specimenLineMap = createEntityStyleMap(referenceCurves, "specimen", lineTypeCycle);
  const reagentLineMap = createEntityStyleMap(referenceCurves, "reagent", lineTypeCycle);

  return Object.fromEntries(
    curves.map((curve) => {
      if (preset === "specimenColorReagentLine") {
        return [
          curve.curveId,
          {
            color: specimenColorMap[curve.specimenId],
            lineType: reagentLineMap[curve.reagentId],
            markerType: "none"
          }
        ];
      }

      if (preset === "reagentColorSpecimenLine") {
        return [
          curve.curveId,
          {
            color: reagentColorMap[curve.reagentId],
            lineType: specimenLineMap[curve.specimenId],
            markerType: "none"
          }
        ];
      }

      return [
        curve.curveId,
        {
          color: reagentColorMap[curve.reagentId],
          lineType: "solid",
          markerType: "none"
        }
      ];
    })
  );
}

export type BuiltInStylePresetId = "reagentColorSolid" | "specimenColorReagentLine" | "reagentColorSpecimenLine";

export const builtInStylePresets: Array<{ id: BuiltInStylePresetId; label: string }> = [
  { id: "reagentColorSolid", label: "시약 색상 / 실선" },
  { id: "specimenColorReagentLine", label: "검체 색상 / 시약 선" },
  { id: "reagentColorSpecimenLine", label: "시약 색상 / 검체 선" }
];

function createEntityStyleMap<T extends string>(
  curves: Curve[],
  target: "specimen" | "reagent",
  cycle: T[]
): Record<string, T> {
  const map: Record<string, T> = {};
  let index = 0;

  curves.forEach((curve) => {
    const id = target === "specimen" ? curve.specimenId : curve.reagentId;
    if (!map[id]) {
      map[id] = cycle[index % cycle.length];
      index += 1;
    }
  });

  return map;
}
