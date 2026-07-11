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

export function ChartView({ option, onHoverReadout, boxZoomEnabled = false, onBoxZoom, onBoxZoomRejected }: ChartViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);
  const onHoverReadoutRef = useRef(onHoverReadout);
  const onBoxZoomRef = useRef(onBoxZoom);
  const onBoxZoomRejectedRef = useRef(onBoxZoomRejected);
  const boxZoomEnabledRef = useRef(boxZoomEnabled);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragBox, setDragBox] = useState<DragBox | null>(null);
  const [plotAreaBox, setPlotAreaBox] = useState<DragBox | null>(null);

  optionRef.current = option;
  onHoverReadoutRef.current = onHoverReadout;
  onBoxZoomRef.current = onBoxZoom;
  onBoxZoomRejectedRef.current = onBoxZoomRejected;
  boxZoomEnabledRef.current = boxZoomEnabled;

  useEffect(() => {
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
    chart.setOption(option, true);
    const handleMouseOver = (params: unknown) => {
      if (dragStateRef.current) return;
      onHoverReadoutRef.current?.(createHoverReadout(params));
    };
    const handleGlobalOut = () => {
      if (dragStateRef.current) return;
      chart.dispatchAction({ type: "downplay" });
      onHoverReadoutRef.current?.(null);
    };
    const handleCanvasMouseMove = (event: unknown) => {
      const point = extractCanvasPoint(event);
      if (!point) return;
      if (dragStateRef.current) {
        dragStateRef.current.current = point;
        setDragBox(createDragBox(dragStateRef.current.start, point));
        preventNativeEvent(event);
        return;
      }
      onHoverReadoutRef.current?.(createNearestReadout(chart, optionRef.current, point[0], point[1]));
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
      setDragBox(createDragBox(point, point));
      chart.dispatchAction({ type: "downplay" });
      onHoverReadoutRef.current?.(null);
      preventNativeEvent(event);
    };
    const handleBoxZoomMouseUp = (event: unknown) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const endPoint = extractCanvasPoint(event) ?? dragState.current;
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
      dragStateRef.current = null;
      setDragBox(null);
      onBoxZoomRejectedRef.current?.("outside");
    };
    chart.on("mouseover", handleMouseOver);
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
      chart.off("mouseover", handleMouseOver);
      chart.off("globalout", handleGlobalOut);
      chart.getZr().off("mousedown", handleBoxZoomMouseDown);
      chart.getZr().off("mousemove", handleCanvasMouseMove);
      chart.getZr().off("mouseup", handleBoxZoomMouseUp);
      chart.getZr().off("globalout", handleGlobalOut);
      elementRef.current?.removeEventListener("mouseleave", handleGlobalOut);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
    if (boxZoomEnabled) {
      const chart = chartRef.current;
      setPlotAreaBox(chart ? createPlotAreaBox(option, chart.getWidth(), chart.getHeight()) : null);
    }
  }, [option]);

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

function createNearestReadout(
  chart: echarts.ECharts,
  option: EChartsCoreOption,
  offsetX: number,
  offsetY: number
): ChartHoverReadout | null {
  const pixel = [offsetX, offsetY] as [number, number];
  if (!chart.containPixel({ gridIndex: 0 }, pixel)) return null;

  let nearest:
    | {
        series: ReturnType<typeof getReadoutSeries>[number];
        point: ReturnType<typeof getReadoutSeries>[number]["data"][number];
        distance: number;
      }
    | null = null;

  for (const series of getReadoutSeries(option)) {
    for (const point of series.data) {
      const pointPixel = chart.convertToPixel({ gridIndex: 0 }, [point.x, point.y]);
      if (!isNumberPair(pointPixel)) continue;
      const distance = Math.hypot(pointPixel[0] - offsetX, pointPixel[1] - offsetY);
      if (!nearest || distance < nearest.distance) {
        nearest = { series, point, distance };
      }
    }
  }

  if (!nearest || nearest.distance > 32) return null;

  return {
    curveId: nearest.series.id,
    seriesName: nearest.series.name,
    x: nearest.point.x,
    y: nearest.point.y,
    color: nearest.series.color
  };
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
