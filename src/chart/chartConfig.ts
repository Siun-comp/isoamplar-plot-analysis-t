import type { EChartsCoreOption } from "echarts/core";
import type { ChartScaleState, AxisScaleIssue } from "./chartScale";
import { resolveAxisScale } from "./chartScale";
import { createDefaultStyleRules, defaultChartColors, resolveCurveStyle } from "./chartStyle";
import { formatCurveSourceSuffix } from "../data/curveLabels";
import type { Curve, CurveStyleOverride, GroupingMode, PcrDataset, StyleRules } from "../data/types";

export type ChartBuildResult = {
  option: EChartsCoreOption;
  visibleCurves: Curve[];
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
}): ChartBuildResult {
  const visibleCurves = getVisibleCurves(args.dataset, args.selectedCurveIds, args.orderedCurveIds);
  const styleRules = args.styleRules ?? createDefaultStyleRules();
  const fallbackColorIndices = createStableColorIndexMap(args.dataset, styleRules);
  const resolvedStyles = new Map(
    visibleCurves.map((curve, index) => [
      curve.curveId,
      resolveCurveStyle({
        curve,
        index,
        fallbackColorIndex: fallbackColorIndices.get(curve.curveId),
        labelMode: args.labelMode,
        styleRules,
        override: args.curveOverrides?.[curve.curveId]
      })
    ])
  );
  const chartNames = createUniqueChartNames(visibleCurves, resolvedStyles);
  const xScale = resolveAxisScale("x", args.scale.x, visibleCurves);
  const yScale = resolveAxisScale("y", args.scale.y, visibleCurves);
  const scaleIssues = [xScale.issue, yScale.issue].filter((issue): issue is AxisScaleIssue => Boolean(issue));

  return {
    visibleCurves,
    scaleIssues,
    option: {
      backgroundColor: "#ffffff",
      animation: false,
      color: defaultChartColors,
      grid: {
        left: 58,
        right: 24,
        top: 30,
        bottom: 54,
        containLabel: true
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line"
        },
        valueFormatter: (value: unknown) => (typeof value === "number" ? value.toPrecision(5) : "")
      },
      legend: {
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
        data: visibleCurves.map((curve) => chartNames.get(curve.curveId) ?? curve.displayLabel)
      },
      xAxis: {
        type: "value",
        name: "Cycle",
        nameLocation: "middle",
        nameGap: 32,
        min: xScale.min,
        max: xScale.max,
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
        nameGap: 46,
        min: yScale.min,
        max: yScale.max,
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
      series: visibleCurves.map((curve, index) => {
        const resolvedStyle = resolvedStyles.get(curve.curveId);
        const markerType = resolvedStyle?.markerType ?? "none";

        return {
          id: curve.curveId,
          name: chartNames.get(curve.curveId) ?? curve.displayLabel,
          type: "line",
          data: curve.x.map((x, pointIndex) => [x, curve.y[pointIndex]]),
          showSymbol: markerType !== "none",
          symbol: markerType,
          symbolSize: markerType === "none" ? 0 : 6,
          connectNulls: false,
          lineStyle: {
            width: resolvedStyle?.lineWidth ?? 2.25,
            type: resolvedStyle?.lineType ?? "solid",
            color: resolvedStyle?.color
          },
          itemStyle: {
            color: resolvedStyle?.color ?? defaultChartColors[index % defaultChartColors.length]
          },
          emphasis: {
            focus: "series"
          }
        };
      })
    }
  };
}

export function getVisibleCurves(dataset: PcrDataset | null, selectedCurveIds: Set<string>, orderedCurveIds?: string[]) {
  if (!dataset) return [];

  const curvesById = new Map(dataset.curves.map((curve) => [curve.curveId, curve]));
  const order = orderedCurveIds ?? dataset.orderedCurveIds;

  return order
    .filter((curveId) => selectedCurveIds.has(curveId))
    .map((curveId) => curvesById.get(curveId))
    .filter((curve): curve is Curve => Boolean(curve));
}

function createUniqueChartNames(curves: Curve[], resolvedStyles: Map<string, ReturnType<typeof resolveCurveStyle>>) {
  const countByLabel = new Map<string, number>();
  curves.forEach((curve) => {
    const displayName = resolvedStyles.get(curve.curveId)?.displayName ?? curve.displayLabel;
    countByLabel.set(displayName, (countByLabel.get(displayName) ?? 0) + 1);
  });

  return new Map(
    curves.map((curve) => {
      const displayName = resolvedStyles.get(curve.curveId)?.displayName ?? curve.displayLabel;
      return [
        curve.curveId,
        (countByLabel.get(displayName) ?? 0) > 1
          ? `${displayName} [${formatCurveSourceSuffix(curve)}]`
          : displayName
      ];
    })
  );
}

function createStableColorIndexMap(dataset: PcrDataset | null, styleRules: StyleRules) {
  const indexByCurveId = new Map<string, number>();
  if (!dataset) return indexByCurveId;

  const entityIds =
    styleRules.colorBy === "specimen"
      ? dataset.specimens.map((specimen) => specimen.id)
      : dataset.reagents.map((reagent) => reagent.id);
  const entityIndexById = new Map(entityIds.map((id, index) => [id, index]));

  dataset.curves.forEach((curve, index) => {
    const entityId = styleRules.colorBy === "specimen" ? curve.specimenId : curve.reagentId;
    indexByCurveId.set(curve.curveId, entityIndexById.get(entityId) ?? index);
  });

  return indexByCurveId;
}
