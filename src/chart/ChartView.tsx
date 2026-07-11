import { useEffect, useRef, useState } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type ChartHoverReadout = {
  curveId?: string;
  seriesName: string;
  x: number | string;
  y: number | string | null;
  color?: string;
};

export type ChartZoomBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type ChartBoxZoomRejectReason = "too-small" | "outside" | "invalid";

type ChartViewProps = {
  option: EChartsCoreOption;
  onHoverReadout?: (readout: ChartHoverReadout | null) => void;
  highlightedCurveId?: string | null;
  boxZoomEnabled?: boolean;
  onBoxZoom?: (bounds: ChartZoomBounds) => void;
  onBoxZoomRejected?: (reason: ChartBoxZoomRejectReason) => void;
};

type DragBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DragState = {
  start: [number, number];
  current: [number, number];
};

type ReadoutSeries = ReturnType<typeof getReadoutSeries>[number] & {
  numericXAscending: boolean;
};

export type ChartReadoutIndex = ReadoutSeries[];

type FrameRequest = (callback: (timestamp: number) => void) => number;
type FrameCancel = (handle: number) => void;
type PointerWork = {
  point: [number, number];
  intent: "hover" | "drag";
  generation: number;
};
type PointerThrottle = {
  schedule: (work: PointerWork) => void;
  cancel: () => void;
};

export function ChartView({
  option,
  onHoverReadout,
  highlightedCurveId = null,
  boxZoomEnabled = false,
  onBoxZoom,
  onBoxZoomRejected
}: ChartViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);
  const onHoverReadoutRef = useRef(onHoverReadout);
  const onBoxZoomRef = useRef(onBoxZoom);
  const onBoxZoomRejectedRef = useRef(onBoxZoomRejected);
  const boxZoomEnabledRef = useRef(boxZoomEnabled);
  const highlightedCurveIdRef = useRef(highlightedCurveId);
  const readoutIndexRef = useRef<ChartReadoutIndex | null>(null);
  const pointerThrottleRef = useRef<PointerThrottle | null>(null);
  const pointerGenerationRef = useRef(0);
  const previousOptionRef = useRef(option);
  const previousBoxZoomEnabledRef = useRef(boxZoomEnabled);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragBox, setDragBox] = useState<DragBox | null>(null);
  const [plotAreaBox, setPlotAreaBox] = useState<DragBox | null>(null);

  if (previousOptionRef.current !== option) {
    previousOptionRef.current = option;
    pointerGenerationRef.current += 1;
  }
  if (previousBoxZoomEnabledRef.current !== boxZoomEnabled) {
    previousBoxZoomEnabledRef.current = boxZoomEnabled;
    pointerGenerationRef.current += 1;
  }
  optionRef.current = option;
  onHoverReadoutRef.current = onHoverReadout;
  onBoxZoomRef.current = onBoxZoom;
  onBoxZoomRejectedRef.current = onBoxZoomRejected;
  boxZoomEnabledRef.current = boxZoomEnabled;
  highlightedCurveIdRef.current = highlightedCurveId;

  useEffect(() => {
    pointerThrottleRef.current?.cancel();
    if (!boxZoomEnabled) {
      dragStateRef.current = null;
      setDragBox(null);
      setPlotAreaBox(null);
      return;
    }
    const chart = chartRef.current;
    if (chart) {
      setPlotAreaBox(createPlotAreaBox(optionRef.current, chart.getWidth(), chart.getHeight()));
    }
  }, [boxZoomEnabled]);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    if (!elementRef.current) return;

    const chart = echarts.init(elementRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    readoutIndexRef.current = createChartReadoutIndex(option);
    chart.setOption(option, true);
    applySeriesHighlight(chart, option, highlightedCurveIdRef.current);
    const pointerThrottle = createFrameThrottle<PointerWork>(
      (work) => {
        if (work.generation !== pointerGenerationRef.current) return;
        if (work.intent === "drag") {
          const dragState = dragStateRef.current;
          if (!dragState) return;
          setDragBox(createDragBox(dragState.start, work.point));
          return;
        }
        if (dragStateRef.current || boxZoomEnabledRef.current) return;
        onHoverReadoutRef.current?.(
          createNearestReadout(chart, readoutIndexRef.current ?? [], work.point[0], work.point[1])
        );
      },
      (callback) => requestAnimationFrame(callback),
      (handle) => cancelAnimationFrame(handle)
    );
    pointerThrottleRef.current = pointerThrottle;
    const handleGlobalOut = () => {
      if (dragStateRef.current) return;
      pointerThrottle.cancel();
      chart.dispatchAction({ type: "downplay" });
      onHoverReadoutRef.current?.(null);
    };
    const handleCanvasMouseMove = (event: unknown) => {
      const point = extractCanvasPoint(event);
      if (!point) return;
      if (dragStateRef.current) {
        dragStateRef.current.current = point;
        pointerThrottle.schedule({ point, intent: "drag", generation: pointerGenerationRef.current });
        preventNativeEvent(event);
        return;
      }
      if (boxZoomEnabledRef.current) return;
      pointerThrottle.schedule({ point, intent: "hover", generation: pointerGenerationRef.current });
    };
    const handleBoxZoomMouseDown = (event: unknown) => {
      if (!boxZoomEnabledRef.current) return;
      if (!isPrimaryPointer(event)) return;
      const point = extractCanvasPoint(event);
      if (!point) return;
      if (!chart.containPixel({ gridIndex: 0 }, point)) {
        onBoxZoomRejectedRef.current?.("outside");
        return;
      }

      dragStateRef.current = { start: point, current: point };
      pointerThrottle.cancel();
      setDragBox(createDragBox(point, point));
      chart.dispatchAction({ type: "downplay" });
      onHoverReadoutRef.current?.(null);
      preventNativeEvent(event);
    };
    const handleBoxZoomMouseUp = (event: unknown) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const endPoint = extractCanvasPoint(event) ?? dragState.current;
      pointerThrottle.cancel();
      dragStateRef.current = null;
      setDragBox(null);
      preventNativeEvent(event);

      if (!chart.containPixel({ gridIndex: 0 }, endPoint)) {
        onBoxZoomRejectedRef.current?.("outside");
        return;
      }
      const startData = chart.convertFromPixel({ gridIndex: 0 }, dragState.start);
      const endData = chart.convertFromPixel({ gridIndex: 0 }, endPoint);
      const bounds = createBoxZoomBounds(dragState.start, endPoint, startData, endData);
      if (bounds) {
        onBoxZoomRef.current?.(bounds);
      } else {
        onBoxZoomRejectedRef.current?.(isSmallBoxDrag(dragState.start, endPoint) ? "too-small" : "invalid");
      }
    };
    const handleWindowMouseUp = () => {
      if (!dragStateRef.current) return;
      pointerThrottle.cancel();
      dragStateRef.current = null;
      setDragBox(null);
      onBoxZoomRejectedRef.current?.("outside");
    };
    chart.on("globalout", handleGlobalOut);
    chart.getZr().on("mousedown", handleBoxZoomMouseDown);
    chart.getZr().on("mousemove", handleCanvasMouseMove);
    chart.getZr().on("mouseup", handleBoxZoomMouseUp);
    chart.getZr().on("globalout", handleGlobalOut);
    elementRef.current.addEventListener("mouseleave", handleGlobalOut);
    window.addEventListener("mouseup", handleWindowMouseUp);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
      if (boxZoomEnabledRef.current) {
        setPlotAreaBox(createPlotAreaBox(optionRef.current, chart.getWidth(), chart.getHeight()));
      }
    });
    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
      pointerThrottle.cancel();
      chart.off("globalout", handleGlobalOut);
      chart.getZr().off("mousedown", handleBoxZoomMouseDown);
      chart.getZr().off("mousemove", handleCanvasMouseMove);
      chart.getZr().off("mouseup", handleBoxZoomMouseUp);
      chart.getZr().off("globalout", handleGlobalOut);
      elementRef.current?.removeEventListener("mouseleave", handleGlobalOut);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      chart.dispose();
      chartRef.current = null;
      readoutIndexRef.current = null;
      pointerThrottleRef.current = null;
    };
  }, []);

  useEffect(() => {
    pointerThrottleRef.current?.cancel();
    readoutIndexRef.current = createChartReadoutIndex(option);
    chartRef.current?.setOption(option, true);
    if (chartRef.current) {
      applySeriesHighlight(chartRef.current, option, highlightedCurveIdRef.current);
    }
    if (boxZoomEnabled) {
      const chart = chartRef.current;
      setPlotAreaBox(chart ? createPlotAreaBox(option, chart.getWidth(), chart.getHeight()) : null);
    }
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) applySeriesHighlight(chart, optionRef.current, highlightedCurveId);
  }, [highlightedCurveId]);

  return (
    <div className={`chart-view-root${boxZoomEnabled ? " is-box-zoom-enabled" : ""}`}>
      <div className="echarts-surface" ref={elementRef} role="img" aria-label="IsoAmplar amplification curve chart" />
      {boxZoomEnabled && plotAreaBox && (
        <div
          className="box-zoom-plot-area"
          aria-hidden="true"
          style={{
            left: `${plotAreaBox.left}px`,
            top: `${plotAreaBox.top}px`,
            width: `${plotAreaBox.width}px`,
            height: `${plotAreaBox.height}px`
          }}
        />
      )}
      {dragBox && (
        <div
          className="box-zoom-selection"
          aria-hidden="true"
          style={{
            left: `${dragBox.left}px`,
            top: `${dragBox.top}px`,
            width: `${dragBox.width}px`,
            height: `${dragBox.height}px`
          }}
        />
      )}
    </div>
  );
}

export function createBoxZoomBounds(
  startPixel: [number, number],
  endPixel: [number, number],
  startData: unknown,
  endData: unknown,
  minimumPixelSize = 10
): ChartZoomBounds | null {
  if (isSmallBoxDrag(startPixel, endPixel, minimumPixelSize)) {
    return null;
  }
  if (!isNumberPair(startData) || !isNumberPair(endData)) return null;

  const xMin = Math.min(startData[0], endData[0]);
  const xMax = Math.max(startData[0], endData[0]);
  const yMin = Math.min(startData[1], endData[1]);
  const yMax = Math.max(startData[1], endData[1]);
  if (xMin >= xMax || yMin >= yMax) return null;

  return { xMin, xMax, yMin, yMax };
}

export function createPlotAreaBox(option: EChartsCoreOption, surfaceWidth: number, surfaceHeight: number): DragBox | null {
  if (!Number.isFinite(surfaceWidth) || !Number.isFinite(surfaceHeight) || surfaceWidth <= 0 || surfaceHeight <= 0) {
    return null;
  }

  const grid = getPrimaryGridOption(option);
  if (!grid) return null;

  const left = parseBoxDimension(grid.left, surfaceWidth) ?? 0;
  const top = parseBoxDimension(grid.top, surfaceHeight) ?? 0;
  const right = parseBoxDimension(grid.right, surfaceWidth) ?? 0;
  const bottom = parseBoxDimension(grid.bottom, surfaceHeight) ?? 0;
  const explicitWidth = parseBoxDimension(grid.width, surfaceWidth);
  const explicitHeight = parseBoxDimension(grid.height, surfaceHeight);
  const width = explicitWidth ?? surfaceWidth - left - right;
  const height = explicitHeight ?? surfaceHeight - top - bottom;

  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

function isSmallBoxDrag(startPixel: [number, number], endPixel: [number, number], minimumPixelSize = 10) {
  return Math.abs(endPixel[0] - startPixel[0]) < minimumPixelSize || Math.abs(endPixel[1] - startPixel[1]) < minimumPixelSize;
}

export function createHoverReadout(params: unknown): ChartHoverReadout | null {
  if (!isObject(params)) return null;
  if (params.componentType !== "series") return null;
  const data = Array.isArray(params.data) ? params.data : [];
  const x = normalizeReadoutValue(data[0]);
  const y = normalizeReadoutValue(data[1]);
  if (x === null) return null;

  return {
    curveId: typeof params.seriesId === "string" ? params.seriesId : undefined,
    seriesName: String(params.seriesName ?? ""),
    x,
    y,
    color: typeof params.color === "string" ? params.color : undefined
  };
}

export function createNearestReadout(
  chart: echarts.ECharts,
  readoutIndex: ChartReadoutIndex,
  offsetX: number,
  offsetY: number,
  maximumPixelDistance = 32
): ChartHoverReadout | null {
  const pixel = [offsetX, offsetY] as [number, number];
  if (!chart.containPixel({ gridIndex: 0 }, pixel)) return null;

  const dataPoint = chart.convertFromPixel({ gridIndex: 0 }, pixel);
  if (!isNumberPair(dataPoint)) return null;
  const leftData = chart.convertFromPixel({ gridIndex: 0 }, [offsetX - maximumPixelDistance, offsetY]);
  const rightData = chart.convertFromPixel({ gridIndex: 0 }, [offsetX + maximumPixelDistance, offsetY]);
  if (!isNumberPair(leftData) || !isNumberPair(rightData)) return null;
  const candidateXMin = Math.min(leftData[0], rightData[0]);
  const candidateXMax = Math.max(leftData[0], rightData[0]);

  let nearest:
    | {
        series: ReadoutSeries;
        point: ReadoutSeries["data"][number];
        distance: number;
      }
    | null = null;

  for (const series of readoutIndex) {
    for (const pointIndex of findXWindowCandidateIndices(series, candidateXMin, candidateXMax, dataPoint[0])) {
      const point = series.data[pointIndex];
      const pointPixel = chart.convertToPixel({ gridIndex: 0 }, [point.x, point.y]);
      if (!isNumberPair(pointPixel)) continue;
      const distance = Math.hypot(pointPixel[0] - offsetX, pointPixel[1] - offsetY);
      if (!nearest || distance < nearest.distance) {
        nearest = { series, point, distance };
      }
    }
  }

  if (!nearest || nearest.distance > maximumPixelDistance) return null;

  return {
    curveId: nearest.series.id,
    seriesName: nearest.series.name,
    x: nearest.point.x,
    y: nearest.point.y,
    color: nearest.series.color
  };
}

export function createChartReadoutIndex(option: EChartsCoreOption): ChartReadoutIndex {
  return getReadoutSeries(option).map((series) => ({
    ...series,
    numericXAscending: series.data.every(
      (point, index) => typeof point.x === "number" && (index === 0 || point.x >= (series.data[index - 1].x as number))
    )
  }));
}

function findXWindowCandidateIndices(series: ReadoutSeries, minimumX: number, maximumX: number, targetX: number) {
  if (series.data.length === 0) return [];
  if (!series.numericXAscending) {
    const candidates: number[] = [];
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    series.data.forEach((point, index) => {
      if (typeof point.x !== "number") return;
      if (point.x >= minimumX && point.x <= maximumX) candidates.push(index);
      const distance = Math.abs(point.x - targetX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return candidates.length > 0 ? candidates : nearestIndex < 0 ? [] : [nearestIndex];
  }

  const start = findNumericLowerBound(series.data, minimumX);
  const end = findNumericLowerBound(series.data, maximumX, true);
  if (start < end) {
    return Array.from({ length: end - start }, (_, offset) => start + offset);
  }
  const insertion = findNumericLowerBound(series.data, targetX);
  return [...new Set([Math.max(0, insertion - 1), Math.min(series.data.length - 1, insertion)])];
}

function findNumericLowerBound(data: ReadoutSeries["data"], targetX: number, afterEqual = false) {
  let low = 0;
  let high = data.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleX = data[middle].x as number;
    if (middleX < targetX || (afterEqual && middleX === targetX)) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function createFrameThrottle<T>(callback: (value: T) => void, requestFrame: FrameRequest, cancelFrame: FrameCancel) {
  let frameHandle: number | null = null;
  let latestValue: T;
  let hasValue = false;

  return {
    schedule(value: T) {
      latestValue = value;
      hasValue = true;
      if (frameHandle !== null) return;
      frameHandle = requestFrame(() => {
        frameHandle = null;
        if (!hasValue) return;
        hasValue = false;
        callback(latestValue);
      });
    },
    cancel() {
      if (frameHandle !== null) cancelFrame(frameHandle);
      frameHandle = null;
      hasValue = false;
    }
  };
}

export function createSeriesHighlightPatch(option: EChartsCoreOption, highlightedCurveId: string | null) {
  return {
    series: normalizeSeriesOption((option as { series?: unknown }).series).map((series) => {
      const lineStyle = isObject(series.lineStyle) ? series.lineStyle : {};
      const baseLineWidth = typeof lineStyle.width === "number" ? lineStyle.width : 2.25;
      const isHighlighted = highlightedCurveId !== null && series.id === highlightedCurveId;
      const isMuted = highlightedCurveId !== null && !isHighlighted;
      return {
        id: series.id,
        z: isHighlighted ? 3 : 1,
        lineStyle: {
          width: isHighlighted ? baseLineWidth + 0.9 : baseLineWidth,
          opacity: isMuted ? 0.16 : 1
        },
        itemStyle: {
          opacity: isMuted ? 0.16 : 1
        }
      };
    })
  };
}

function applySeriesHighlight(chart: echarts.ECharts, option: EChartsCoreOption, highlightedCurveId: string | null) {
  chart.setOption(createSeriesHighlightPatch(option, highlightedCurveId), false, true);
}

function getReadoutSeries(option: EChartsCoreOption) {
  return normalizeSeriesOption((option as { series?: unknown }).series)
    .map((series) => ({
      id: typeof series.id === "string" ? series.id : undefined,
      name: typeof series.name === "string" ? series.name : "",
      color: getSeriesColor(series),
      data: normalizeSeriesData(series.data)
    }))
    .filter((series) => series.data.length > 0);
}

function normalizeSeriesOption(series: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(series)) return series.filter(isObject);
  return isObject(series) ? [series] : [];
}

function normalizeSeriesData(data: unknown) {
  if (!Array.isArray(data)) return [];

  return data.flatMap((point) => {
    if (!Array.isArray(point)) return [];
    const x = normalizeReadoutValue(point[0]);
    const y = normalizeReadoutValue(point[1]);
    if (x === null || typeof y !== "number") return [];
    return [{ x, y }];
  });
}

function getSeriesColor(series: Record<string, unknown>) {
  const itemStyle = isObject(series.itemStyle) ? series.itemStyle : {};
  const lineStyle = isObject(series.lineStyle) ? series.lineStyle : {};
  if (typeof itemStyle.color === "string") return itemStyle.color;
  if (typeof lineStyle.color === "string") return lineStyle.color;
  if (typeof series.color === "string") return series.color;
  return undefined;
}

function extractCanvasPoint(event: unknown): [number, number] | null {
  if (!isObject(event)) return null;
  const nativeEvent = isObject(event.event) ? event.event : {};
  const x = getFirstNumber(event.offsetX, event.zrX, nativeEvent.offsetX);
  const y = getFirstNumber(event.offsetY, event.zrY, nativeEvent.offsetY);
  return x === null || y === null ? null : [x, y];
}

function createDragBox(start: [number, number], current: [number, number]): DragBox {
  return {
    left: Math.min(start[0], current[0]),
    top: Math.min(start[1], current[1]),
    width: Math.abs(current[0] - start[0]),
    height: Math.abs(current[1] - start[1])
  };
}

function getPrimaryGridOption(option: EChartsCoreOption) {
  const grid = (option as { grid?: unknown }).grid;
  if (Array.isArray(grid)) {
    return grid.find(isObject) ?? null;
  }
  return isObject(grid) ? grid : null;
}

function parseBoxDimension(value: unknown, total: number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("%")) {
    const percent = Number(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? (total * percent) / 100 : null;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function isPrimaryPointer(event: unknown) {
  if (!isObject(event)) return true;
  const nativeEvent = isObject(event.event) ? event.event : {};
  const button = getFirstNumber(event.button, nativeEvent.button);
  if (button !== null && button !== 0) return false;
  const buttons = getFirstNumber(event.buttons, nativeEvent.buttons);
  return buttons === null || buttons === 0 || buttons === 1;
}

function preventNativeEvent(event: unknown) {
  if (!isObject(event)) return;
  const nativeEvent = isObject(event.event) ? event.event : {};
  const preventDefault = nativeEvent.preventDefault;
  if (typeof preventDefault === "function") {
    preventDefault.call(nativeEvent);
  }
}

function normalizeReadoutValue(value: unknown) {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value === null) return null;
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";
}

function getFirstNumber(...values: unknown[]) {
  const numberValue = values.find((value): value is number => typeof value === "number");
  return numberValue ?? null;
}
