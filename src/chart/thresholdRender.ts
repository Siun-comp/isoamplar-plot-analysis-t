import type { EChartsCoreOption } from "echarts/core";
import type { AppliedThreshold, ThresholdSettings } from "../analysis/threshold";
import { getAppliedThresholdForCurve } from "../analysis/threshold";
import { defaultChartColors } from "./chartStyle";
import type { Curve, PcrEntity } from "../data/types";

export const THRESHOLD_MARK_LINE_NAME = "__isoamplar_user_raw_threshold__";
export const THRESHOLD_ANNOTATION_ID = "isoamplar-threshold-range-annotation";

export type RenderedThresholdState = "none" | "line" | "above" | "below" | "no-data" | "mixed";

export type ChartThresholdMarker = AppliedThreshold & {
  key: string;
  label: string;
  color: string;
};

type RenderedChart = {
  convertToPixel: (finder: object, value: number) => unknown;
  convertFromPixel?: (finder: object, value: number) => unknown;
  getWidth: () => number;
  getHeight: () => number;
  setOption: (option: EChartsCoreOption, options?: object) => void;
};

export function buildChartThresholdMarkers(args: {
  curves: readonly Curve[];
  reagents: readonly PcrEntity[];
  settings: ThresholdSettings;
  reagentColors?: Record<string, string>;
}) {
  if (args.settings.mode === "common") {
    return args.settings.enabled && args.settings.applied
      ? [{
          ...args.settings.applied,
          key: "common",
          label: formatThresholdValue(args.settings.applied.value),
          color: "#4b5563"
        }]
      : [];
  }
  const visibleReagentIds = new Set(args.curves.map((curve) => curve.reagentId));
  const reagentIndex = new Map(args.reagents.map((reagent, index) => [reagent.id, index]));
  const reagentLabel = new Map(args.reagents.map((reagent) => [reagent.id, reagent.label]));
  const entries = [...visibleReagentIds].flatMap((reagentId) => {
    const curve = args.curves.find((candidate) => candidate.reagentId === reagentId);
    if (!curve) return [];
    const applied = getAppliedThresholdForCurve(args.settings, curve);
    if (!applied) return [];
    const index = reagentIndex.get(reagentId) ?? 0;
    return [{
      reagentId,
      reagentLabel: reagentLabel.get(reagentId) ?? curve.reagentLabel,
      applied,
      color: args.reagentColors?.[reagentId] ?? defaultChartColors[index % defaultChartColors.length]
    }];
  });
  const grouped = new Map<string, typeof entries>();
  entries.forEach((entry) => {
    const key = normalizeThresholdKey(entry.applied.value);
    const group = grouped.get(key) ?? [];
    group.push(entry);
    grouped.set(key, group);
  });
  return [...grouped.values()].map((group) => {
    const value = group[0].applied.value;
    const labels = group.map((entry) => entry.reagentLabel);
    return {
      ...group[0].applied,
      key: group.map((entry) => entry.reagentId).join("|"),
      label: `${labels.join(", ")} · ${formatThresholdValue(value)}`,
      color: group.length === 1 ? group[0].color : "#4b5563"
    };
  });
}

export function createThresholdMarkLine(thresholds: AppliedThreshold | readonly ChartThresholdMarker[]) {
  const markers: ChartThresholdMarker[] = Array.isArray(thresholds)
    ? [...thresholds]
    : [{
        ...(thresholds as AppliedThreshold),
        key: "common",
        label: formatThresholdValue((thresholds as AppliedThreshold).value),
        color: "#4b5563"
      }];
  return {
    silent: true,
    symbol: ["none", "none"],
    animation: false,
    lineStyle: {
      color: "#4b5563",
      type: "dashed",
      width: 1.5,
      opacity: 0.95
    },
    label: {
      show: markers.length === 1,
      position: "insideEndTop",
      color: "#374151",
      backgroundColor: "rgba(255,255,255,0.92)",
      padding: [2, 4],
      fontSize: 11,
      formatter:
        markers.length === 1
          ? markers[0].label
          : (params: { data?: { label?: string } }) => params.data?.label ?? ""
    },
    data: markers.map((marker) => ({
      name: markers.length === 1 && marker.key === "common"
        ? THRESHOLD_MARK_LINE_NAME
        : `${THRESHOLD_MARK_LINE_NAME}:${marker.key}`,
      yAxis: marker.value,
      label: { formatter: marker.label, color: marker.color },
      lineStyle: { color: marker.color }
    }))
  };
}

export function applyRenderedThresholdAnnotation(
  chart: RenderedChart,
  option: EChartsCoreOption,
  renderProfile: { rangeAnnotationFontSize?: number } = {}
): RenderedThresholdState {
  const thresholds = findThresholdMarkers(option);
  if (thresholds.length === 0) {
    replaceThresholdGraphic(chart, []);
    return "none";
  }
  const hasFinitePoint = hasFiniteSeriesPoint(option);
  const explicitRange = getExplicitYAxisRange(option);
  if (!hasFinitePoint && !explicitRange) {
    replaceThresholdGraphic(chart, thresholds.map((threshold, index) => createRangeAnnotation(threshold, "no-data", renderProfile, index)));
    return "no-data";
  }

  const bounds = getGridBounds(option, chart.getWidth(), chart.getHeight());
  const renderedRange = getRenderedYAxisRange(chart, bounds) ?? explicitRange;
  const states = thresholds.map((threshold) => {
    const yPixel = chart.convertToPixel({ yAxisIndex: 0 }, threshold.value);
    if (typeof yPixel === "number" && Number.isFinite(yPixel)) {
      if (yPixel >= bounds.top - 0.5 && yPixel <= bounds.bottom + 0.5) return "line" as const;
      return yPixel < bounds.top ? "above" as const : "below" as const;
    }
    if (!renderedRange) return "no-data" as const;
    if (threshold.value >= renderedRange.min && threshold.value <= renderedRange.max) return "line" as const;
    return threshold.value > renderedRange.max ? "above" as const : "below" as const;
  });
  const annotations = thresholds.flatMap((threshold, index) =>
    states[index] === "line" ? [] : [createRangeAnnotation(threshold, states[index], renderProfile, index)]
  );
  const labelRail =
    thresholds.length > 1
      ? createThresholdLabelRail(chart, thresholds, states, bounds, renderProfile)
      : [];
  replaceThresholdGraphic(chart, [...annotations, ...labelRail]);
  return states.every((state) => state === states[0]) ? states[0] : "mixed";
}

export function findThresholdValue(option: EChartsCoreOption): number | null {
  return findThresholdMarkers(option)[0]?.value ?? null;
}

export function findThresholdMarkers(option: EChartsCoreOption): ChartThresholdMarker[] {
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  const markers: ChartThresholdMarker[] = [];
  for (const entry of series) {
    if (!entry || typeof entry !== "object" || !("markLine" in entry)) continue;
    const markLine = entry.markLine as { data?: unknown } | undefined;
    const data = Array.isArray(markLine?.data) ? markLine.data : [];
    data.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const marker = item as { name?: unknown; yAxis?: unknown; label?: { formatter?: unknown }; lineStyle?: { color?: unknown } };
      if (typeof marker.name !== "string" || !marker.name.startsWith(THRESHOLD_MARK_LINE_NAME)) return;
      if (typeof marker.yAxis !== "number" || !Number.isFinite(marker.yAxis)) return;
      markers.push({
        value: marker.yAxis,
        ruleId: "raw-first-upward-linear-v1",
        key: marker.name.slice(THRESHOLD_MARK_LINE_NAME.length + 1) || "common",
        label: typeof marker.label?.formatter === "string" ? marker.label.formatter : formatThresholdValue(marker.yAxis),
        color: typeof marker.lineStyle?.color === "string" ? marker.lineStyle.color : "#4b5563"
      });
    });
  }
  return markers;
}

function hasFiniteSeriesPoint(option: EChartsCoreOption) {
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  return series.some((entry) => {
    if (!entry || typeof entry !== "object" || !("data" in entry)) return false;
    const data = Array.isArray(entry.data) ? entry.data : [];
    return data.some(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[1] === "number" &&
        Number.isFinite(point[1])
    );
  });
}

function createRangeAnnotation(
  threshold: ChartThresholdMarker,
  direction: "above" | "below" | "no-data",
  renderProfile: { rangeAnnotationFontSize?: number },
  index: number
) {
  const fontSize = renderProfile.rangeAnnotationFontSize ?? 11;
  const directionText = direction === "no-data" ? "no Y-axis data" : `${direction} Y range`;
  return {
    id: `${THRESHOLD_ANNOTATION_ID}-${threshold.key}`,
    type: "text",
    right: 24,
    top: 6 + index * (fontSize + 12),
    silent: true,
    z: 20,
    style: {
      text: `${threshold.label} · ${directionText}`,
      fill: "#374151",
      font: `${fontSize}px Arial, sans-serif`,
      backgroundColor: "rgba(255,255,255,0.96)",
      padding: fontSize > 11 ? [6, 10] : [3, 5],
      borderColor: "#cbd5e1",
      borderWidth: 1,
      borderRadius: 2
    }
  };
}

function createThresholdLabelRail(
  chart: RenderedChart,
  thresholds: readonly ChartThresholdMarker[],
  states: ReadonlyArray<"line" | "above" | "below" | "no-data">,
  bounds: ReturnType<typeof getGridBounds>,
  renderProfile: { rangeAnnotationFontSize?: number }
) {
  const fontSize = renderProfile.rangeAnnotationFontSize ?? 11;
  const spacing = fontSize + 9;
  const minY = bounds.top + fontSize;
  const maxY = bounds.bottom - fontSize;
  const entries = thresholds.flatMap((threshold, index) => {
    if (states[index] !== "line") return [];
    const pixel = chart.convertToPixel({ yAxisIndex: 0 }, threshold.value);
    return typeof pixel === "number" && Number.isFinite(pixel)
      ? [{ threshold, actualY: pixel, labelY: Math.min(maxY, Math.max(minY, pixel)) }]
      : [];
  }).sort((left, right) => left.labelY - right.labelY);
  entries.forEach((entry, index) => {
    if (index === 0) return;
    entry.labelY = Math.max(entry.labelY, entries[index - 1].labelY + spacing);
  });
  if (entries.length > 0 && entries[entries.length - 1].labelY > maxY) {
    entries[entries.length - 1].labelY = maxY;
    for (let index = entries.length - 2; index >= 0; index -= 1) {
      entries[index].labelY = Math.min(entries[index].labelY, entries[index + 1].labelY - spacing);
    }
  }
  const railX = bounds.right + 7;
  return entries.flatMap(({ threshold, actualY, labelY }) => [
    {
      id: `${THRESHOLD_ANNOTATION_ID}-rail-line-${threshold.key}`,
      type: "line",
      silent: true,
      z: 20,
      shape: { x1: bounds.right, y1: actualY, x2: railX + 8, y2: labelY },
      style: { stroke: threshold.color, lineWidth: 1, opacity: 0.9 }
    },
    {
      id: `${THRESHOLD_ANNOTATION_ID}-rail-label-${threshold.key}`,
      type: "text",
      left: railX + 10,
      top: labelY - fontSize,
      silent: true,
      z: 21,
      style: {
        text: truncateThresholdLabel(threshold.label),
        fill: "#263448",
        font: `600 ${fontSize}px Arial, sans-serif`,
        backgroundColor: "rgba(255,255,255,0.94)",
        padding: [2, 3]
      }
    }
  ]);
}

function truncateThresholdLabel(label: string) {
  const maxLength = 18;
  if (label.length <= maxLength) return label;
  const separatorIndex = label.lastIndexOf(" · ");
  if (separatorIndex <= 0) return `${label.slice(0, maxLength - 1)}…`;
  const valueSuffix = label.slice(separatorIndex);
  const availableLabelLength = maxLength - valueSuffix.length - 1;
  if (availableLabelLength < 3) return `…${label.slice(-(maxLength - 1))}`;
  return `${label.slice(0, availableLabelLength)}…${valueSuffix}`;
}

function normalizeThresholdKey(value: number) {
  return Object.is(value, -0) ? "0" : value.toString();
}

function replaceThresholdGraphic(chart: RenderedChart, graphic: unknown[]) {
  chart.setOption({ graphic } as EChartsCoreOption, { replaceMerge: ["graphic"], lazyUpdate: false });
}

function getGridBounds(option: EChartsCoreOption, width: number, height: number) {
  const gridValue = Array.isArray(option.grid) ? option.grid[0] : option.grid;
  const grid = gridValue && typeof gridValue === "object" ? (gridValue as Record<string, unknown>) : {};
  const left = resolvePixel(grid.left, width, 88);
  const right = resolvePixel(grid.right, width, 24);
  const top = resolvePixel(grid.top, height, 30);
  const bottomGap = resolvePixel(grid.bottom, height, 54);
  return { left, right: width - right, top, bottom: height - bottomGap };
}

function getRenderedYAxisRange(chart: RenderedChart, bounds: ReturnType<typeof getGridBounds>) {
  if (!chart.convertFromPixel) return null;
  const top = chart.convertFromPixel({ yAxisIndex: 0 }, bounds.top);
  const bottom = chart.convertFromPixel({ yAxisIndex: 0 }, bounds.bottom);
  if (typeof top !== "number" || !Number.isFinite(top) || typeof bottom !== "number" || !Number.isFinite(bottom)) {
    return null;
  }
  return { min: Math.min(top, bottom), max: Math.max(top, bottom) };
}

function getExplicitYAxisRange(option: EChartsCoreOption) {
  const axisValue = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis;
  if (!axisValue || typeof axisValue !== "object") return null;
  const axis = axisValue as { min?: unknown; max?: unknown };
  if (typeof axis.min !== "number" || !Number.isFinite(axis.min) || typeof axis.max !== "number" || !Number.isFinite(axis.max)) {
    return null;
  }
  return { min: Math.min(axis.min, axis.max), max: Math.max(axis.min, axis.max) };
}

function resolvePixel(value: unknown, total: number, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(?:\.\d+)?%$/u.test(value)) return (Number(value.slice(0, -1)) / 100) * total;
  return fallback;
}

export function formatThresholdValue(value: number) {
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e6 || absolute < 1e-3)) return value.toExponential(5);
  return Number(value.toPrecision(7)).toString();
}
