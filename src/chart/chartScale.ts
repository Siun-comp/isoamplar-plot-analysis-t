import type { Curve } from "../data/types";

export type AxisId = "x" | "y";
export type ScaleMode = "auto" | "fixed" | "preset1" | "preset2";
export type ScalePresetId = "preset1" | "preset2";

export type ScalePreset = {
  label: string;
  min: string;
  max: string;
};

export type AxisScaleState = {
  mode: ScaleMode;
  fixedMin: string;
  fixedMax: string;
  preset1: ScalePreset | null;
  preset2: ScalePreset | null;
};

export type ChartScaleState = {
  x: AxisScaleState;
  y: AxisScaleState;
};

export type AxisScaleIssue = {
  axis: AxisId;
  message: string;
};

export function createDefaultChartScale(): ChartScaleState {
  return {
    x: createDefaultAxisScale(),
    y: createDefaultAxisScale()
  };
}

export function createDefaultAxisScale(): AxisScaleState {
  return {
    mode: "auto",
    fixedMin: "",
    fixedMax: "",
    preset1: { label: "P1", min: "", max: "" },
    preset2: { label: "P2", min: "", max: "" }
  };
}

export function resolveAxisScale(
  axis: AxisId,
  state: AxisScaleState,
  curves: Curve[]
): { min?: number; max?: number; issue?: AxisScaleIssue } {
  if (state.mode === "auto") {
    return {};
  }

  if (state.mode === "fixed") {
    const min = parseNumberInput(state.fixedMin);
    const max = parseNumberInput(state.fixedMax);
    if (min === null || max === null || min >= max) {
      return {
        issue: {
          axis,
          message: `${axis.toUpperCase()} fixed scale requires numeric min < max.`
        }
      };
    }
    return { min, max };
  }

  const preset = state.mode === "preset1" ? state.preset1 : state.preset2;
  const parsedPreset = parseScalePreset(preset);
  if (!parsedPreset) {
    return {
      issue: {
        axis,
        message: `${axis.toUpperCase()} ${state.mode.toUpperCase()} scale preset is not configured.`
      }
    };
  }

  const domain = getAxisDataDomain(axis, curves);
  if (domain && (parsedPreset.max < domain.min || parsedPreset.min > domain.max)) {
    return {
      min: parsedPreset.min,
      max: parsedPreset.max,
      issue: {
        axis,
        message: `${axis.toUpperCase()} preset does not overlap the selected data domain.`
      }
    };
  }

  return { min: parsedPreset.min, max: parsedPreset.max };
}

export function hasVisibleCurveWarning(visibleCurveCount: number) {
  return visibleCurveCount > 20;
}

export function getAxisAutoDomain(axis: AxisId, curves: Curve[]) {
  return getAxisDataDomain(axis, curves);
}

export function isScalePresetConfigured(preset: ScalePreset | null) {
  return parseScalePreset(preset) !== null;
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScalePreset(preset: ScalePreset | null) {
  if (!preset) return null;
  const min = parseNumberInput(preset.min);
  const max = parseNumberInput(preset.max);
  if (min === null || max === null || min >= max) return null;
  return { min, max };
}

function getAxisDataDomain(axis: AxisId, curves: Curve[]) {
  const values = curves.flatMap((curve) => (axis === "x" ? curve.x : curve.y)).filter(isFiniteNumber);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
