import { describe, expect, it } from "vitest";
import { createBoxZoomBounds, createHoverReadout, createPlotAreaBox } from "./ChartView";

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
