import { describe, expect, it, vi } from "vitest";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import {
  createBoxZoomBounds,
  createChartReadoutIndex,
  createFrameThrottle,
  createHoverReadout,
  createNearestReadout,
  createPlotAreaBox,
  createSeriesHighlightPatch
} from "./ChartView";

echarts.use([SVGRenderer]);

describe("createHoverReadout", () => {
  it("extracts fixed readout values from an ECharts series hover event", () => {
    expect(
      createHoverReadout({
        componentType: "series",
        seriesId: "sheet0_col_A",
        seriesName: "A1 │ 검체 1",
        data: [23, 4.5123],
        color: "#0b6fa4"
      })
    ).toEqual({
      curveId: "sheet0_col_A",
      seriesName: "A1 │ 검체 1",
      x: 23,
      y: 4.5123,
      color: "#0b6fa4"
    });
  });

  it("ignores non-series events and malformed point data", () => {
    expect(createHoverReadout({ componentType: "xAxis", data: [1, 2] })).toBeNull();
    expect(createHoverReadout({ componentType: "series", data: [] })).toBeNull();
  });
});

describe("high-density hover helpers", () => {
  it("coalesces pointer updates to the latest value in one animation frame", () => {
    const values: number[] = [];
    let queued: ((timestamp: number) => void) | null = null;
    let cancelled = false;
    const throttle = createFrameThrottle(
      (value: number) => values.push(value),
      (callback) => {
        queued = callback;
        return 1;
      },
      () => {
        cancelled = true;
      }
    );

    throttle.schedule(1);
    throttle.schedule(2);
    throttle.schedule(3);
    expect(values).toEqual([]);
    expect(queued).not.toBeNull();
    (queued as unknown as (timestamp: number) => void)(0);
    expect(values).toEqual([3]);

    throttle.schedule(4);
    throttle.cancel();
    expect(cancelled).toBe(true);
  });

  it("converts only the hover-radius X window instead of every point in a 100 by 100 workload", () => {
    const option = {
      series: Array.from({ length: 100 }, (_, seriesIndex) => ({
        id: `curve-${seriesIndex}`,
        name: `Curve ${seriesIndex}`,
        type: "line",
        lineStyle: { color: "#0926fb", width: 2.25 },
        data: Array.from({ length: 100 }, (_, pointIndex) => [pointIndex + 1, seriesIndex])
      }))
    };
    let pixelConversions = 0;
    const chart = {
      containPixel: () => true,
      convertFromPixel: (_finder: unknown, value: [number, number]) => [value[0] / 10, value[1]],
      convertToPixel: (_finder: unknown, value: [number, number]) => {
        pixelConversions += 1;
        return [value[0] * 10, value[1]];
      }
    };

    const result = createNearestReadout(
      chart as never,
      createChartReadoutIndex(option),
      500,
      42
    );

    expect(result).toMatchObject({ curveId: "curve-42", x: 50, y: 42 });
    expect(pixelConversions).toBeLessThanOrEqual(800);
    expect(pixelConversions).toBeLessThan(10_000 / 5);
  });

  it("keeps a farther-X point when it is nearer in two-dimensional pixel distance", () => {
    const option = {
      series: [
        {
          id: "steep",
          name: "Steep curve",
          lineStyle: { color: "#0926fb" },
          data: [[0, 100], [2, 0], [10, 0]]
        }
      ]
    };
    const chart = {
      containPixel: () => true,
      convertFromPixel: (_finder: unknown, value: [number, number]) => [value[0] / 10, value[1]],
      convertToPixel: (_finder: unknown, value: [number, number]) => [value[0] * 10, value[1]]
    };

    expect(createNearestReadout(chart as never, createChartReadoutIndex(option), 0, 0)).toMatchObject({
      curveId: "steep",
      x: 2,
      y: 0
    });
  });

  it("keeps exact hit-window boundaries, null gaps, and duplicate X candidates", () => {
    const option = {
      series: [
        {
          id: "boundary",
          name: "Boundary curve",
          lineStyle: { color: "#0926fb" },
          data: [[0, 100], [0, 0], [1, null], [3.2, 0], [10, 0]]
        }
      ]
    };
    const chart = {
      containPixel: () => true,
      convertFromPixel: (_finder: unknown, value: [number, number]) => [value[0] / 10, value[1]],
      convertToPixel: (_finder: unknown, value: [number, number]) => [value[0] * 10, value[1]]
    };
    const index = createChartReadoutIndex(option);

    expect(index[0].data).toHaveLength(4);
    expect(createNearestReadout(chart as never, index, 0, 0)).toMatchObject({ x: 0, y: 0 });
    expect(createNearestReadout(chart as never, index, 32, 0)).toMatchObject({ x: 3.2, y: 0 });
  });

  it("creates a data-free style patch that preserves marker and series data ownership", () => {
    const patch = createSeriesHighlightPatch(
      {
        series: [
          { id: "curve-a", data: [[1, 2]], symbol: "circle", lineStyle: { width: 2 } },
          { id: "curve-b", data: [[1, 3]], symbol: "triangle", lineStyle: { width: 4 } }
        ]
      },
      "curve-b"
    ) as { series: Array<Record<string, unknown>> };

    expect(patch.series[0]).not.toHaveProperty("data");
    expect(patch.series[0]).not.toHaveProperty("symbol");
    expect(patch.series[0]).toMatchObject({ lineStyle: { width: 2, opacity: 0.16 }, itemStyle: { opacity: 0.16 } });
    expect(patch.series[1]).toMatchObject({ lineStyle: { width: 4.9, opacity: 1 }, itemStyle: { opacity: 1 } });
  });

  it("preserves actual ECharts data, markers, line style, order, and option replacement under highlight patches", () => {
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ measureText: (text: string) => ({ width: text.length * 7 }) }) as never
    );
    const chart = echarts.init(null, undefined, { renderer: "svg", ssr: true, width: 400, height: 300 });
    const option = {
      xAxis: { type: "value" },
      yAxis: { type: "value" },
      series: [
        {
          id: "curve-a",
          type: "line",
          data: [[1, 2], [2, 3]],
          symbol: "circle",
          showSymbol: true,
          lineStyle: { color: "#ff0000", type: "dashed", width: 2 }
        },
        {
          id: "curve-b",
          type: "line",
          data: [[1, 4], [2, 5]],
          symbol: "triangle",
          showSymbol: true,
          lineStyle: { color: "#00b050", type: "dotted", width: 4 }
        }
      ]
    };

    try {
      chart.setOption(option, true);
      chart.setOption(createSeriesHighlightPatch(option, "curve-b"), false, true);
      const highlighted = chart.getOption().series as Array<Record<string, any>>;
      expect(highlighted.map((series) => series.id)).toEqual(["curve-a", "curve-b"]);
      expect(highlighted[0]).toMatchObject({
        data: [[1, 2], [2, 3]],
        symbol: "circle",
        showSymbol: true,
        lineStyle: { color: "#ff0000", type: "dashed", width: 2, opacity: 0.16 }
      });
      expect(highlighted[1]).toMatchObject({
        data: [[1, 4], [2, 5]],
        symbol: "triangle",
        showSymbol: true,
        lineStyle: { color: "#00b050", type: "dotted", width: 4.9, opacity: 1 }
      });

      chart.setOption(option, true);
      chart.setOption(createSeriesHighlightPatch(option, null), false, true);
      const restored = chart.getOption().series as Array<Record<string, any>>;
      expect(restored.map((series) => series.lineStyle.width)).toEqual([2, 4]);

      const replacement = { ...option, series: [option.series[1]] };
      chart.setOption(replacement, true);
      chart.setOption(createSeriesHighlightPatch(replacement, "curve-b"), false, true);
      expect((chart.getOption().series as Array<Record<string, any>>).map((series) => series.id)).toEqual(["curve-b"]);
    } finally {
      chart.dispose();
      contextSpy.mockRestore();
    }
  });
});

describe("createBoxZoomBounds", () => {
  it("normalizes dragged pixel and data ranges into X/Y bounds", () => {
    expect(createBoxZoomBounds([300, 80], [120, 260], [42, 900000], [18, 120000])).toEqual({
      xMin: 18,
      xMax: 42,
      yMin: 120000,
      yMax: 900000
    });
  });

  it("ignores tiny drags and invalid data coordinates", () => {
    expect(createBoxZoomBounds([10, 10], [18, 40], [1, 2], [3, 4])).toBeNull();
    expect(createBoxZoomBounds([10, 10], [80, 90], [1, 2], ["bad", 4])).toBeNull();
    expect(createBoxZoomBounds([10, 10], [80, 90], [1, 2], [1, 4])).toBeNull();
  });
});

describe("createPlotAreaBox", () => {
  it("derives the highlighted plot area from numeric grid margins", () => {
    expect(
      createPlotAreaBox(
        {
          grid: {
            left: 88,
            right: 24,
            top: 30,
            bottom: 54
          }
        },
        720,
        560
      )
    ).toEqual({
      left: 88,
      top: 30,
      width: 608,
      height: 476
    });
  });

  it("supports percentage and explicit grid sizes", () => {
    expect(
      createPlotAreaBox(
        {
          grid: {
            left: "10%",
            top: "5%",
            width: "80%",
            height: 300
          }
        },
        1000,
        600
      )
    ).toEqual({
      left: 100,
      top: 30,
      width: 800,
      height: 300
    });
  });
});
