import type { EChartsCoreOption } from "echarts/core";
import type { ChartScaleState, AxisScaleIssue } from "./chartScale";
import { buildChartProjection, defaultChartColors } from "./chartProjection";
import { buildReportLegendProjection } from "./reportLegend";
import type { ReportLegendProjection } from "./reportLegend";
import type { Curve, CurveStyleOverride, GroupingMode, LegendSettings, PcrDataset, StyleRules } from "../data/types";
import type { LegendItem } from "./chartProjection";
import type { AppliedThreshold } from "../analysis/threshold";
import { createThresholdMarkLine } from "./thresholdRender";

export type ChartBuildResult = {
  option: EChartsCoreOption;
  visibleCurves: Curve[];
  legendItems: LegendItem[];
  legendProjection: ReportLegendProjection;
  scaleIssues: AxisScaleIssue[];
};

export function buildPcrChartOption(args: {
  dataset: PcrDataset | null;
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  scale: ChartScaleState;
  labelMode?: GroupingMode;
  styleRules?: StyleRules;
  curveOverrides?: Record<string, CurveStyleOverride>;
  legendSettings?: LegendSettings;
  highlightedCurveId?: string | null;
  threshold?: AppliedThreshold | null;
}): ChartBuildResult {
  const projection = buildChartProjection(args);
  const legendProjection = args.legendSettings
    ? buildReportLegendProjection({
        curves: projection.visibleCurves,
        legendItems: projection.legendItems,
        labelMode: args.labelMode ?? "specimen",
        legendSettings: args.legendSettings,
        curveOverrides: args.curveOverrides
      })
    : { title: "Legend", items: projection.legendItems, compactedBy: null };
  const displayLegendItems = legendProjection.items;
  const displayLegendNameByCurveId = new Map(displayLegendItems.map((item) => [item.curveId, item.label]));

  return {
    visibleCurves: projection.visibleCurves,
    legendItems: displayLegendItems,
    legendProjection,
    scaleIssues: projection.scaleIssues,
    option: {
      backgroundColor: "#ffffff",
      animation: false,
      color: defaultChartColors,
      grid: {
        left: 88,
        right: 24,
        top: 30,
        bottom: 54,
        containLabel: false
      },
      tooltip: {
        show: false,
        trigger: "axis",
        axisPointer: {
          type: "line"
        },
        valueFormatter: (value: unknown) => (typeof value === "number" ? value.toPrecision(5) : "")
      },
      legend: {
        show: false,
        type: "scroll",
        orient: "vertical",
        right: 6,
        top: 24,
        bottom: 30,
        itemWidth: 20,
        itemHeight: 10,
        textStyle: {
          color: "#263448",
          fontSize: 12
        },
        data: projection.visibleCurves.map(
          (curve) => displayLegendNameByCurveId.get(curve.curveId) ?? projection.chartNames.get(curve.curveId) ?? curve.displayLabel
        )
      },
      xAxis: {
        type: "value",
        name: "Cycle",
        nameLocation: "middle",
        nameGap: 32,
        min: projection.xScale.min,
        max: projection.xScale.max,
        axisLine: {
          lineStyle: { color: "#1f2937" }
        },
        axisLabel: {
          color: "#263448"
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#dfe5ed", width: 1 }
        },
        minorSplitLine: {
          show: false
        }
      },
      yAxis: {
        type: "value",
        name: "Fluorescence",
        nameLocation: "middle",
        nameGap: 72,
        min: projection.yScale.min,
        max: projection.yScale.max,
        axisLine: {
          lineStyle: { color: "#1f2937" }
        },
        axisLabel: {
          color: "#263448",
          margin: 8
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#dfe5ed", width: 1 }
        },
        minorSplitLine: {
          show: false
        }
      },
      series: projection.visibleCurves.map((curve, index) => {
        const resolvedStyle = projection.resolvedStyles.get(curve.curveId);
        const markerType = resolvedStyle?.markerType ?? "none";
        const baseLineWidth = resolvedStyle?.lineWidth ?? 2.25;
        const isHighlighted = args.highlightedCurveId === curve.curveId;
        const isMuted = Boolean(args.highlightedCurveId) && !isHighlighted;
        const opacity = isMuted ? 0.16 : 1;

        return {
          id: curve.curveId,
          name: displayLegendNameByCurveId.get(curve.curveId) ?? projection.chartNames.get(curve.curveId) ?? curve.displayLabel,
          type: "line",
          data: curve.x.map((x, pointIndex) => [x, curve.y[pointIndex]]),
          showSymbol: markerType !== "none",
          symbol: markerType,
          symbolSize: markerType === "none" ? 0 : 6,
          connectNulls: false,
          z: isHighlighted ? 3 : 1,
          lineStyle: {
            width: isHighlighted ? baseLineWidth + 0.9 : baseLineWidth,
            type: resolvedStyle?.lineType ?? "solid",
            color: resolvedStyle?.color,
            opacity
          },
          itemStyle: {
            color: resolvedStyle?.color ?? defaultChartColors[index % defaultChartColors.length],
            opacity
          },
          emphasis: {
            disabled: true
          },
          ...(index === 0 && args.threshold ? { markLine: createThresholdMarkLine(args.threshold) } : {})
        };
      })
    }
  };
}
