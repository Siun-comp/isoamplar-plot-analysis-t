import type { EChartsCoreOption } from "echarts/core";
import type { AppliedThreshold } from "../analysis/threshold";

export const THRESHOLD_MARK_LINE_NAME = "__isoamplar_user_raw_threshold__";
export const THRESHOLD_ANNOTATION_ID = "isoamplar-threshold-range-annotation";

export type RenderedThresholdState = "none" | "line" | "above" | "below" | "no-data";

type RenderedChart = {
  convertToPixel: (finder: object, value: number) => unknown;
  convertFromPixel?: (finder: object, value: number) => unknown;
  getWidth: () => number;
  getHeight: () => number;
  setOption: (option: EChartsCoreOption, options?: object) => void;
};

export function createThresholdMarkLine(threshold: AppliedThreshold) {
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
      show: true,
      position: "insideEndTop",
      color: "#374151",
      backgroundColor: "rgba(255,255,255,0.92)",
      padding: [2, 4],
      fontSize: 11,
      formatter: formatThresholdValue(threshold.value)
    },
    data: [{ name: THRESHOLD_MARK_LINE_NAME, yAxis: threshold.value }]
  };
}

export function applyRenderedThresholdAnnotation(
  chart: RenderedChart,
  option: EChartsCoreOption,
  renderProfile: { rangeAnnotationFontSize?: number } = {}
): RenderedThresholdState {
  const threshold = findThresholdValue(option);
  if (threshold === null) {
    replaceThresholdGraphic(chart, []);
    return "none";
  }
  const hasFinitePoint = hasFiniteSeriesPoint(option);
  const explicitRange = getExplicitYAxisRange(option);
  if (!hasFinitePoint && !explicitRange) {
    replaceThresholdGraphic(chart, [createRangeAnnotation(threshold, "no-data", renderProfile)]);
    return "no-data";
  }

  const bounds = getGridBounds(option, chart.getWidth(), chart.getHeight());
  const yPixel = chart.convertToPixel({ yAxisIndex: 0 }, threshold);
  if (typeof yPixel === "number" && Number.isFinite(yPixel)) {
    if (yPixel >= bounds.top - 0.5 && yPixel <= bounds.bottom + 0.5) {
      replaceThresholdGraphic(chart, []);
      return "line";
    }
    const direction = yPixel < bounds.top ? "above" : "below";
    replaceThresholdGraphic(chart, [createRangeAnnotation(threshold, direction, renderProfile)]);
    return direction;
  }

  const renderedRange = getRenderedYAxisRange(chart, bounds) ?? explicitRange;
  if (!renderedRange) {
    replaceThresholdGraphic(chart, [createRangeAnnotation(threshold, "no-data", renderProfile)]);
    return "no-data";
  }
  if (threshold >= renderedRange.min && threshold <= renderedRange.max) {
    replaceThresholdGraphic(chart, []);
    return "line";
  }
  const direction = threshold > renderedRange.max ? "above" : "below";
  replaceThresholdGraphic(chart, [createRangeAnnotation(threshold, direction, renderProfile)]);
  return direction;
}

export function findThresholdValue(option: EChartsCoreOption): number | null {
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  for (const entry of series) {
    if (!entry || typeof entry !== "object" || !("markLine" in entry)) continue;
    const markLine = entry.markLine as { data?: unknown } | undefined;
    const data = Array.isArray(markLine?.data) ? markLine.data : [];
    const marker = data.find(
      (item) => item && typeof item === "object" && (item as { name?: unknown }).name === THRESHOLD_MARK_LINE_NAME
    ) as { yAxis?: unknown } | undefined;
    if (typeof marker?.yAxis === "number" && Number.isFinite(marker.yAxis)) return marker.yAxis;
  }
  return null;
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
  threshold: number,
  direction: "above" | "below" | "no-data",
  renderProfile: { rangeAnnotationFontSize?: number }
) {
  const fontSize = renderProfile.rangeAnnotationFontSize ?? 11;
  const directionText = direction === "no-data" ? "no Y-axis data" : `${direction} Y range`;
  return {
    id: THRESHOLD_ANNOTATION_ID,
    type: "text",
    right: 24,
    top: 6,
    silent: true,
    z: 20,
    style: {
      text: `Threshold ${formatThresholdValue(threshold)} · ${directionText}`,
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
